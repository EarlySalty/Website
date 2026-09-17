import glob
import json

def load(fn):
    with open(fn) as f:
        return json.load(f)

files = sorted(glob.glob("qd_D_*.json"))
print("Tag-Dateien:", len(files))
cols = None
acc = {}
for fn in files:
    d = load(fn)
    cols = d["columns"]
    idx = {c: i for i, c in enumerate(cols)}
    for row in d["rows"]:
        tier = row[idx["tier"]]
        if tier not in acc:
            acc[tier] = [0.0] * len(cols)
        for j, c in enumerate(cols):
            if c == "tier":
                continue
            acc[tier][j] += row[j] if row[j] is not None else 0.0

rows = [[t if c == "tier" else acc[t][j] for j, c in enumerate(cols)] for t in sorted(acc)]
out = {"columns": cols, "rows": rows}
with open("qd_merged.json", "w") as f:
    json.dump(out, f)

import os

w1 = "qd_W1.json" if os.path.exists("qd_W1.json") else None
ti = {c: i for i, c in enumerate(cols)}
days_total = sum(r[ti["n_matches"]] for r in rows)
print(f"Tage gesamt: {days_total:.0f}")
if w1:
    w1 = load(w1)
    w1_total = sum(r[ti["n_matches"]] for r in w1["rows"])

w1_days = [fn for fn in files if "20260813" <= fn[5:13] <= "20260819"]
acc1 = {}
for fn in w1_days:
    d = load(fn)
    idx = {c: i for i, c in enumerate(d["columns"])}
    for row in d["rows"]:
        t = row[idx["tier"]]
        if t not in acc1:
            acc1[t] = [0.0] * len(d["columns"])
        for j, c in enumerate(d["columns"]):
            if c != "tier":
                acc1[t][j] += row[j] if row[j] is not None else 0.0
if w1:
    ok = True
    for row in w1["rows"]:
        t = row[0]
        for j, c in enumerate(w1["columns"]):
            if c == "tier":
                continue
            if abs(acc1[t][j] - (row[j] or 0)) > 0.5:
                print("DIFF", t, c, acc1[t][j], row[j])
                ok = False
    print("W1-Kreuzcheck bestanden:", ok)
else:
    print("W1-Kreuzcheck uebersprungen (keine qd_W1.json)")
