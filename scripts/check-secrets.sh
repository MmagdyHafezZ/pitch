#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
# shellcheck source=/dev/null
. "$REPO_ROOT/scripts/install-detect-secrets.sh"

run_detect_secrets() {
  "${DETECT_SECRETS_CMD[@]}" "$@"
}

echo "🔍 Scanning for secrets (staged files only)..."

# Ensure detect-secrets (IBM fork by default) is available
if ! resolve_detect_secrets_cmd; then
  echo "⚠️  detect-secrets not found. Installing IBM fork..."
  ensure_detect_secrets_installed
fi

# Collect staged files (Added/Copied/Modified/Renamed/Typechanged)
STAGED="$(git diff --cached --name-only --diff-filter=ACMRT || true)"
[ -z "$STAGED" ] && { echo "✅ Nothing staged."; exit 0; }

# Mirror staged blobs to a temp dir so we scan the EXACT content being committed
TMPDIR="$(mktemp -d)"
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

echo "$STAGED" | while IFS= read -r f; do
  # Skip deleted/non-blob paths
  git cat-file -e ":$f" 2>/dev/null || continue
  mkdir -p "$TMPDIR/$(dirname "$f")"
  git show ":$f" > "$TMPDIR/$f" || true
done

# Nothing to scan?
find "$TMPDIR" -type f | grep -q . || { echo "✅ No scannable staged files."; exit 0; }

# Choose scan syntax (Yelp supports --config; IBM fork does not)
TMP_SCAN="$(mktemp)"
SCAN_ARGS=(scan --suppress-unscannable-file-warnings)
if run_detect_secrets scan --help 2>&1 | grep -q -- ' --config '; then
  [ -f .secrets.yaml ] && SCAN_ARGS=(scan --config .secrets.yaml --suppress-unscannable-file-warnings)
fi

run_detect_secrets "${SCAN_ARGS[@]}" "$TMPDIR" > "$TMP_SCAN"

# Python post-process: diff vs baseline and pretty-print file:line + snippet
python3 - "$TMP_SCAN" ".secrets.baseline" <<'PY'
import io, json, sys

scan_path, baseline_path = sys.argv[1], sys.argv[2]

def load_json(path):
    try:
        with io.open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def iter_findings(doc):
    if not isinstance(doc, dict): return
    results = doc.get("results")
    if isinstance(results, dict):
        items = results.items()
    elif isinstance(results, list):
        items = [(it.get("filename") or it.get("file") or "<unknown>", [it]) for it in results]
    else:
        return
    for filename, arr in items:
        if not isinstance(arr, list): continue
        for rec in arr:
            if not isinstance(rec, dict): continue
            line = rec.get("line_number") or rec.get("lineNumber") or 0
            typ  = rec.get("type") or rec.get("plugin_name") or "secret"
            hsh  = rec.get("hashed_secret") or rec.get("secret_hash") or rec.get("secret") or ""
            ctx  = rec.get("line") or ""
            yield {
                "file": filename,
                "line": int(line) if str(line).isdigit() else 0,
                "type": str(typ),
                "hash": str(hsh),
                "context": str(ctx).rstrip("\n"),
            }

cur = load_json(scan_path) or {}
base = load_json(baseline_path)

cur_list = list(iter_findings(cur))

if not base:
    if cur_list:
        print(f"\n❌ Secrets detected in staged files and no baseline exists! ({len(cur_list)} found)\n")
        print("Details:")
        for f in cur_list:
            print(f"{f['file']}:{f['line']}: {f['type']}")
            if f["context"]: print(f"    {f['context']}")
        print("\n👉 Create a baseline you can review:")
        print("   detect-secrets scan --suppress-unscannable-file-warnings > .secrets.baseline")
        sys.exit(1)
    print("✅ No secrets in staged files.")
    sys.exit(0)

base_hashes = {f["hash"] for f in iter_findings(base) if f.get("hash")}
new = [f for f in cur_list if f.get("hash") and f["hash"] not in base_hashes]

if new:
    print("\n❌ New secrets detected in staged files!")
    print(f"Count: {len(new)}\n")
    print("Details:")
    for f in new:
        print(f"{f['file']}:{f['line']}: {f['type']}")
        if f["context"]: print(f"    {f['context']}")
    print("\nWhat to do next:")
    print("• If false positives, mark them allowed:")
    print("    pnpm secrets:allow <file>[:line]")
    print("  (or: detect-secrets audit .secrets.baseline)")
    print("• If real secrets, remove/rotate and use env/secret manager.")
    sys.exit(1)

print("✅ No new secrets detected in staged files!")
sys.exit(0)
PY

status=$?
rm -f "$TMP_SCAN"
exit $status
