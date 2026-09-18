import json

GROUPS = ["niedrig", "mittel", "hoch"]
FOLD_LABEL = "10+11"
EVENT_NAMEN = {"mb": "midboss", "urn": "urne", "shr": "shrine"}
SUM_KEYS = ("n", "wins", "n_vorn", "w_vorn", "n_gleich", "w_gleich",
            "n_hinten", "w_hinten", "n_unb", "w_unb", "steals")
SCHICHTUNG = (("vorn", "n_vorn", "w_vorn"), ("gleichauf", "n_gleich", "w_gleich"),
              ("hinten", "n_hinten", "w_hinten"), ("unbekannt", "n_unb", "w_unb"))


def load(fn):
    with open(fn) as f:
        return json.load(f)


def pct(x, n):
    if not n:
        return None
    return round(x / n * 100, 1)


def urn_raster(v):
    if v <= 900:
        return ((v + 179) // 180) * 180
    return 900 + ((v - 900 + 299) // 300) * 300


def klassen_gruppen(bins, n_von_bin, schwell):
    if not bins:
        return []
    if len(bins) == 1:
        return [list(bins)]
    tail_start = len(bins) - 1
    acc = n_von_bin(bins[-1])
    i = len(bins) - 2
    while i >= 1 and acc < schwell:
        acc += n_von_bin(bins[i])
        tail_start = i
        i -= 1
    gruppen = [[b] for b in bins[:tail_start]]
    while len(gruppen) > 1 and sum(n_von_bin(b) for b in gruppen[0]) < schwell:
        gruppen[1] = gruppen[0] + gruppen[1]
        gruppen.pop(0)
    if not gruppen:
        return [list(bins)]
    gruppen.append(list(bins[tail_start:]))
    return gruppen


def median_aus_bins(counts, breite):
    items = sorted((int(k), v) for k, v in counts.items() if v)
    gesamt = sum(v for _, v in items)
    if not gesamt:
        return None

    def wert(rank):
        cum = 0
        for k, v in items:
            if cum + v >= rank:
                frac = (rank - cum) / v
                return k + frac * breite if breite else float(k)
            cum += v
        return float(items[-1][0])

    if gesamt % 2:
        return round(wert((gesamt + 1) // 2))
    return round((wert(gesamt // 2) + wert(gesamt // 2 + 1)) / 2)


def main():
    a2 = load("a2_merged.json")
    nenner = {
        "mb": sum(int(s["n_mit_midboss"]) for s in load("kapitel-1.json")["stufen"]),
        "shr": sum(int(s["n_mit_shrinefall"]) for s in load("kapitel-3.json")["stufen"]),
        "urn": sum(int(s["n_mit_erster_abgabe"]) for s in load("kapitel-2.json")["stufen"]),
    }
    k6 = load("kapitel-6.json")
    k6_nenner = {pre: {"n": sum(int(s[f"{pre}_n"]) for s in k6["stufen"]),
                       "unb": sum(int(s[f"{pre}_unbekannt"]) for s in k6["stufen"])}
                 for pre in ("mb", "shr", "urn")}

    ohne_zeitpunkt = {e: {"n": 0, "wins": 0} for e in ("mb", "shr", "urn")}
    bins_nach_event = {}
    fuer_event = {}
    for z in a2["zellen"]:
        e = z["event"]
        if z["b0"] is None:
            ohne_zeitpunkt[e]["n"] += z["n"]
            ohne_zeitpunkt[e]["wins"] += z["wins"]
            continue
        b0 = urn_raster(z["b0"]) if e == "urn" else z["b0"]
        bins_nach_event.setdefault(e, set()).add(b0)
        ziel = fuer_event.setdefault((e, b0, z["grp"]), {k: 0 for k in SUM_KEYS})
        for k in SUM_KEYS:
            ziel[k] += z[k]

    integritaet_verletzungen = 0
    gepruefte_zellen = 0
    ereignisse = {}
    summen_assert = {}
    for e in ("mb", "shr", "urn"):
        bins = sorted(bins_nach_event.get(e, []))
        n_gesamt_event = sum(fuer_event.get((e, b, g), {"n": 0})["n"] for b in bins for g in GROUPS)

        def n_von_bin(b, e=e):
            return sum(fuer_event.get((e, b, g), {"n": 0})["n"] for g in GROUPS)

        schwell = max(1000, 0.005 * n_gesamt_event)
        gruppen = klassen_gruppen(bins, n_von_bin, schwell)
        klassen_liste = []
        for gi, grp_bins in enumerate(gruppen):
            letzte_offen = gi == len(gruppen) - 1
            if e == "urn":
                v = grp_bins[-1]
                untere = gruppen[gi - 1][-1] if gi > 0 else 0
                if letzte_offen:
                    label = f"über {untere} s" if untere else f"bis {v} s"
                else:
                    label = f"bis {v} s" if gi == 0 else f"{untere} bis {v} s"
                zeile = {"klasse": label, "stuetzpunkte_s": grp_bins}
            else:
                if letzte_offen:
                    zeile = {"klasse": f"ab {grp_bins[0]} s", "von_s": grp_bins[0], "bis_s": None}
                else:
                    nxt = gruppen[gi + 1][0]
                    zeile = {"klasse": f"{grp_bins[0]} bis {nxt} s", "von_s": grp_bins[0], "bis_s": nxt}
            per_gruppe = {}
            for g in GROUPS:
                agg = {k: 0 for k in SUM_KEYS}
                for b in grp_bins:
                    z = fuer_event.get((e, b, g))
                    if not z:
                        continue
                    for k in SUM_KEYS:
                        agg[k] += z[k]
                gepruefte_zellen += 1
                if agg["n"] != agg["n_vorn"] + agg["n_gleich"] + agg["n_hinten"] + agg["n_unb"]:
                    integritaet_verletzungen += 1
                if agg["wins"] != agg["w_vorn"] + agg["w_gleich"] + agg["w_hinten"] + agg["w_unb"]:
                    integritaet_verletzungen += 1
                schichtung = {key: {"n": agg[npref], "siege": agg[wpref],
                                    "siegquote_prozent": pct(agg[wpref], agg[npref])}
                              for key, npref, wpref in SCHICHTUNG}
                roh = {"n": agg["n"], "siege": agg["wins"],
                       "siegquote_prozent": pct(agg["wins"], agg["n"]),
                       "schichtung": schichtung}
                if e == "mb":
                    roh["steals"] = agg["steals"]
                    roh["anteil_steals_prozent"] = pct(agg["steals"], agg["n"])
                per_gruppe[g] = roh
            n_ges = sum(per_gruppe[g]["n"] for g in GROUPS)
            w_ges = sum(per_gruppe[g]["siege"] for g in GROUPS)
            zeile["ranggruppen"] = per_gruppe
            zeile["n_gesamt"] = n_ges
            zeile["siege_gesamt"] = w_ges
            zeile["siegquote_gesamt_prozent"] = pct(w_ges, n_ges)
            klassen_liste.append(zeile)
        summen_assert[e] = (sum(k["n_gesamt"] for k in klassen_liste), n_gesamt_event)

        gefaltet = {}
        for tier, counts in a2["hist"].get("hist_" + e, {}).items():
            label = FOLD_LABEL if tier in ("10", "11") else tier
            ziel = gefaltet.setdefault(label, {})
            for k, v in counts.items():
                ziel[k] = ziel.get(k, 0) + v
        medians = []
        for tier in sorted(gefaltet, key=lambda x: 10.5 if x == FOLD_LABEL else float(x)):
            if e == "urn":
                med = median_aus_bins(gefaltet[tier], 0)
            else:
                med = median_aus_bins({int(k) * 60: v for k, v in gefaltet[tier].items()}, 60)
            medians.append({"rang": tier, "median_sekunden": med})

        ereignisse[EVENT_NAMEN[e]] = {
            "zeitklassen": klassen_liste,
            "median_ereigniszeitpunkt_je_rangstufe": medians,
        }

    for e, (ist, soll) in summen_assert.items():
        if ist != soll:
            raise SystemExit(f"Summen-Assertion verletzt fuer {e}: Klassen {ist} != Zellen {soll}")

    kap7 = {
        "kapitel": 7,
        "titel": "Siegquote nach Zeitpunkt der Erst-Objectives",
        "einheit": "je Zeitklasse, Ranggruppe und Soul-Schicht",
        "definition": {
            "ereignisse": "erster Midboss-Claim, erste Urnen-Abgabe mit sichtbarem Sprung, erster Shrine-Fall; gleiche Definitionen wie Kapitel 1 bis 3, Ereignis-Team = Claim-Team, Zerstoerer-Team bzw. erstes Abgabe-Team",
            "zeitklassen_midboss_shrine": "5-Minuten-Klassen der Spielzeit, linke Grenze inklusive, rechte exklusiv; duenne Randklassen (unter max(1000, 0,5 Prozent) Ereignissen) mit der Nachbarklasse verschmolzen, letzte Klasse offen",
            "zeitklassen_urne": "Stuetzstellen-Raster der Urne (180 s bis 900 s in 180-s-Schritten, danach 300 s); Klasse = Intervall bis zum oberen Stuetzpunktwert (obere Grenze inklusive); wenige Matches mit unregelmaessigen Stuetzpunkten werden auf den naechsten Rasterpunkt gehoben; duenne Randklassen verschmolzen, letzte Klasse offen",
            "ranggruppen": "niedrig = Stufen 1 bis 4, mittel = 5 bis 7, hoch = 8 bis 11 (Stufen 10 und 11 wie in Kapitel 1 bis 6 zusammen)",
            "schichtung": "Soul-Vorsprung des Ereignis-Teams an der letzten Stuetzstelle vor dem Ereignis, Klassen wie Kapitel 6: vorn ueber 105 Prozent des Gegners, gleichauf 95 bis 105 Prozent, hinten unter 95 Prozent, unbekannt = vor erster Stuetzstelle oder fehlende Net-Worth-Werte",
            "steals": "Anteil der Midboss-Erste-Claims mit team_killed ungleich team_claimed am ersten Eintrag",
            "median": "Median des Ereigniszeitpunkts je Rangstufe, auf den Original-Stuetzpunkten; Midboss und Shrine aus 60-Sekunden-Histogrammen (innerhalb des Median-Bins linear interpoliert), Urne exakt",
            "leseweise": "Beobachtung, keine Wirkung; die Zeitklassen sind nicht randomisiert",
        },
        "ranggruppen_zuordnung": {"niedrig": "Stufen 1 bis 4", "mittel": "Stufen 5 bis 7", "hoch": "Stufen 8 bis 11"},
        "ereignisse": ereignisse,
        "grundgesamtheit": ("game_mode Normal, match_mode Ranked, match_outcome TeamWin, "
                            "2026-08-13 00:00 UTC bis 2026-09-15 23:59 UTC, tageweise 34 Chunks im "
                            "A2-Lauf vom 2026-09-18, clientseitig gemergt; Werte koennen minimal vom "
                            "QB/QD-Lauf vom 2026-09-17 abweichen (Daten-drift), Dedup je "
                            "(match_id, account_id) ueber neueste created_at"),
    }
    with open("kapitel-7.json", "w") as f:
        json.dump(kap7, f, ensure_ascii=False, indent=1)

    gegen = {}
    for e in ("mb", "shr", "urn"):
        ist = sum(k["n_gesamt"] for k in ereignisse[EVENT_NAMEN[e]]["zeitklassen"])
        gegen[e] = {
            "ist_zeitklassen": ist,
            "nenner_kapitel": nenner[e],
            "abweichung": ist - nenner[e],
            "abweichung_prozent": round((ist - nenner[e]) / nenner[e] * 100, 4),
            "ohne_zeitpunkt": ohne_zeitpunkt[e]["n"],
            "ohne_zeitpunkt_siege": ohne_zeitpunkt[e]["wins"],
            "nenner_k6_qd": k6_nenner[e]["n"],
            "abweichung_k6_inkl_ohne_zeitpunkt": ist + ohne_zeitpunkt[e]["n"] - k6_nenner[e]["n"],
        }

    hist_konsistenz = []
    for e in ("mb", "shr", "urn"):
        hist_ges = sum(sum(c.values()) for c in a2["hist"].get("hist_" + e, {}).values())
        zellen_ges = sum(z["n"] for z in a2["zellen"] if z["event"] == e and z["b0"] is not None)
        hist_konsistenz.append({"event": e, "hist": hist_ges, "zeitklassen": zellen_ges,
                                "differenz": hist_ges - zellen_ges})

    plaus = {
        "stand": "2026-09-18",
        "lauf": "A2, tageweise 34 Chunks, clientseitig gemergt",
        "tage": a2["tage"],
        "nenner_zeitklassen_gegen_kapitel": gegen,
        "zellen_integritaet": {
            "verletzungen": integritaet_verletzungen,
            "gepruefte_ranggruppen_klassen": gepruefte_zellen,
            "regel": "n = vorn + gleichauf + hinten + unbekannt und Siege-Teilwerte = Siege je Zelle"},
        "hist_konsistenz": hist_konsistenz,
    }
    with open("plausibilitaet-a2.json", "w") as f:
        json.dump(plaus, f, ensure_ascii=False, indent=1)

    print("kapitel-7.json und plausibilitaet-a2.json geschrieben")
    for e in ("mb", "shr", "urn"):
        g = gegen[e]
        print(f"{e}: ist={g['ist_zeitklassen']} kapitel={g['nenner_kapitel']} abw={g['abweichung']} "
              f"({g['abweichung_prozent']} Prozent) k6_abw={g['abweichung_k6_inkl_ohne_zeitpunkt']} "
              f"ohne_zeitpunkt={g['ohne_zeitpunkt']}")
    print("zellen_integritaet:", integritaet_verletzungen, "Verletzungen in", gepruefte_zellen, "Zellen")
    for h in hist_konsistenz:
        print("hist", h)
    for name in ("midboss", "urne", "shrine"):
        kl = ereignisse[name]["zeitklassen"]
        med = ereignisse[name]["median_ereigniszeitpunkt_je_rangstufe"]
        print(f"{name}: {len(kl)} Klassen: {[k['klasse'] for k in kl]}")
        for k in kl:
            print(f"   {k['klasse']:>18} ges {k['siegquote_gesamt_prozent']} Prozent "
                  f"(niedrig {k['ranggruppen']['niedrig']['siegquote_prozent']}, "
                  f"mittel {k['ranggruppen']['mittel']['siegquote_prozent']}, "
                  f"hoch {k['ranggruppen']['hoch']['siegquote_prozent']})")
        print("  median:", {m["rang"]: m["median_sekunden"] for m in med})


if __name__ == "__main__":
    main()
