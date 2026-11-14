#!/usr/bin/env python3
"""Reproduce every number in the blog post 'I decoded all 100,277
tokens in GPT-4's vocabulary' (sanoj.dev, 2026-11-14).

Needs: pip install tiktoken
Run:   python3 measure-tokens.py
Reads udhr-article-1.json (same folder) and writes results.json.

What it does:
  1. Decodes every entry of tiktoken's cl100k_base (GPT-3.5 Turbo /
     GPT-4) and o200k_base (GPT-4o) vocabularies and counts what is
     in them, by script and by kind.
  2. Counts the tokens of UDHR Article 1 in nine languages, in both
     encodings. The Thai text in the dataset carries an editor's
     bracketed alternative spelling, which is removed before counting
     (with it left in, Thai is 148 tokens on cl100k_base and 72 on
     o200k_base); this is disclosed in the post.
  3. Counts the tokens of the same eight products written five ways,
     plus a Python function formatted vs minified, a tool-call
     envelope vs its payload, and a few numbers.
"""
import json
import os
import re
import sys
import unicodedata

import tiktoken

HERE = os.path.dirname(os.path.abspath(__file__))


def script_of(s):
    scripts = set()
    for ch in s:
        o = ord(ch)
        if o < 128:
            continue
        name = unicodedata.name(ch, "")
        if "CJK" in name or "HIRAGANA" in name or "KATAKANA" in name:
            scripts.add("CJK/Japanese")
        elif "HANGUL" in name:
            scripts.add("Hangul")
        elif "CYRILLIC" in name:
            scripts.add("Cyrillic")
        elif "GREEK" in name:
            scripts.add("Greek")
        elif "ARABIC" in name:
            scripts.add("Arabic")
        elif "HEBREW" in name:
            scripts.add("Hebrew")
        elif "DEVANAGARI" in name:
            scripts.add("Devanagari")
        elif "BENGALI" in name:
            scripts.add("Bengali")
        elif "TAMIL" in name:
            scripts.add("Tamil")
        elif "TELUGU" in name:
            scripts.add("Telugu")
        elif "THAI" in name:
            scripts.add("Thai")
        elif "ETHIOPIC" in name:
            scripts.add("Ethiopic")
        elif "ARMENIAN" in name:
            scripts.add("Armenian")
        elif "GEORGIAN" in name:
            scripts.add("Georgian")
        elif "LATIN" in name:
            scripts.add("Latin-extended")
        else:
            scripts.add("Other non-ASCII")
    return scripts


def census(enc_name):
    enc = tiktoken.get_encoding(enc_name)
    n = enc.n_vocab
    cats = {"ascii_letters_word": 0, "ascii_other": 0, "digits": 0,
            "whitespace_only": 0, "punct_or_symbol": 0, "non_ascii": 0,
            "undecodable": 0}
    script_counts = {}
    byte_len = {}
    space_prefix = 0
    for i in range(n):
        try:
            b = enc.decode_single_token_bytes(i)
        except Exception:
            cats["undecodable"] += 1
            continue
        byte_len[len(b)] = byte_len.get(len(b), 0) + 1
        try:
            s = b.decode("utf-8")
        except UnicodeDecodeError:
            cats["undecodable"] += 1
            continue
        if s.strip() == "":
            cats["whitespace_only"] += 1
            continue
        if s.startswith(" ") or s.startswith("\n"):
            space_prefix += 1
        t = s.strip()
        if re.fullmatch(r"[0-9]+", t):
            cats["digits"] += 1
        elif re.fullmatch(r"[A-Za-z]+", t):
            cats["ascii_letters_word"] += 1
        elif all(ord(c) < 128 for c in s):
            if re.search(r"[A-Za-z]", s):
                cats["ascii_other"] += 1
            else:
                cats["punct_or_symbol"] += 1
        else:
            cats["non_ascii"] += 1
            for sc in script_of(s):
                script_counts[sc] = script_counts.get(sc, 0) + 1
    return {"n_vocab": n, "cats": cats, "space_prefix": space_prefix,
            "byte_len": {str(k): v for k, v in sorted(byte_len.items())},
            "scripts": dict(sorted(script_counts.items(),
                                   key=lambda kv: -kv[1]))}


def main():
    results = {}

    # --- 1. Language premium: UDHR Article 1 ---
    udhr = json.load(open(os.path.join(HERE, "udhr-article-1.json"),
                          encoding="utf-8"))
    # Thai: strip the editor's bracketed alternative spelling.
    udhr["Thai"] = re.sub(r"\[[^\]]*\]", "", udhr["Thai"])
    lang_rows = []
    for enc_name in ["cl100k_base", "o200k_base"]:
        enc = tiktoken.get_encoding(enc_name)
        base = None
        for lang, text in udhr.items():
            n_tok = len(enc.encode(text))
            if lang == "English":
                base = n_tok
            lang_rows.append({"enc": enc_name, "lang": lang,
                              "chars": len(text), "words": len(text.split()),
                              "tokens": n_tok,
                              "chars_per_token": round(len(text) / n_tok, 2),
                              "premium_vs_en": round(n_tok / base, 2)})
    results["language_premium"] = lang_rows
    print("Language premium (UDHR Article 1):")
    for r in lang_rows:
        print(f"  {r['enc']:12s} {r['lang']:22s} {r['tokens']:4d} tokens, "
              f"{r['premium_vs_en']:.2f}x English")

    # --- 2. Vocabulary census ---
    for enc_name in ["cl100k_base", "o200k_base"]:
        results[f"census_{enc_name}"] = census(enc_name)
        c = results[f"census_{enc_name}"]
        print(f"\nCensus {enc_name}: {c['n_vocab']:,} entries; "
              f"ASCII letter-runs {c['cats']['ascii_letters_word']:,}; "
              f"non-ASCII {c['cats']['non_ascii']:,} "
              f"({100 * c['cats']['non_ascii'] / c['n_vocab']:.1f}%)")

    # --- 3. Formatting tax ---
    enc = tiktoken.get_encoding("o200k_base")
    enc_c = tiktoken.get_encoding("cl100k_base")
    products = [
        ("Oak desk", 349.00, 12), ("Steel chair", 129.50, 40),
        ("Glass lamp", 59.99, 7), ("Wool rug", 199.00, 3),
        ("Ceramic vase", 45.00, 25), ("Leather sofa", 899.00, 2),
        ("Maple shelf", 149.99, 18), ("Cotton throw", 39.50, 60),
    ]
    prose = ("We sell eight products. The Oak desk costs $349.00 and we have 12 in stock. "
             "The Steel chair costs $129.50 and we have 40 in stock. The Glass lamp costs $59.99 "
             "and we have 7 in stock. The Wool rug costs $199.00 and we have 3 in stock. "
             "The Ceramic vase costs $45.00 and we have 25 in stock. The Leather sofa costs "
             "$899.00 and we have 2 in stock. The Maple shelf costs $149.99 and we have 18 in "
             "stock. The Cotton throw costs $39.50 and we have 60 in stock.")
    js = json.dumps([{"name": n, "price": p, "stock": s}
                     for n, p, s in products])
    md = ("| product | price | stock |\n|---|---|---|\n" +
          "\n".join(f"| {n} | {p:.2f} | {s} |" for n, p, s in products))
    pyd = ("products = [\n" +
           ",\n".join(f'    {{"name": "{n}", "price": {p}, "stock": {s}}}'
                      for n, p, s in products) + "\n]")
    csv = ("product,price,stock\n" +
           "\n".join(f"{n},{p:.2f},{s}" for n, p, s in products))
    formats = {"prose": prose, "json": js, "markdown_table": md,
               "python_dict": pyd, "csv": csv}
    fmt_rows = []
    print("\nFormatting tax (same eight products):")
    for name, text in formats.items():
        row = {"format": name, "chars": len(text),
               "tokens_o200k": len(enc.encode(text)),
               "tokens_cl100k": len(enc_c.encode(text))}
        fmt_rows.append(row)
        print(f"  {name:15s} {row['tokens_o200k']:4d} tokens (o200k)")
    results["formatting_tax"] = fmt_rows

    code_fmt = ('def total(items):\n    """Return the total price of the items."""\n'
                '    s = 0\n    for name, price, qty in items:\n'
                '        s += price * qty\n    return s\n')
    code_min = ('def total(items):\n s=0\n for n,p,q in items:s+=p*q\n'
                ' return s\n')
    code_rows = []
    for name, code in [("python_formatted", code_fmt),
                       ("python_minified", code_min)]:
        code_rows.append({"format": name, "chars": len(code),
                          "tokens_o200k": len(enc.encode(code)),
                          "tokens_cl100k": len(enc_c.encode(code))})
    results["code_tax"] = code_rows
    print(f"Code: formatted {code_rows[0]['tokens_o200k']} tokens, "
          f"minified {code_rows[1]['tokens_o200k']} tokens")

    payload = '{"product": "Oak desk", "quantity": 2}'
    envelope = ('{"tool": "place_order", "arguments": {"product": "Oak desk", "quantity": 2}, '
                '"tool_call_id": "call_9f2kx81", "type": "function"}')
    results["tool_call"] = {"payload_tokens": len(enc.encode(payload)),
                            "envelope_tokens": len(enc.encode(envelope))}
    print(f"Tool call: payload {results['tool_call']['payload_tokens']} tokens, "
          f"envelope {results['tool_call']['envelope_tokens']} tokens")

    nums = ["2026-11-14", "$1,234.56", "1000000", "1,000,000",
            "ORD-2026-11847", "3.14159265358979", "+1-312-555-0148"]
    num_rows = []
    for x in nums:
        toks = enc.encode(x)
        num_rows.append({"text": x, "tokens_o200k": len(toks),
                         "split": [enc.decode([t]) for t in toks]})
    results["numbers"] = num_rows
    print("Numbers:", "; ".join(f"{r['text']}={r['tokens_o200k']}"
                                for r in num_rows))

    json.dump(results, open(os.path.join(HERE, "results.json"), "w"),
              indent=1, ensure_ascii=False)
    print("\nWrote results.json")


if __name__ == "__main__":
    sys.exit(main())
