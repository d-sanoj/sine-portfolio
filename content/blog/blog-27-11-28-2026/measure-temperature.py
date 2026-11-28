#!/usr/bin/env python3
"""Measure what sampling temperature does to a real language model's writing.

Model: GPT-2 (124M), loaded from a local directory (no network at run time).
Sampling is done by hand in this script -- logits / T, softmax, multinomial --
so there are no hidden sampler defaults (no top-k, no top-p, no repetition
penalty) unless a condition says so. Temperature is isolated.

For each temperature in TEMPS, for each of two prompts, generate N samples of
up to MAX_TOKENS tokens and compute:
  - distinct2: mean over samples of unique bigrams / total bigrams
  - loop_rate: fraction of samples where some 6-token sequence occurs >= 3 times
  - mean_tokens: mean generated tokens (EOS stops early)
  - eos_rate: fraction of samples that hit EOS before the token cap
  - identical_rate: fraction of samples (per prompt) whose full text duplicates
    another sample at the same temperature (greedy is 1.0 by construction)
Plus a softmax demo: top-5 next-token probabilities and entropy of the
tempered distribution for a fixed context, at T = 0.5, 1.0, 1.5.
Plus one extra condition: T=1.0 with top_p=0.9, to show the nucleus guardrail.

Outputs: results.json next to this script (metrics + every sample verbatim).
"""
import json
import time
from collections import Counter

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_DIR = "gpt2"  # local directory holding config.json + pytorch_model.bin + tokenizer
PROMPTS = {
    "story": "The old lighthouse keeper climbed the narrow stairs each evening, and",
    "explain": "The reason the sky looks blue is that",
}
TEMPS = [0.0, 0.3, 0.5, 0.7, 1.0, 1.2, 1.5]
N = 12
MAX_TOKENS = 100
SEED = 20261128
DEMO_CONTEXT = "The capital of France is"


def ngrams(tokens, n):
    return [tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def distinct_n(tokens, n):
    grams = ngrams(tokens, n)
    if not grams:
        return 0.0
    return len(set(grams)) / len(grams)


def has_loop(tokens, n=6, repeats=3):
    counts = Counter(ngrams(tokens, n))
    return bool(counts) and max(counts.values()) >= repeats


def summarize(samples):
    """samples: list of dicts {text, tokens, hit_eos}."""
    n = len(samples)
    d2 = [distinct_n(s["tokens"], 2) for s in samples]
    loops = [has_loop(s["tokens"]) for s in samples]
    lens = [len(s["tokens"]) for s in samples]
    eos = [s["hit_eos"] for s in samples]
    texts = [s["text"] for s in samples]
    dup = sum(1 for t in texts if texts.count(t) > 1)
    return {
        "n": n,
        "distinct2_mean": round(sum(d2) / n, 4),
        "loop_rate": round(sum(loops) / n, 4),
        "mean_tokens": round(sum(lens) / n, 2),
        "eos_rate": round(sum(eos) / n, 4),
        "identical_rate": round(dup / n, 4),
    }


def gen_batch(model, tok, prompt, temp, n, top_p=1.0, seed=None):
    """Hand-rolled sampler: logits/T -> softmax -> multinomial (or argmax at T=0).
    Batched over n identical prompts; per-row EOS stops that row. Uses the KV
    cache, so each step processes one new token per row."""
    ids = tok(prompt, return_tensors="pt").input_ids
    cur = ids.repeat(n, 1)
    torch.manual_seed(seed)
    finished = [False] * n
    gen_tokens = [[] for _ in range(n)]
    past = None
    for _ in range(MAX_TOKENS):
        with torch.no_grad():
            out = model(cur, past_key_values=past, use_cache=True)
        logits = out.logits[:, -1, :].float()
        past = out.past_key_values
        if temp == 0:
            nxt = logits.argmax(dim=-1, keepdim=True)
        else:
            probs = torch.softmax(logits / temp, dim=-1)
            if top_p < 1.0:
                svals, sidx = torch.sort(probs, descending=True, dim=-1)
                cum = torch.cumsum(svals, dim=-1)
                mask = cum - svals > top_p
                svals = torch.where(mask, torch.zeros_like(svals), svals)
                svals = svals / svals.sum(dim=-1, keepdim=True)
                choice = torch.multinomial(svals, 1)
                nxt = torch.gather(sidx, 1, choice)
            else:
                nxt = torch.multinomial(probs, 1)
        for i in range(n):
            if finished[i]:
                continue
            t = int(nxt[i, 0])
            if t == tok.eos_token_id:
                finished[i] = True
            else:
                gen_tokens[i].append(t)
        if all(finished):
            break
        cur = nxt
    return [
        {"text": tok.decode(gen_tokens[i], skip_special_tokens=True),
         "tokens": gen_tokens[i], "hit_eos": finished[i]}
        for i in range(n)
    ]


def main():
    t_start = time.time()
    torch.set_num_threads(4)
    tok = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)
    tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(MODEL_DIR, local_files_only=True)
    model.eval()
    n_params = sum(p.numel() for p in model.parameters())
    print(f"model: gpt2, params={n_params:,}, loaded in {time.time() - t_start:.1f}s")

    results = {
        "model": "gpt2",
        "params": n_params,
        "torch": torch.__version__,
        "prompts": PROMPTS,
        "temps": TEMPS,
        "n_per_prompt": N,
        "max_tokens": MAX_TOKENS,
        "seed": SEED,
        "sampling_note": "hand-rolled sampler: logits/T, softmax, multinomial; "
                         "no top-k, no top-p, no repetition penalty unless noted",
        "conditions": {},
    }

    conditions = [(f"T={temp}", temp, 1.0) for temp in TEMPS]
    conditions.append(("T=1.0, top_p=0.9", 1.0, 0.9))

    for label, temp, top_p in conditions:
        t0 = time.time()
        pooled = []
        per_prompt = {}
        for pi, (pname, prompt) in enumerate(PROMPTS.items()):
            seed = SEED + int(temp * 100) * 1000 + pi * 100
            samples = gen_batch(model, tok, prompt, temp, N, top_p=top_p, seed=seed)
            per_prompt[pname] = {"summary": summarize(samples), "samples": samples}
            pooled.extend(samples)
        results["conditions"][label] = {
            "temperature": temp,
            "top_p": top_p,
            "pooled": summarize(pooled),
            "per_prompt": per_prompt,
            "seconds": round(time.time() - t0, 1),
        }
        print(f"{label}: pooled={results['conditions'][label]['pooled']} "
              f"({time.time() - t0:.0f}s)", flush=True)

    # Softmax demo: fixed context, real logits, tempered distributions.
    ids = tok(DEMO_CONTEXT, return_tensors="pt").input_ids
    with torch.no_grad():
        logits = model(ids).logits[0, -1].float()
    demo = {"context": DEMO_CONTEXT, "temps": {}}
    for temp in (0.5, 1.0, 1.5):
        probs = torch.softmax(logits / temp, dim=-1)
        entropy = float(-(probs * torch.log2(probs + 1e-12)).sum())
        top = torch.topk(probs, 5)
        demo["temps"][str(temp)] = {
            "entropy_bits": round(entropy, 3),
            "top5": [
                {"token": tok.decode([int(i)]), "prob": round(float(p), 4)}
                for p, i in zip(top.values, top.indices)
            ],
        }
    results["softmax_demo"] = demo
    print("softmax demo:", json.dumps(demo, indent=1))

    results["total_seconds"] = round(time.time() - t_start, 1)
    with open("results.json", "w") as f:
        json.dump(results, f, indent=1)
    print(f"wrote results.json in {results['total_seconds']}s")


if __name__ == "__main__":
    main()
