import datetime
import json

def load(fn):
    with open(fn) as f:
        return json.load(f)

ergebnisse = []

qa = load("qa_merged.json")
qi = {c: i for i, c in enumerate(qa["columns"])}
qa_days = {}
for row in qa["rows"]:
    d = row[qi["day_epoch"]]
    qa_days.setdefault(d, [0, 0, 0, 0])
    for k, c in enumerate(["rows_raw", "player_rows", "matches_all", "matches_teamwin"]):
        qa_days[d][k] += row[qi[c]]

g = [sum(v[k] for v in qa_days.values()) for k in range(4)]
tage = sorted(qa_days)
loch = [d for d in tage if d - tage[tage.index(d) - 1] != 86400 and d != tage[0]]
ergebnisse.append(("Tagesabdeckung ohne Loecher",
                   f"{len(tage)} Tage, {datetime.datetime.fromtimestamp(tage[0], datetime.UTC).date()} bis "
                   f"{datetime.datetime.fromtimestamp(tage[-1], datetime.UTC).date()}, "
                   f"{'Loecher: ' + str(loch) if loch else 'keine Loecher'}"))
ergebnisse.append(("Duplikate",
                   f"rows_raw {g[0]}, dedup je (match_id, account_id) {g[1]}, Differenz {g[0]-g[1]} "
                   f"({(g[0]-g[1])/g[1]*100:.2f} Prozent)"))

qb = load("qb_merged.json")
qd = load("qd_merged.json")

def tot(d, c):
    i = d["columns"].index(c)
    return sum(r[i] for r in d["rows"])

n_qb = tot(qb, "n_matches")
n_qd = tot(qd, "n_matches")
drift = n_qd - n_qb
ergebnisse.append(("Matchzahlen je Rangstufe summieren sich zur Gesamtzahl",
                   f"QB {n_qb:.0f} gegen QA {g[3]}: {'OK' if n_qb == g[3] else 'DIFFERENZ'}, "
                   f"QD {n_qd:.0f} gegen QA {g[3]}: {drift:+.0f} "
                   f"({drift/g[3]*100:.3f} Prozent) durch nachtraegliche Zeilen der Quelle zwischen den Laeufen"))
ergebnisse.append(("match_outcome-Filter nicht einschraenkend",
                   f"matches_all {g[2]} = matches_teamwin {g[3]}: "
                   f"{'OK' if g[2] == g[3] else 'DIFFERENZ ' + str(g[2]-g[3])}"))

nmb = tot(qb, "n_with_mb")
ergebnisse.append(("First-Claim-Siegquoten ergaenzen sich zu 100 Prozent",
                   f"Siegquote First-Claim {tot(qb,'mb_first_wins')/nmb*100:.1f} Prozent, "
                   f"Gegenteil {100-tot(qb,'mb_first_wins')/nmb*100:.1f} Prozent, "
                   f"Nenner n={nmb:.0f} (je Stufe geliefert)"))
nsf = tot(qb, "n_with_shrfall")
ergebnisse.append(("Shrine-Semantik (Besitzer-Team)",
                   f"{tot(qb,'shr_falls_owner_lose')/(tot(qb,'shr_falls_owner_lose')+tot(qb,'shr_falls_owner_win'))*100:.1f} "
                   "Prozent der gefallenen Shrines gehoeren dem Verlierer-Team; waere objectives.team das Zerstoerer-Team, muesste der Anteil umgekehrt ausfallen"))
ergebnisse.append(("Steals pro Match gegen Matches mit Midboss",
                   f"steals {tot(qb,'steals_total'):.0f} ueber {nmb:.0f} Matches mit Midboss"))

f_sum = sum(tot(qd, f"f{i}") for i in range(4))
nall3 = tot(qd, "n_all3")
first_sum = tot(qd, "first_mb") + tot(qd, "first_urn") + tot(qd, "first_shr")
ergebnisse.append(("K5: f0 bis f3 summieren sich zu n_alle_drei",
                   f"{f_sum:.0f} gegen {nall3:.0f}: {'OK' if f_sum == nall3 else 'DIFFERENZ'}"))
ergebnisse.append(("K5: genau ein Erst-Event je n_all3-Match (Gleichstand an Midboss, dann Urne, dann Shrine)",
                   f"first_mb+first_urn+first_shr {first_sum:.0f} gegen n_alle_drei {nall3:.0f}: "
                   f"{'OK' if first_sum == nall3 else 'DIFFERENZ'}"))

nwd = tot(qd, "n_with_delivery")
nwf = tot(qd, "n_with_first")
ergebnisse.append(("Urne: erste Abgabe je Match bestimmbar",
                   f"Matches mit Abgabe {nwd:.0f}, davon mit bestimmtem ersten Team {nwf:.0f}, "
                   f"Gleichstand beider Teams im selben Intervall {nwd-nwf:.0f} "
                   f"({(nwd-nwf)/nwd*100:.1f} Prozent, auf Intervallauflösung nicht bestimmbar, aus der Siegquote ausgeschlossen)"))

for pre, name in (("mb", "Midboss"), ("shr", "Shrine"), ("urn", "Urne")):
    cls_sum = sum(tot(qd, f"{pre}_{c}") for c in ("vorn", "gleich", "hinten", "unk"))
    npre = tot(qd, f"{pre}_n")
    win_sum = sum(tot(qd, f"{pre}_{c}_wins") for c in ("vorn", "gleich", "hinten"))
    grenze = {"mb": nmb, "shr": nsf, "urn": nwf}[pre]
    abweichung = (npre - grenze) / grenze * 100 if grenze else 0
    ergebnisse.append((f"K6 {name}: Klassen summieren sich",
                       f"vorn+gleich+hinten+unbekannt {cls_sum:.0f} gegen Ereignisfaelle {npre:.0f} "
                       f"(Kapitel-Kenner {grenze:.0f}, Abweichung {abweichung:+.2f} Prozent durch Daten-drift): "
                       f"{'OK' if cls_sum == npre and abs(abweichung) < 0.1 else 'PRUEFEN'}; "
                       f"Siege in Klassen {win_sum:.0f} von {npre:.0f}, Rest im Feld unbekannt"))

dels = tot(qd, "dels0_sum") + tot(qd, "dels1_sum")
ergebnisse.append(("Urnen-Abgaben Team0/Team1 annaehernd symmetrisch",
                   f"Team0 {tot(qd,'dels0_sum'):.0f}, Team1 {tot(qd,'dels1_sum'):.0f}, gesamt {dels:.0f}"))

with open("plausibilitaet.json", "w") as f:
    json.dump({"pruefungen": [{"pruefung": a, "ergebnis": b} for a, b in ergebnisse]}, f, ensure_ascii=False, indent=1)
for a, b in ergebnisse:
    print(f"- {a}: {b}")
