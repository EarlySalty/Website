import json

def load(fn):
    with open(fn) as f:
        return json.load(f)

qb = load("qb_merged.json")
qd = load("qd_merged.json")
qa = load("qa_merged.json")

FOLD_LABEL = "10+11"

def rows_by_tier(d):
    ti = {c: i for i, c in enumerate(d["columns"])}
    out = {}
    for row in d["rows"]:
        t = int(row[ti["tier"]])
        out[t] = {c: row[ti[c]] for c in d["columns"] if c != "tier"}
    if 11 in out:
        for c in out[10]:
            out[10][c] += out[11][c]
        del out[11]
    return out

def fold(tiers):
    out = {}
    for t, v in tiers.items():
        label = FOLD_LABEL if t == 10 else str(t)
        if label not in out:
            out[label] = {k: 0.0 for k in v}
        for k, x in v.items():
            out[label][k] += x
    def sortkey(l):
        return 10.5 if l == FOLD_LABEL else float(l)
    return sorted(out.items(), key=lambda kv: sortkey(kv[0]))

def pct(x, n):
    if not n:
        return None
    return round(x / n * 100, 1)

def rat(x, n):
    if not n:
        return None
    return round(x / n, 2)

def sec(x, n):
    if not n:
        return None
    return round(x / n)

QB = rows_by_tier(qb)
QD = rows_by_tier(qd)
tiers_qb = fold(QB)
tiers_qd = fold(QD)
assert [t for t, _ in tiers_qb] == [t for t, _ in tiers_qd]

stufen = [t for t, _ in tiers_qb]

k1 = {"kapitel": 1, "titel": "Midboss (Rejuvenator)", "einheit": "je Rangstufe",
      "definition": {
          "match_mit_midboss": "mindestens ein Eintrag in mid_boss.destroyed_time_s",
          "erster_rejuvenator": "Eintrag mit kleinstem destroyed_time_s; Team = mid_boss.team_claimed",
          "steal": "mid_boss.team_killed != mid_boss.team_claimed bei einem Eintrag; Stealer = Claim-Team",
          "siegquoten": "Teamvergleich mit winning_team, ohne Kontrolle fuer Soul-Vorsprung (Kapitel 6 schichtet)",
          "siegquote_nach_steal": "Anteil Steal-Ereignisse (nicht Matches), die das Claim-Team gewinnt"},
      "stufen": []}
for t, v in tiers_qb:
    n = int(v["n_matches"])
    nmb = int(v["n_with_mb"])
    k1["stufen"].append({
        "rang": t, "n_matches": n, "n_abandon_match": int(v["n_abandon"]),
        "n_mit_midboss": nmb,
        "anteil_matches_mit_midboss_prozent": pct(nmb, n),
        "erster_midboss_sekunden_mittel": sec(v["mb_first_t_sum"], nmb),
        "n_first_claim_siege": int(v["mb_first_wins"]),
        "siegquote_first_claim_prozent": pct(v["mb_first_wins"], nmb),
        "steals_gesamt": int(v["steals_total"]),
        "steals_je_match": rat(v["steals_total"], nmb),
        "n_matches_mit_steal": int(v["n_steal_matches"]),
        "n_steal_siege": int(v["steal_wins_total"]),
        "siegquote_nach_steal_prozent": pct(v["steal_wins_total"], v["steals_total"]),
    })

k3 = {"kapitel": 3, "titel": "Shrines (TitanShieldGenerator)", "einheit": "je Rangstufe",
      "definition": {
          "shrine": "objectives.team_objective LIKE 'TitanShieldGenerator%', 4 pro Match (2 je Team)",
          "gefallen": "destroyed_time_s > 0 (0 = nicht zerstoert, Objektiv-Team ist Besitzer-Team, an Stichprobe und Verteilung geprueft)",
          "erster_fall": "kleinstes positives destroyed_time_s; Zerstoerer = anderes Team als objectives.team",
          "luecke_bis_ende": "duration_s minus erster Fall"},
      "stufen": []}
for t, v in tiers_qb:
    n = int(v["n_matches"])
    nsf = int(v["n_with_shrfall"])
    k3["stufen"].append({
        "rang": t, "n_matches": n, "n_mit_shrinefall": nsf,
        "anteil_matches_mit_shrinefall_prozent": pct(nsf, n),
        "erster_shrinefall_sekunden_mittel": sec(v["shr_first_t_sum"], nsf),
        "n_first_destroyer_siege": int(v["shr_first_wins"]),
        "siegquote_erster_zerstoerer_prozent": pct(v["shr_first_wins"], nsf),
        "luecke_erster_fall_bis_ende_sekunden_mittel": sec(v["shr_end_gap_sum"], nsf),
        "gefallene_shrines_besitzer_gewinner": int(v["shr_falls_owner_win"]),
        "gefallene_shrines_besitzer_verlierer": int(v["shr_falls_owner_lose"]),
    })

k2 = {"kapitel": 2, "titel": "Soul Urn", "einheit": "je Rangstufe",
      "definition": {
          "erkennung": "stats.gold_treasure je Spieler kumuliert; Abgabe = Intervall, in dem bei mindestens 5 von 6 Spielern eines Teams derselbe minimale positive Zuwachs steht (Lauefer-Bonus darf hoeher liegen); Einzelspieler-Spruenge (Idole) zaehlen nicht",
          "abgabezeitpunkt": "Stuetzstelle, an der der Sprung sichtbar wird; Raster 180 s bis 900 s, danach 300 s",
          "mehr_abgaben": "Team mit mehr erkannten Abgaben im Match; Unentschieden ohne Abgabedifferenz ausgeschlossen"},
      "stufen": []}
for t, v in tiers_qd:
    n = int(v["n_matches"])
    nwd = int(v["n_with_delivery"])
    nwf = int(v["n_with_first"])
    nwm = int(v["n_with_more"])
    dels = int(v["dels0_sum"] + v["dels1_sum"])
    k2["stufen"].append({
        "rang": t, "n_matches": n, "n_mit_abgabe": nwd,
        "anteil_matches_mit_abgabe_prozent": pct(nwd, n),
        "abgaben_gesamt": dels,
        "abgaben_je_team_je_match": rat(dels, 2 * n),
        "n_mit_erster_abgabe": nwf,
        "erste_abgabe_sekunden_mittel": sec(v["urn_first_t_sum"], nwf),
        "n_first_team_siege": int(v["first_team_wins"]),
        "siegquote_erste_abgabe_prozent": pct(v["first_team_wins"], nwf),
        "n_mehr_abgaben_faelle": nwm,
        "n_mehr_abgaben_siege": int(v["more_wins"]),
        "siegquote_mehr_abgaben_prozent": pct(v["more_wins"], nwm),
    })

k4 = {"kapitel": 4, "titel": "Unstable Rift", "befund": "Nullbefund",
      "begruendung": [
          "match_player enthaelt kein Rift-Feld (alle 150 Spalten geprueft, schema_match_player.json)",
          "stats.gold_boss und stats.gold_boss_orb zeigen je-Spieler-Zuwachse ohne Teammuster und sind vom Rift trennbar nicht interpretierbar (probe_urn.json); gold_boss_orb bleibt im Stichprobenmatch durchgaengig 0",
          "power_up_buffs.type enthaelt keine Rift-Bezeichnung (probe_buffs.json)",
          "Demo-Endpunkte (/v1/matches/demo/schema mit match_id) liefern fuer alle drei Stichproben-Matches HTTP 404 (kein Demo/Salts) und sind je Einzelmatch und rate-limitiert, fuer eine Grundgesamtheit ohne Schleife ueber Einzelmatches nicht nutzbar",
          "match_tracked_stats ist eine ID-Map ohne oeffentliche Zuordnung, Rift-Zaehler also nicht identifizierbar"],
      "stufen": [{"rang": t, "n_matches": int(v["n_matches"]), "messbar": False} for t, v in tiers_qd]}

k5 = {"kapitel": 5, "titel": "Reihenfolge und Kombination der Erst-Objectives", "einheit": "je Rangstufe",
      "definition": {
          "basis": "Matches mit allen drei Erst-Events (erster Midboss-Claim, erste Urnen-Abgabe mit sichtbarem Sprung, erster Shrine-Fall), 98,8 Prozent aller Matches",
          "f_win": "Anzahl der drei Erst-Objectives, die das spätere Sieger-Team geholt hat (0 bis 3); bei Urnen-Gleichstand beider Teams im selben Intervall zählt die Urne konservativ mit 0, die Mehrheits-Quote ist also eine Unterschranke",
          "majority": "f_win >= 2, Siegquote des Teams mit der Mehrheit der Erst-Objectives",
          "reihenfolge_vorbehalt": "Urnen-Zeitpunkt nur auf Checkpoint-Raster (bis 900 s in 180-s-, danach 300-s-Schritten), Gleichstand faellt an Midboss, dann Urne, dann Shrine"},
      "stufen": []}
for t, v in tiers_qd:
    n = int(v["n_matches"])
    nall3 = int(v["n_all3"])
    k5["stufen"].append({
        "rang": t, "n_matches": n, "n_alle_drei_events": nall3,
        "anteil_alle_drei_prozent": pct(nall3, n),
        "n_midboss_zuerst": int(v["first_mb"]), "n_urne_zuerst": int(v["first_urn"]),
        "n_shrine_zuerst": int(v["first_shr"]),
        "f0": int(v["f0"]), "f1": int(v["f1"]), "f2": int(v["f2"]), "f3": int(v["f3"]),
        "majority_siege": int(v["maj_wins"]),
        "siegquote_majority_prozent": pct(v["maj_wins"], nall3),
    })

k6 = {"kapitel": 6, "titel": "Kontrolle: Soul-Vorsprung zum Ereigniszeitpunkt", "einheit": "je Rangstufe und Ereignis",
      "definition": {
          "soul_vorsprung": "Summe stats.net_worth des Ereignis-Teams gegen das Gegner-Team an der letzten Stuetzstelle vor dem Ereignis (Urne: Stuetzstelle am Intervallbeginn)",
          "klassen": "vorn: > 105 Prozent des Gegners, gleichauf: 95 bis 105 Prozent, hinten: < 95 Prozent",
          "leseweise": "Beobachtung, keine Wirkung; Siegquote des Ereignis-Teams innerhalb jeder Klasse",
          "unbekannt": "Ereignis vor erster Stuetzstelle oder fehlende Net-Worth-Werte"},
      "stufen": []}
for t, v in tiers_qd:
    row = {"rang": t}
    for pre in ("mb", "shr", "urn"):
        row[f"{pre}_n"] = int(v[f"{pre}_n"])
        for cls in ("vorn", "gleich", "hinten"):
            row[f"{pre}_{cls}"] = int(v[f"{pre}_{cls}"])
            row[f"{pre}_{cls}_siege"] = int(v[f"{pre}_{cls}_wins"])
            row[f"{pre}_{cls}_siegquote_prozent"] = pct(v[f"{pre}_{cls}_wins"], v[f"{pre}_{cls}"])
        row[f"{pre}_unbekannt"] = int(v[f"{pre}_unk"])
    k6["stufen"].append(row)

for fname, doc in [("kapitel-1.json", k1), ("kapitel-2.json", k2), ("kapitel-3.json", k3),
                   ("kapitel-4.json", k4), ("kapitel-5.json", k5), ("kapitel-6.json", k6)]:
    doc["grundgesamtheit"] = ("game_mode Normal, match_mode Ranked, match_outcome TeamWin, "
                              "2026-08-13 00:00 UTC bis 2026-09-15 23:59 UTC, 523602 Matches im QB-Lauf "
                              "bzw. 523747 im QD-Lauf (Daten-drift +145), "
                              "Dedup je (match_id, account_id) ueber neueste created_at")
    with open(fname, "w") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print("geschrieben:", fname)
