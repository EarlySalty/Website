import glob
import json

ALLE = []
for fn in sorted(glob.glob("urn_check_*.json")):
    if fn == "urn_check_ids.json":
        continue
    with open(fn) as f:
        ALLE.append(json.load(f))

def regel(spruenge):
    nach_interval = {}
    for s in spruenge:
        nach_interval.setdefault(s["t"], []).append(s["d"])
    deliverien = []
    for t in sorted(nach_interval):
        ds = nach_interval[t]
        dmin = min(ds)
        if dmin > 0 and sum(1 for d in ds if d == dmin) >= 5:
            deliverien.append((t, dmin, len(ds)))
    return deliverien

gesamt_regel = 0
gesamt_offensichtlich = 0
for d in ALLE:
    ti = {c: i for i, c in enumerate(d["columns"])}
    matches = {}
    for row in d["rows"]:
        mid = row[ti["match_id"]]
        matches.setdefault(mid, []).append(row)
    for mid, rows in sorted(matches.items()):
        print(f"=== Match {mid} ===")
        for row in sorted(rows, key=lambda r: (r[ti["team"]], r[ti["player_slot"]])):
            sp = row[ti["spruenge"]] or []
            kurz = " ".join(f"@{s['t']}:+{s['d']}" for s in sp)
            print(f"  {row[ti['team']] } Slot {row[ti['player_slot']]:2d}: {kurz}")
        deliverien = {}
        for team in ("Team0", "Team1"):
            team_rows = [r for r in rows if r[ti["team"]] == team]
            if not team_rows:
                continue
            dl = regel(team_rows[0][ti["spruenge"]] or [])
            gemeinsame = {}
            for r in team_rows:
                for s in r[ti["spruenge"]] or []:
                    gemeinsame.setdefault(s["t"], []).append(s["d"])
            for t, ds in sorted(gemeinsame.items()):
                pos = [x for x in ds if x > 0]
                if len(pos) >= 5 and len(set(pos)) == 1:
                    print(f"  SICHTBARE GEMEINSAME ABGABE {team} @{t}: +{pos[0]} bei {len(pos)} von 6")
                    gesamt_offensichtlich += 1
            deliverien[team] = dl
            for t, dmin, n in dl:
                print(f"  REGEL-ABGABE {team} @{t}: min +{dmin}, {n} Spieler positiv")
            gesamt_regel += len(dl)
print(f"Regel-Abgaben gesamt: {gesamt_regel}, offensichtlich gemeinsame Abgaben gesamt: {gesamt_offensichtlich}")
