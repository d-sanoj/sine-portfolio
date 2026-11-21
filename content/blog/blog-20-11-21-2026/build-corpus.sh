#!/usr/bin/env bash
# Builds the log-triage corpus: 10 real failing logs with known root causes.
# - logs 01-04: verbatim GitHub Actions logs, downloaded with `gh run view --log`
# - logs 05-10: reproductions — the real tool run on a real repo copy in /tmp
#   with a real defect introduced (same defect class as a failure that
#   actually happened in these repos). Nothing is edited in the real repos.
set -u
CORPUS=~/workspace/goals/daily-ai-ml-and-data-blog/hidden_files/log-corpus
REPRO=/tmp/log-repro
VENV=~/workspace/jokeGPT/.venv/bin
rm -rf "$REPRO" && mkdir -p "$REPRO" "$CORPUS"

# --- 01-04: verbatim CI logs ---------------------------------------------
cp "$CORPUS/run-44135960638.log" "$CORPUS/log-01-chrome-port.txt"
cp "$CORPUS/run-44315594718.log" "$CORPUS/log-02-missing-cover-18.txt"
cp "$CORPUS/run-44542602124.log" "$CORPUS/log-03-missing-cover-19.txt"
cp "$CORPUS/run-44749632166.log" "$CORPUS/log-04-missing-cover-20.txt"

# --- 05: mypy, missing stubs (the LearnLLM capstone-ci failure) -----------
mkdir -p "$REPRO/mypy"
cat > "$REPRO/mypy/check_yaml.py" <<'EOF'
"""Minimal reproduction of the LearnLLM capstone-ci failure:
PyYAML is installed but ships no type stubs, and types-PyYAML is not."""
import yaml


def load_config(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh)
EOF
(cd "$REPRO/mypy" && "$VENV/mypy" check_yaml.py > "$CORPUS/log-05-mypy-stubs.txt" 2>&1; true)

# --- 06: pytest, one failing assertion ------------------------------------
cp -r ~/workspace/retriever-doc-answer "$REPRO/retriever-tb"
rm -rf "$REPRO/retriever-tb/.git" "$REPRO/retriever-tb/tests/__pycache__"
# Flip a true ordering assertion so it really fails.
sed -i 's/assert scores\[0\] > scores\[1\] > scores\[2\]/assert scores[0] < scores[1]  # BROKEN: flipped for the corpus/' \
  "$REPRO/retriever-tb/tests/test_scorers.py"
(cd "$REPRO/retriever-tb" && "$VENV/python" -m pytest tests/test_scorers.py -q > "$CORPUS/log-06-pytest-traceback.txt" 2>&1; true)

# --- 07: ruff, real violations --------------------------------------------
mkdir -p "$REPRO/ruff"
cat > "$REPRO/ruff/messy.py" <<'EOF'
"""A file with real lint violations: an unused import and an undefined name."""
import os  # unused


def greet(name):
    return f"Hello, {undefined_name}!"
EOF
(cd "$REPRO/ruff" && "$VENV/ruff" check messy.py > "$CORPUS/log-07-ruff.txt" 2>&1; true)

# --- 08: node, syntax error in the build script ---------------------------
cp -r ~/workspace/sine-portfolio "$REPRO/sine-syntax"
rm -rf "$REPRO/sine-syntax/.git" "$REPRO/sine-syntax/node_modules" \
  "$REPRO/sine-syntax/dist" "$REPRO/sine-syntax/data/generated"
sed -i 's|^import fs from .node:fs.;|import fs from '"'"'node:fs'"'"';\nconst broken = ; // BROKEN: syntax error for the corpus|' \
  "$REPRO/sine-syntax/scripts/build.js"
(cd "$REPRO/sine-syntax" && npm run build:dist > "$CORPUS/log-08-node-syntax.txt" 2>&1; true)

# --- 09: npm ci, version that does not exist ------------------------------
mkdir -p "$REPRO/npm-bad-version"
cp ~/workspace/sine-portfolio/package.json ~/workspace/sine-portfolio/package-lock.json "$REPRO/npm-bad-version/"
sed -i 's/"esbuild": "0.24.0"/"esbuild": "99.99.99"/' "$REPRO/npm-bad-version/package.json"
sed -i 's/"esbuild": "0.24.0"/"esbuild": "99.99.99"/; s/"version": "0.24.0",/"version": "99.99.99",/' "$REPRO/npm-bad-version/package-lock.json"
(cd "$REPRO/npm-bad-version" && npm ci --ignore-scripts > "$CORPUS/log-09-npm-ci-bad-version.txt" 2>&1; true)

# --- 10: pytest, one broken import fails every test -----------------------
cp -r ~/workspace/retriever-doc-answer "$REPRO/retriever-cascade"
rm -rf "$REPRO/retriever-cascade/.git" "$REPRO/retriever-cascade/tests/__pycache__"
sed -i '1i import _missing_dep_xyz  # BROKEN: import that does not exist, for the corpus' \
  "$REPRO/retriever-cascade/tests/conftest.py"
(cd "$REPRO/retriever-cascade" && "$VENV/python" -m pytest tests/ -q > "$CORPUS/log-10-pytest-cascade.txt" 2>&1; true)

echo "--- line counts ---"
wc -l "$CORPUS"/log-*.txt
