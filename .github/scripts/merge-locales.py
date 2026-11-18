#!/usr/bin/env python3
"""Loest Merge-Konflikte in locales/*.json per 3-Wege-Zusammenfuehrung der JSON-Baeume.

Aufruf im Repo mitten in einem konfliktbehafteten `git merge`:  python3 merge-locales.py
Fuer jede ungemergte Datei unter locales/ werden Basis (Stufe 1), unser (2) und deren (3) Stand gelesen:
- nur eine Seite hat einen Schluessel geaendert/neu angelegt: diese Aenderung gilt
- beide haben denselben Wert: egal
- beide haben unterschiedliche Werte: Konflikt wird gemeldet (Datei bleibt ungemergt)
"""
import json, subprocess, sys

def git_show(stage, path):
    r = subprocess.run(["git", "show", f":{stage}:{path}"], capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else None

MISSING = object()

def merge(base, ours, theirs, path, conflicts):
    if isinstance(ours, dict) and isinstance(theirs, dict):
        b = base if isinstance(base, dict) else {}
        out = {}
        for k in list(ours.keys()) + [k for k in theirs.keys() if k not in ours]:
            o = ours.get(k, MISSING); t = theirs.get(k, MISSING); bb = b.get(k, MISSING)
            if o is MISSING and bb is not MISSING and t == bb:      # wir haben geloescht, sie nicht angefasst
                continue
            if t is MISSING and bb is not MISSING and o == bb:      # sie haben geloescht, wir nicht angefasst
                continue
            if o is MISSING: out[k] = t; continue
            if t is MISSING: out[k] = o; continue
            out[k] = merge(bb if bb is not MISSING else None, o, t, path + [k], conflicts)
        return out
    if ours == theirs: return ours
    if base is not None and ours == base: return theirs
    if base is not None and theirs == base: return ours
    conflicts.append(".".join(path))
    return ours

unmerged = subprocess.run(["git", "diff", "--name-only", "--diff-filter=U"], capture_output=True, text=True).stdout.split()
files = [f for f in unmerged if f.startswith("locales/") and f.endswith(".json")]
failed = False
for f in files:
    base, ours, theirs = git_show(1, f), git_show(2, f), git_show(3, f)
    if ours is None or theirs is None:
        print(f"{f}: Stufe fehlt, bitte von Hand loesen"); failed = True; continue
    conflicts = []
    merged = merge(base, ours, theirs, [], conflicts)
    if conflicts:
        print(f"{f}: echte Konflikte bei {conflicts[:5]}"); failed = True; continue
    open(f, "w", encoding="utf-8").write(json.dumps(merged, indent=2, ensure_ascii=False) + "\n")
    subprocess.run(["git", "add", f], check=True)
    print(f"{f}: zusammengefuehrt")
if not files: print("keine ungemergten Locale-Dateien")
sys.exit(1 if failed else 0)
