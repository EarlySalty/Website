import json

COLUMNS = ["rows_raw", "player_rows", "matches_all", "matches_teamwin"]
merged = {}
for w in ["W1", "W2", "W3", "W4", "W5"]:
    with open(f"qa_{w}.json") as f:
        d = json.load(f)
    cols = d["columns"]
    idx = {c: i for i, c in enumerate(cols)}
    for row in d["rows"]:
        key = (row[idx["day_epoch"]], row[idx["tier"]])
        if key not in merged:
            merged[key] = {c: 0 for c in COLUMNS}
        for c in COLUMNS:
            merged[key][c] += row[idx[c]]

out = {"columns": ["day_epoch", "tier"] + COLUMNS,
       "rows": [[k[0], k[1]] + [merged[k][c] for c in COLUMNS] for k in sorted(merged)]}
with open("qa_merged.json", "w") as f:
    json.dump(out, f)

import datetime
days = sorted(set(k[0] for k in merged))
print("Tage:", len(days), "erster:", datetime.datetime.utcfromtimestamp(days[0]).date(),
      "letzter:", datetime.datetime.utcfromtimestamp(days[-1]).date())
tiers = sorted(set(k[1] for k in merged))
print("Rangstufen:", tiers)
tot = {c: sum(v[c] for v in merged.values()) for c in COLUMNS}
print("Summen:", tot)
print("Duplikate gesamt (rows_raw - player_rows):", tot["rows_raw"] - tot["player_rows"])
per_day = {}
for (d, t), v in merged.items():
    per_day.setdefault(d, {c: 0 for c in COLUMNS})
    for c in COLUMNS:
        per_day[d][c] += v[c]
print("Matches je Tag (teamwin):")
for d in days:
    print(" ", datetime.datetime.utcfromtimestamp(d).date(), per_day[d]["matches_teamwin"])
print("Matches je Rangstufe (teamwin):")
for t in tiers:
    n = sum(v["matches_teamwin"] for (d, tt), v in merged.items() if tt == t)
    print(f"  Stufe {t}: {n}")
