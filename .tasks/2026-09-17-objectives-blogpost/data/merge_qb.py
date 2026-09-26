import json
import sys

def merge(kind, files):
    cols = None
    acc = {}
    for fn in files:
        with open(fn) as f:
            d = json.load(f)
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
    rows = []
    for tier in sorted(acc):
        r = [tier if c == "tier" else acc[tier][j] for j, c in enumerate(cols)]
        rows.append(r)
    out = {"columns": cols, "rows": rows}
    with open(f"{kind}_merged.json", "w") as f:
        json.dump(out, f)
    return cols, rows

kind = sys.argv[1]
cols, rows = merge(kind, [f"{kind}_{w}.json" for w in ["W1", "W2", "W3", "W4", "W5"]])
print("gemergt:", kind, len(rows), "Stufen")
ti = {c: i for i, c in enumerate(cols)}
for r in rows:
    n = r[ti["n_matches"]]
    nmb = r[ti["n_with_mb"]]
    first_w = r[ti["mb_first_wins"]] / nmb * 100 if nmb else 0
    mb_t_mean = r[ti["mb_first_t_sum"]] / nmb if nmb else 0
    steal_rate = r[ti["steals_total"]] / nmb if nmb else 0
    steal_w = r[ti["steal_wins_total"]] / r[ti["steals_total"]] * 100 if r[ti["steals_total"]] else 0
    nsf = r[ti["n_with_shrfall"]]
    shr_t_mean = r[ti["shr_first_t_sum"]] / nsf if nsf else 0
    shr_w = r[ti["shr_first_wins"]] / nsf * 100 if nsf else 0
    gap_mean = r[ti["shr_end_gap_sum"]] / nsf if nsf else 0
    ab = r[ti["n_abandon"]] / n * 100
    fo_win = r[ti["shr_falls_owner_win"]]
    fo_lose = r[ti["shr_falls_owner_lose"]]
    sem = fo_win / (fo_win + fo_lose) * 100 if (fo_win + fo_lose) else 0
    print(f"Stufe {int(r[0]):2d}: n={int(n):6d} abbr={ab:4.1f}% | MB: {nmb/n*100:5.1f}% mit, "
          f"first {mb_t_mean:6.0f}s, FirstClaim-Sieg {first_w:5.1f}%, Steal/Match {steal_rate:.2f}, "
          f"Steal-Sieg {steal_w:5.1f}% | Shrine: {nsf/n*100:5.1f}% gefallen, first {shr_t_mean:6.0f}s, "
          f"FirstDestroyer-Sieg {shr_w:5.1f}%, Gap {gap_mean:6.0f}s | Semantik owner==winner: {sem:5.2f}%")
tot_n = sum(r[ti["n_matches"]] for r in rows)
tot_fo = sum(r[ti["shr_falls_owner_win"]] + r[ti["shr_falls_owner_lose"]] for r in rows)
tot_fow = sum(r[ti["shr_falls_owner_win"]] for r in rows)
print(f"gesamt n={tot_n}, Shrine-Fälle={tot_fo}, owner==winner {tot_fow/tot_fo*100:.2f}%")
