import glob
import json

GROUPS = ["niedrig", "mittel", "hoch"]
FOLD_LABEL = "10+11"
LANE_NAMEN = {1: "Yellow", 4: "Blue", 6: "Purple"}
STUFTEN_GRUPPE = {"niedrig": [1, 2, 3, 4], "mittel": [5, 6, 7], "hoch": [8, 9, 10, 11]}
HERO_NAMES_DATEI = "hero_names.json"


def laden(fn):
    with open(fn) as f:
        return json.load(f)


def payload_wert(v):
    return json.loads(v) if isinstance(v, str) else v


def pct(x, n):
    if not n:
        return None
    return round(x / n * 100, 1)


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
    if not glob.glob("a3_D_*.json"):
        raise SystemExit("keine a3_D_*.json Dateien gefunden")
    hero_namen = {int(k): v for k, v in laden(HERO_NAMES_DATEI).items()}
    hero_basis = {int(k): v for k, v in laden("hero_basis.json").items()}
    hero_basis_gesamt = sum(hero_basis.values())

    summen = {g: {} for g in GROUPS}
    swing_grid = {g: {} for g in GROUPS}
    tag_geladen = set()
    for fn in sorted(glob.glob("a3_D_*.json")):
        res = laden(fn)
        tag_geladen.add(fn)
        for zeile, tg, grid, n, payload in res["rows"]:
            p = payload_wert(payload)
            ziel = summen[tg]
            if zeile == "laeufer":
                z = ziel.setdefault("laeufer", {"n": 0, "hh": {}, "hl": {}})
                z["n"] += n
                z["hh"].update({k: z["hh"].get(k, 0) + v for k, v in payload_wert(p["hh"]).items()})
                z["hl"].update({k: z["hl"].get(k, 0) + v for k, v in payload_wert(p["hl"]).items()})
                for k in ("wins", "rk1", "rk2", "rk3", "rk4", "rk5", "rk6", "rk_unk",
                          "nw_ueber", "nw_gleich", "nw_unter", "k_ueber", "k_gleich", "k_unter",
                          "d_ueber", "d_gleich", "d_unter",
                          "s_nw", "s_mnw", "s_k", "s_mk", "s_d", "s_md"):
                    z[k] = z.get(k, 0) + p[k]
                for k in ("hn", "hk", "hd"):
                    h = payload_wert(p[k])
                    z[k] = {kk: z.get(k, {}).get(kk, 0) + v for kk, v in h.items()}
            elif zeile == "laeufer_unk":
                ziel["laeufer_unk"] = ziel.get("laeufer_unk", 0) + n
            elif zeile == "tod":
                z = ziel.setdefault("tod", {})
                for k in ("del_ints", "del_tod_ints", "del_tode", "del_sek",
                          "oth_ints", "oth_tod_ints", "oth_tode", "oth_sek"):
                    z[k] = z.get(k, 0) + p[k]
            elif zeile == "swing_del_pool":
                z = ziel.setdefault("del_pool", {"n": 0, "nn": 0, "h": {}, "ha": {}})
                z["n"] += n
                z["nn"] += p["nn"]
                z["s"] = z.get("s", 0) + p["s"]
                z["sa"] = z.get("sa", 0) + p["sa"]
                z["h"].update({k: z["h"].get(k, 0) + v for k, v in payload_wert(p["h"]).items()})
                z["ha"].update({k: z["ha"].get(k, 0) + v for k, v in payload_wert(p["ha"]).items()})
            elif zeile == "swing_ohne_pool":
                z = ziel.setdefault("ohne_pool", {"n": 0, "nn": 0, "ha": {}})
                z["n"] += n
                z["nn"] += p["nn"]
                z["sa"] = z.get("sa", 0) + p["sa"]
                z["ha"].update({k: z["ha"].get(k, 0) + v for k, v in payload_wert(p["ha"]).items()})
            elif zeile in ("swing_del", "swing_ohne"):
                z = swing_grid[tg].setdefault((zeile, grid), {"n": 0})
                z["n"] += n
                if zeile == "swing_del":
                    z["s"] = z.get("s", 0) + p["s"]
                    z["nn"] = z.get("nn", 0) + p["nn"]
                else:
                    z["sa"] = z.get("sa", 0) + p["sa"]
                    z["nn"] = z.get("nn", 0) + p["nn"]
    if len(tag_geladen) != 34:
        raise SystemExit(f"{len(tag_geladen)} Tagesdateien statt 34")

    gegen = {}
    for g in GROUPS:
        s = summen[g]
        n_known = s["laeufer"]["n"]
        n_unk = s.get("laeufer_unk", 0)
        gegen[g] = (n_known, n_unk)

    check = laden("urn_lauefer_check.json")
    k2 = laden("kapitel-2.json")
    k2_gruppen = {g: 0 for g in GROUPS}
    tier_gruppe = (["niedrig"] * 4) + (["mittel"] * 3) + (["hoch"] * 4)
    for stufe in k2["stufen"]:
        idx = int(stufe["rang"].split("+")[0]) - 1
        k2_gruppen[tier_gruppe[idx]] += stufe["abgaben_gesamt"]

    ranggruppen = {}
    plaus_helden = {}
    plaus_rank = {}
    plaus_wins = {}
    plaus_del = {}
    for g in GROUPS:
        s = summen[g]
        l = s["laeufer"]
        n_known = l["n"]
        n_unk = s.get("laeufer_unk", 0)
        n_abgaben = n_known + n_unk

        helden = sorted(((int(k), v) for k, v in l["hh"].items()), key=lambda x: -x[1])
        top10 = []
        for hid, v in helden[:10]:
            anteil_gesamt = hero_basis.get(hid, 0) / hero_basis_gesamt * 100
            faktor = (v / n_known) / (hero_basis.get(hid, 0) / hero_basis_gesamt)
            top10.append({"hero_id": hid, "name": hero_namen.get(hid, f"hero_{hid}"), "n": v,
                          "anteil_prozent": pct(v, n_known),
                          "anteil_gesamt_prozent": round(anteil_gesamt, 1),
                          "faktor_gegen_gesamt": round(faktor, 2)})
        n_top10 = sum(v for _, v in helden[:10])
        plaus_helden[g] = pct_abs(n_top10, n_known)

        ranks = {str(k): l[f"rk{k}"] for k in range(1, 7)}
        ranks["unbekannt"] = l["rk_unk"]
        plaus_rank[g] = sum(ranks.values())

        tod = s["tod"]
        swing_ab = s["del_pool"]
        swing_oh = s["ohne_pool"]
        n_ab_val = swing_ab["n"] - swing_ab["nn"]
        n_oh_val = swing_oh["n"] - swing_oh["nn"]

        hn_bins = {int(k) * 5000: v for k, v in l["hn"].items()}
        hk_bins = {int(k): v for k, v in l["hk"].items()}
        hd_bins = {int(k): v for k, v in l["hd"].items()}
        ha_ab = {int(k) * 2500 - 24 * 2500: v for k, v in swing_ab["ha"].items()}
        ha_oh = {int(k) * 2500 - 24 * 2500: v for k, v in swing_oh["ha"].items()}
        h_ab = {int(k) * 2500: v for k, v in swing_ab["h"].items()}

        je_stuetz = []
        grids = sorted({gr for (zeile, gr) in swing_grid[g] if zeile == "swing_del"}
                       | {gr for (zeile, gr) in swing_grid[g] if zeile == "swing_ohne"})
        for gr in grids:
            d = swing_grid[g].get(("swing_del", gr))
            o = swing_grid[g].get(("swing_ohne", gr))
            zeile_d = {"stuetzstelle_s": gr}
            if d:
                n_val = d["n"] - d.get("nn", 0)
                zeile_d["n_abgabe"] = d["n"]
                zeile_d["mittel_abgabe"] = round(d["s"] / n_val, 1) if n_val else None
            else:
                zeile_d["n_abgabe"] = 0
                zeile_d["mittel_abgabe"] = None
            if o:
                n_val = o["n"] - o.get("nn", 0)
                zeile_d["n_ohne"] = o["n"]
                zeile_d["mittel_betrag_ohne"] = round(o["sa"] / n_val, 1) if n_val else None
            else:
                zeile_d["n_ohne"] = 0
                zeile_d["mittel_betrag_ohne"] = None
            je_stuetz.append(zeile_d)

        ranggruppen[g] = {
            "n_abgaben": n_abgaben,
            "n_laeufer_bekannt": n_known,
            "n_laeufer_unbekannt": n_unk,
            "anteil_laeufer_bekannt_prozent": pct(n_known, n_abgaben),
            "siegquote_laeufer": {"n": n_known, "siege": l["wins"],
                                  "prozent": pct(l["wins"], n_known)},
            "rang_im_team": ranks,
            "top10_helden": top10,
            "n_helden_alle": len(l["hh"]),
            "n_uebrige": n_known - n_top10,
            "anteil_uebrige_prozent": pct(n_known - n_top10, n_known),
            "lanes": {LANE_NAMEN.get(int(k), f"lane_{k}"): {"n": v, "anteil_prozent": pct(v, n_known)}
                      for k, v in sorted(l["hl"].items(), key=lambda x: -x[1])},
            "todesquote": {
                "abgabe_intervalle": {
                    "n_intervalle": tod["del_ints"], "n_mit_tod": tod["del_tod_ints"],
                    "anteil_mit_tod_prozent": pct(tod["del_tod_ints"], tod["del_ints"]),
                    "tode": tod["del_tode"], "sekunden": tod["del_sek"],
                    "tode_je_stunde": round(tod["del_tode"] / (tod["del_sek"] / 3600), 2)},
                "uebrige_intervalle": {
                    "n_intervalle": tod["oth_ints"], "n_mit_tod": tod["oth_tod_ints"],
                    "anteil_mit_tod_prozent": pct(tod["oth_tod_ints"], tod["oth_ints"]),
                    "tode": tod["oth_tode"], "sekunden": tod["oth_sek"],
                    "tode_je_stunde": round(tod["oth_tode"] / (tod["oth_sek"] / 3600), 2)},
            },
            "soul_swing": {
                "abgabe": {"n": swing_ab["n"], "n_ohne_wert": swing_ab["nn"],
                           "mittel": round(swing_ab["s"] / n_ab_val, 1),
                           "median": median_aus_bins(h_ab, 2500),
                           "mittel_betrag": round(swing_ab["sa"] / n_ab_val, 1),
                           "median_betrag": median_aus_bins(ha_ab, 2500)},
                "ohne_abgabe": {"n": swing_oh["n"], "n_ohne_wert": swing_oh["nn"],
                                "mittel_betrag": round(swing_oh["sa"] / n_oh_val, 1),
                                "median_betrag": median_aus_bins(ha_oh, 2500)},
                "je_stuetzstelle": je_stuetz,
            },
            "endstatistik": {
                "net_worth": {"n_ueber": l["nw_ueber"], "n_gleich": l["nw_gleich"],
                              "n_unter": l["nw_unter"],
                              "median_differenz": median_aus_bins(hn_bins, 5000),
                              "mittel_differenz": round((l["s_nw"] - l["s_mnw"]) / n_known, 1),
                              "mittel_laeufer": round(l["s_nw"] / n_known, 1),
                              "mittel_kollegen_median": round(l["s_mnw"] / n_known, 1)},
                "kills": {"n_ueber": l["k_ueber"], "n_gleich": l["k_gleich"],
                          "n_unter": l["k_unter"],
                          "median_differenz": median_aus_bins(hk_bins, 1),
                          "mittel_differenz": round((l["s_k"] - l["s_mk"]) / n_known, 2),
                          "mittel_laeufer": round(l["s_k"] / n_known, 2),
                          "mittel_kollegen_median": round(l["s_mk"] / n_known, 2)},
                "deaths": {"n_ueber": l["d_ueber"], "n_gleich": l["d_gleich"],
                           "n_unter": l["d_unter"],
                           "median_differenz": median_aus_bins(hd_bins, 1),
                           "mittel_differenz": round((l["s_d"] - l["s_md"]) / n_known, 2),
                           "mittel_laeufer": round(l["s_d"] / n_known, 2),
                           "mittel_kollegen_median": round(l["s_md"] / n_known, 2)},
            },
        }
        plaus_wins[g] = (ranggruppen[g]["siegquote_laeufer"]["siege"], n_known)
        plaus_del[g] = tod["del_ints"]

    plaus = {
        "stand": "2026-09-18",
        "lauf": "A3, tageweise 34 Chunks, clientseitig gemergt",
        "tage": len(tag_geladen),
        "abgaben_gegen_kapitel2": {},
        "helden_anteile": plaus_helden,
        "rang_summen": plaus_rank,
        "sieg_plus_niederlagen": plaus_wins,
        "tod_intervalle_gegen_laeufer": plaus_del,
        "swing_del_gegen_abgaben": {},
    }
    for g in GROUPS:
        n_known, n_unk = gegen[g]
        n_abgaben = n_known + n_unk
        plaus["abgaben_gegen_kapitel2"][g] = {
            "a3": n_abgaben, "kapitel2": k2_gruppen[g],
            "abweichung": n_abgaben - k2_gruppen[g],
            "abweichung_prozent": round((n_abgaben - k2_gruppen[g]) / k2_gruppen[g] * 100, 3),
        }
        dp = summen[g]["del_pool"]
        plaus["swing_del_gegen_abgaben"][g] = {
            "swing_n": dp["n"], "abgaben": n_abgaben,
            "ohne_wert": dp["nn"],
            "differenz": dp["n"] + dp["nn"] - n_abgaben,
        }
        assert plaus_rank[g] == n_known, f"Rangsumme {g}"
        assert plaus_wins[g][0] <= plaus_wins[g][1]
        assert plaus_del[g] == n_known, f"Tod-Intervalle {g}"
        assert plaus["swing_del_gegen_abgaben"][g]["differenz"] == 0, f"Swing-Summe {g}"
        assert abs(plaus_helden[g] + ranggruppen[g]["anteil_uebrige_prozent"] - 100) <= 0.15, f"Helden {g}"

    kap8 = {
        "kapitel": 8,
        "titel": "Der Urnen-Laeufer",
        "einheit": "je Abgabe (Team und Intervall) und Ranggruppe",
        "definition": {
            "grundlage": "gleiche Urnen-Abgaben wie Kapitel 2 (mindestens 5 von 6 Spielern eines Teams mit gleichem minimalem positiven Zuwachs von stats.gold_treasure im selben Intervall); jede erkannte Abgabe zaehlt",
            "laeufer": "Spieler des Abgabe-Teams mit dem groessten Zuwachs von stats.gold_treasure im Abgabe-Intervall, sofern dieser ueber dem Team-Minimum liegt und eindeutig ist; bei Gleichstand oder fehlendem Mehrzuwachs gilt der Laeufer als unbekannt und wird getrennt gezaehlt",
            "gegenprobe": "an denselben 20 Zufalls-Matches wie Paket A von Hand nachgerechnet (urn_lauefer_check.json): 83 Regel-Abgaben, 26 mit unterscheidbarem Laeufer; ein Laeufer ist genau dann sichtbar, wenn 5 von 6 Spielern gleichen Zuwachs haben und der sechste mehr erhaelt",
            "rang_im_team": "Rang des Laeufers im Team nach stats.net_worth an der Stuetzstelle vor der Abgabe (1 = reichster, 6 = aermster); bei Gleichstand erhaelt beide der engere bessere Rang; ausgewiesen nur bei vollstaendigen Net-Worth-Werten aller sechs Teammitglieder",
            "kosten": "Tode des Laeufers im Abgabe-Intervall (death_details.game_time_s zwischen den beiden Stuetzstellen) gegen die Tode desselben Laeufers in seinen uebrigen Checkpoint-Intervallen desselben Matches",
            "nutzen": "Verschiebung der Net-Worth-Differenz des Abgabe-Teams zum Gegner zwischen der Stuetzstelle vor und nach der Abgabe; verglichen mit Intervallen ohne Abgabe beider Teams an derselben Stuetzstelle. Weil sich beide Teams in Intervallen ohne Abgabe spiegelsymmetrisch exakt aufheben, ist der Vergleich ueber den Betrag der Verschiebung gefuehrt; die signierten Werte der Abgabe-Intervalle zeigen die Richtung",
            "ergebnis": "Siegquote der Laeufer sowie Endwerte net_worth, kills und deaths des Laeufers gegen den Median seiner fuenf Teamkollegen (drittkleinster der fuenf Werte)",
            "ranggruppen": "niedrig = Stufen 1 bis 4, mittel = Stufen 5 bis 7, hoch = Stufen 8 bis 11 (Stufen 10 und 11 wie in Kapitel 1 bis 6 zusammen)",
            "mediane": "aus Histogrammen, innerhalb des Korbs linear interpoliert; Soul-Swing-Korbs 2500 Seelen, Net-Worth-Differenz 5000 Seelen, Kills und Deaths je 1",
            "heldennamen": "api.deadlock-api.com/v1/assets/heroes, Stand 2026-09-18",
            "helden_vergleich": "anteil_gesamt_prozent ist der Anteil des Helden an allen Spielerzeilen der Grundgesamtheit (Basis ohne Läufer-Filter, wochenweise geladen); faktor_gegen_gesamt ist das Verhaeltnis von Läufer-Anteil zu Gesamtanteil, Werte ueber 1 bedeuten Ueberrepraesentation unter den Läufern",
            "leseweise": "Beobachtung, keine Wirkung; die Läufer-Rolle und die Abgabezeitpunkte sind nicht randomisiert, und nur Abgaben mit unterscheidbarem Läufer tragen die Läufer-Werte",
        },
        "ranggruppen": ranggruppen,
        "grundgesamtheit": ("game_mode Normal, match_mode Ranked, match_outcome TeamWin, "
                            "2026-08-13 00:00 UTC bis 2026-09-15 23:59 UTC, tageweise 34 Chunks im "
                            "A3-Lauf vom 2026-09-18, clientseitig gemergt; Dedup je (match_id, "
                            "account_id) ueber neueste created_at"),
    }
    with open("kapitel-8.json", "w") as f:
        json.dump(kap8, f, ensure_ascii=False, indent=1)
    with open("plausibilitaet-a3.json", "w") as f:
        json.dump(plaus, f, ensure_ascii=False, indent=1)

    print("kapitel-8.json und plausibilitaet-a3.json geschrieben")
    for g in GROUPS:
        r = ranggruppen[g]
        print(f"\n{g}: {r['n_abgaben']} Abgaben, {r['n_laeufer_bekannt']} Laeufer bekannt "
              f"({r['anteil_laeufer_bekannt_prozent']} Prozent), "
              f"Siegquote {r['siegquote_laeufer']['prozent']} Prozent")
        print("  rang:", r["rang_im_team"])
        print("  top3:", [(h["name"], h["anteil_prozent"]) for h in r["top10_helden"][:3]])
        print("  lanes:", {k: v["anteil_prozent"] for k, v in r["lanes"].items()})
        tq = r["todesquote"]
        print(f"  tod: abgabe {tq['abgabe_intervalle']['tode_je_stunde']}/h "
              f"({tq['abgabe_intervalle']['anteil_mit_tod_prozent']} Prozent der Intervalle) "
              f"gegen uebrige {tq['uebrige_intervalle']['tode_je_stunde']}/h "
              f"({tq['uebrige_intervalle']['anteil_mit_tod_prozent']} Prozent)")
        ss = r["soul_swing"]
        print(f"  swing: abgabe {ss['abgabe']['mittel']} (median {ss['abgabe']['median']}), "
              f"betrag abgabe {ss['abgabe']['mittel_betrag']} (median {ss['abgabe']['median_betrag']}) "
              f"gegen ohne {ss['ohne_abgabe']['mittel_betrag']} "
              f"(median {ss['ohne_abgabe']['median_betrag']})")
        es = r["endstatistik"]
        print(f"  ende: nw ueber {es['net_worth']['n_ueber']}/unter {es['net_worth']['n_unter']} "
              f"(median diff {es['net_worth']['median_differenz']}), "
              f"kills ueber {es['kills']['n_ueber']}/unter {es['kills']['n_unter']}, "
              f"deaths ueber {es['deaths']['n_ueber']}/unter {es['deaths']['n_unter']} "
              f"(median diff {es['deaths']['median_differenz']})")
    print("\nplausibilitaet:")
    for g in GROUPS:
        a = plaus["abgaben_gegen_kapitel2"][g]
        print(f"  {g}: a3 {a['a3']} gegen kapitel2 {a['kapitel2']} "
              f"({a['abweichung']:+d}, {a['abweichung_prozent']:+} Prozent)")


def pct_abs(x, n):
    if not n:
        return None
    return round(x / n * 100, 1)


if __name__ == "__main__":
    main()
