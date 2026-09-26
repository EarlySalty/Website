import json

CHECK_FILES = [f"urn_check_{i}.json" for i in range(4)]

def lade_abgaben():
    abgaben = []
    for fn in CHECK_FILES:
        res = json.load(open(fn))
        spieler = {}
        for match_id, team, slot, spruenge in res["rows"]:
            spieler.setdefault((match_id, team), []).append((slot, spruenge))
        for (match_id, team), liste in sorted(spieler.items()):
            deltas = {}
            for slot, spruenge in liste:
                for s in spruenge:
                    deltas.setdefault(s["t"], []).append((slot, s["d"]))
            for t in sorted(deltas):
                eintraege = deltas[t]
                positive = [(slot, d) for slot, d in eintraege if d > 0]
                if not positive:
                    continue
                dmin = min(d for _, d in positive)
                an_min = sum(1 for _, d in positive if d == dmin)
                if dmin <= 0 or an_min < 5:
                    continue
                maxd = max(d for _, d in positive)
                an_max = sum(1 for _, d in positive if d == maxd)
                if maxd > dmin and an_max == 1:
                    laeufer = next(slot for slot, d in positive if d == maxd)
                else:
                    laeufer = None
                abgaben.append({
                    "match_id": match_id, "team": team, "stuetzstelle_s": t,
                    "min_zuwachs": dmin, "spieler_am_min": an_min,
                    "max_zuwachs": maxd, "spieler_am_max": an_max,
                    "laeufer_slot": laeufer,
                })
    return abgaben

def main():
    abgaben = lade_abgaben()
    bekannt = [a for a in abgaben if a["laeufer_slot"] is not None]
    alle_gleich = [a for a in abgaben if a["spieler_am_min"] == 6]
    plan5 = [a for a in abgaben if a["spieler_am_min"] == 5]
    ergebnis = {
        "stand": "2026-09-18",
        "grundlage": "urn_check_0.json bis urn_check_3.json, dieselben 20 Zufalls-Matches wie Paket A",
        "regel_abgaben": len(abgaben),
        "davon_alle_6_gleich": len(alle_gleich),
        "davon_5_von_6_gleich": len(plan5),
        "laeufer_bekannt": len(bekannt),
        "laeufer_unbekannt": len(abgaben) - len(bekannt),
        "trefferquote_lauefer_prozent": round(len(bekannt) / len(abgaben) * 100, 1),
        "regel": "Laeufer = eindeutiges Maximum des Zuwachses im Abgabe-Intervall und ueber dem Team-Minimum; Gleichstand oder fehlender Mehrzuwachs unbekannt",
        "abgaben": sorted(abgaben, key=lambda a: (a["match_id"], a["team"], a["stuetzstelle_s"])),
    }
    with open("urn_lauefer_check.json", "w") as f:
        json.dump(ergebnis, f, ensure_ascii=False, indent=1)
    assert len(abgaben) == 83, len(abgaben)
    assert len(alle_gleich) == 57, len(alle_gleich)
    assert len(plan5) == 26, len(plan5)
    assert len(bekannt) == 26
    for a in bekannt:
        assert a["spieler_am_min"] == 5 and a["spieler_am_max"] == 1
        assert a["max_zuwachs"] > a["min_zuwachs"]
    for a in alle_gleich:
        assert a["laeufer_slot"] is None
    print("83 Regel-Abgaben bestaetigt: 57 alle 6 gleich, 26 mit 5 von 6 gleich")
    print("Laeufer bekannt:", len(bekannt), "von", len(abgaben),
          "=", ergebnis["trefferquote_lauefer_prozent"], "Prozent")
    print("ur-check-ok -> urn_lauefer_check.json")

if __name__ == "__main__":
    main()
