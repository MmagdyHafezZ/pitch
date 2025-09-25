#!/usr/bin/env python3
import sys, os, io, json, subprocess, tempfile, shutil

BASELINE = ".secrets.baseline"

USAGE = """\
Usage:
  pnpm secrets:allow <file>[:line]

Marks matching finding(s) as false positives (is_secret=false) in .secrets.baseline.
• If :line is omitted, all findings in <file> are allowed.
"""

def run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or f"command failed: {' '.join(cmd)}")
    return p.stdout

def load_json(path):
    try:
        with io.open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def save_json(path, data):
    tmp = path + ".tmp"
    with io.open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)

def staged_or_working_read(path):
    try:
        return run(["git", "show", f":{path}"])
    except Exception:
        with io.open(path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()

def scan_text(filename, text):
    tmpd = tempfile.mkdtemp()
    try:
        target = os.path.join(tmpd, filename)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with io.open(target, 'w', encoding='utf-8') as f:
            f.write(text)
        out = run(["detect-secrets", "scan", "--suppress-unscannable-file-warnings", tmpd])
        return json.loads(out)
    finally:
        shutil.rmtree(tmpd, ignore_errors=True)

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
            yield {
                "file": filename,
                "line": int(rec.get("line_number") or rec.get("lineNumber") or 0),
                "type": str(rec.get("type") or rec.get("plugin_name") or "secret"),
                "hash": str(rec.get("hashed_secret") or rec.get("secret_hash") or rec.get("secret") or ""),
            }

def main():
    if len(sys.argv) != 2 or sys.argv[1] in {"-h","--help"}:
        print(USAGE); sys.exit(2)
    arg = sys.argv[1]
    if ":" in arg:
        path, line_s = arg.split(":", 1)
        try: line = int(line_s)
        except ValueError: print("Line must be an integer.", file=sys.stderr); sys.exit(2)
    else:
        path, line = arg, None

    base = load_json(BASELINE)
    if not base:
        print(f"Baseline {BASELINE} not found. Create it first:\n  detect-secrets scan --suppress-unscannable-file-warnings > {BASELINE}", file=sys.stderr)
        sys.exit(1)

    text = staged_or_working_read(path)
    scan = scan_text(path, text)
    findings = [f for f in iter_findings(scan) if f["file"] == path]
    if not findings:
        print(f"No findings for {path}. Nothing to allow.")
        return

    # Select findings to allow
    if line is not None:
        target = min(findings, key=lambda f: abs(f["line"] - line))
        allow_hashes = {target["hash"]}
        print(f"Allowing closest finding at line ~{target['line']} (type={target['type']}).")
    else:
        allow_hashes = {f["hash"] for f in findings}
        print(f"Allowing {len(allow_hashes)} finding(s) in {path}.")

    results = base.get("results")
    if not isinstance(results, dict):
        results = {}
        base["results"] = results

    bucket = results.get(path, [])
    by_hash = {}
    for rec in bucket:
        h = rec.get("hashed_secret") or rec.get("secret_hash") or rec.get("secret")
        if h: by_hash[h] = rec

    changed = False
    for h in allow_hashes:
        if h in by_hash:
            rec = by_hash[h]
            if rec.get("is_secret") not in (False, "false"):
                rec["is_secret"] = False
                changed = True
        else:
            bucket.append({
                "hashed_secret": h,
                "is_secret": False,
                "line_number": line or 0,
                "type": "allowed",
            })
            changed = True

    results[path] = bucket
    if changed:
        try: shutil.copyfile(BASELINE, BASELINE + ".bak")
        except Exception: pass
        save_json(BASELINE, base)
        print(f"✅ Updated {BASELINE}.")
    else:
        print("No changes needed (already allowed).")

if __name__ == "__main__":
    main()
