import glob
import json

ALLE = []
for fn in sorted(glob.glob("urn_check_*.json")):
    if fn == "urn_check_ids.json":
        continue
    with open(fn) as f:
        ALLE.append(json.load(f))

def regel(team_rows, ti):
    gemeinsame = {}
    for r in team_rows:
        for s in r[ti["spruenge"]] or []:
            gemeinsame.setdefault(s["t"], []).append(s["d"])
    ergebnis = []
    for t in sorted(gemeinsame):
        ds = gemeinsame[t]
        pos = [x for x in ds if x > 0]
        dmin = min(pos) if pos else 0
        gleich = sum(1 for x in ds if x == dmin)
        if dmin > 0 and gleich >= 5:
            alle_gleich = len(pos) >= 5 and len(set(pos)) == 1
            ergebnis.append((t, dmin, gleich, len(ds), alle_gleich))
    return ergebnis

gesamt = 0
extra = 0
zeilen = []
for d in ALLE:
    ti = {c: i for i, c in enumerate(d["columns"])}
    matches = {}
    for row in d["rows"]:
        matches.setdefault(row[ti["match_id"]], []).append(row)
    for mid, rows in sorted(matches.items()):
        for team in ("Team0", "Team1"):
            team_rows = [r for r in rows if r[ti["team"]] == team]
            if not team_rows:
                continue
            for t, dmin, gleich, npos, alle in regel(team_rows, ti):
                gesamt += 1
                flag = "OK alle gleich" if alle else "GRENZFALL"
                if not alle:
                    extra += 1
                zeilen.append(f"{mid} {team} @{t}: min +{dmin}, {gleich} von 6 Spielern, {npos} positiv [{flag}]")

for z in zeilen:
    print(z)
print(f"Regel-Abgaben gesamt: {gesamt}, davon Grenzfaelle (nicht alle 6 gleich): {extra}")
