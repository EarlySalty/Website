-- Abfragen fuer objectives-blogpost Paket A, gefahren ueber POST https://api.deadlock-api.com/v1/mcp
-- JSON-RPC Tool execute_query, DuckDB-Dialekt, nur lesend.
-- Deckel: 1024 Zeilen und 50 KB je Abfrage, 300 s Timeout.
-- Wegen des Timeouts wurden die Fenster-Abfragen wochenweise (QA, QB) und teils tageweise (QD)
-- gefahren und clientseitig additiv gemergt. Zeitgrenzen stehen je Lauf in den DATE-Grenzen.

-- QA: Tages- und Rangabdeckung, Duplikatpruefung (Wochen-Chunk, hier Woche 1 vom 2026-08-13)
SELECT epoch(date_trunc('day', start_time))::BIGINT AS day_epoch,
       least(greatest(floor(average_badge/10.0)::INT, 1), 11) AS tier,
       count(*) AS rows_raw,
       count(DISTINCT (match_id, account_id)) AS player_rows,
       count(DISTINCT match_id) AS matches_all,
       count(DISTINCT CASE WHEN match_outcome = 'TeamWin' THEN match_id END) AS matches_teamwin
FROM match_player
WHERE start_time >= TIMESTAMPTZ '2026-08-13 00:00:00+00'
  AND start_time < TIMESTAMPTZ '2026-08-20 00:00:00+00'
  AND game_mode = 'Normal' AND match_mode = 'Ranked'
GROUP BY day_epoch, tier
ORDER BY day_epoch, tier;

-- QB: K1 Midboss und K3 Shrines je Rangstufe (Wochen-Chunk, hier Woche 1)
WITH m AS (
  SELECT match_id,
         least(greatest(floor(min(average_badge)/10.0)::INT, 1), 11) AS tier,
         min(winning_team) AS wt,
         min(duration_s) AS dur,
         bool_or(abandon_match_time_s > 0) AS ab,
         min("mid_boss.destroyed_time_s") AS mb_t,
         min("mid_boss.team_killed") AS mb_k,
         min("mid_boss.team_claimed") AS mb_c,
         min("objectives.team_objective") AS ob_n,
         min("objectives.team") AS ob_t,
         min("objectives.destroyed_time_s") AS ob_d
  FROM match_player
  WHERE start_time >= TIMESTAMPTZ '2026-08-13 00:00:00+00'
    AND start_time < TIMESTAMPTZ '2026-08-20 00:00:00+00'
    AND game_mode = 'Normal' AND match_mode = 'Ranked'
    AND match_outcome = 'TeamWin'
  GROUP BY match_id
),
mb AS (
  SELECT m.match_id, m.wt, m.tier, m.mb_c[g.i] AS c, m.mb_k[g.i] AS k, m.mb_t[g.i] AS t
  FROM m, range(1, len(coalesce(m.mb_t, [])) + 1) AS g(i)
),
mbm AS (
  SELECT match_id, any_value(wt) AS wt, any_value(tier) AS tier, count(*) AS n_mb,
         min(t) AS mb_first_t, arg_min(c, t) AS mb_first_c,
         count(*) FILTER (k != c) AS steals,
         count(*) FILTER (k != c AND c = wt) AS steal_wins
  FROM mb
  GROUP BY match_id
),
ob AS (
  SELECT m.match_id, m.wt, m.tier, m.ob_n[g.i] AS n, m.ob_t[g.i] AS t, m.ob_d[g.i] AS d
  FROM m, range(1, len(coalesce(m.ob_n, [])) + 1) AS g(i)
),
shrm AS (
  SELECT match_id, any_value(wt) AS wt, any_value(tier) AS tier,
         count(*) FILTER (d > 0) AS shr_falls,
         min(d) FILTER (d > 0) AS shr_first_t,
         arg_min(t, d) FILTER (d > 0) AS shr_first_owner,
         count(*) FILTER (d > 0 AND t = wt) AS falls_owner_win,
         count(*) FILTER (d > 0 AND t != wt) AS falls_owner_lose
  FROM ob
  WHERE n LIKE 'TitanShieldGenerator%'
  GROUP BY match_id
),
j AS (
  SELECT m.match_id, m.tier, m.ab, m.dur, m.wt, mbm.n_mb, mbm.mb_first_t, mbm.mb_first_c,
         mbm.steals, mbm.steal_wins, shrm.shr_falls, shrm.shr_first_t, shrm.shr_first_owner,
         shrm.falls_owner_win, shrm.falls_owner_lose
  FROM m
  LEFT JOIN mbm USING (match_id)
  LEFT JOIN shrm USING (match_id)
)
SELECT tier,
       count(*) AS n_matches,
       count(*) FILTER (ab) AS n_abandon,
       count(*) FILTER (n_mb > 0) AS n_with_mb,
       sum(mb_first_t) FILTER (n_mb > 0) AS mb_first_t_sum,
       count(*) FILTER (mb_first_c = wt) AS mb_first_wins,
       sum(steals) AS steals_total,
       count(*) FILTER (steals > 0) AS n_steal_matches,
       sum(steal_wins) AS steal_wins_total,
       count(*) FILTER (shr_falls > 0) AS n_with_shrfall,
       sum(shr_first_t) FILTER (shr_falls > 0) AS shr_first_t_sum,
       count(*) FILTER (CASE WHEN shr_first_owner = 'Team0' THEN 'Team1' ELSE 'Team0' END = wt) AS shr_first_wins,
       sum(dur - shr_first_t) FILTER (shr_falls > 0) AS shr_end_gap_sum,
       sum(falls_owner_win) AS shr_falls_owner_win,
       sum(falls_owner_lose) AS shr_falls_owner_lose
FROM j
GROUP BY tier
ORDER BY tier;

-- QD: K2 Urne, K5 Kombination, K6 Schichtung je Rangstufe (gleiche Abfrage wochen- und tageweise,
-- hier Tag 2026-08-13). Urnen-Erkennung: mindestens 5 von 6 Spielern eines Teams mit gleichem
-- minimalem positiven Zuwachs von stats.gold_treasure im selben Intervall.
WITH raw AS (
  SELECT match_id, account_id, team, created_at, average_badge, winning_team,
         "stats.time_stamp_s" AS ts, "stats.net_worth" AS nw, "stats.gold_treasure" AS gt,
         "mid_boss.destroyed_time_s" AS mb_t, "mid_boss.team_claimed" AS mb_c,
         "objectives.team_objective" AS ob_n, "objectives.team" AS ob_t,
         "objectives.destroyed_time_s" AS ob_d
  FROM match_player
  WHERE start_time >= TIMESTAMPTZ '2026-08-13 00:00:00+00'
    AND start_time < TIMESTAMPTZ '2026-08-14 00:00:00+00'
    AND game_mode = 'Normal' AND match_mode = 'Ranked'
    AND match_outcome = 'TeamWin'
),
pd AS (
  SELECT match_id, account_id,
         arg_max(team, created_at) AS team,
         arg_max(average_badge, created_at) AS average_badge,
         arg_max(winning_team, created_at) AS winning_team,
         arg_max(ts, created_at) AS ts,
         arg_max(nw, created_at) AS nw,
         arg_max(gt, created_at) AS gt,
         arg_max(mb_t, created_at) AS mb_t,
         arg_max(mb_c, created_at) AS mb_c,
         arg_max(ob_n, created_at) AS ob_n,
         arg_max(ob_t, created_at) AS ob_t,
         arg_max(ob_d, created_at) AS ob_d
  FROM raw
  GROUP BY match_id, account_id
),
m AS (
  SELECT match_id, min(winning_team) AS wt, min(ts) AS ts,
         least(greatest(floor(min(average_badge)/10.0)::INT, 1), 11) AS tier,
         min(mb_t) AS mb_t, min(mb_c) AS mb_c, min(ob_n) AS ob_n, min(ob_t) AS ob_t, min(ob_d) AS ob_d
  FROM pd
  GROUP BY match_id
),
mbm AS (
  SELECT match_id, min(t) AS mb_first_t, arg_min(c, t) AS mb_first_c
  FROM (SELECT m.match_id, m.mb_c[g.i] AS c, m.mb_t[g.i] AS t
        FROM m, range(1, len(coalesce(m.mb_t, [])) + 1) AS g(i))
  GROUP BY match_id
),
shrm AS (
  SELECT match_id, min(d) FILTER (d > 0) AS shr_first_t, arg_min(t, d) FILTER (d > 0) AS shr_first_owner
  FROM (SELECT m.match_id, m.ob_n[g.i] AS n, m.ob_t[g.i] AS t, m.ob_d[g.i] AS d
        FROM m, range(1, len(coalesce(m.ob_n, [])) + 1) AS g(i))
  WHERE n LIKE 'TitanShieldGenerator%'
  GROUP BY match_id
),
ui AS (
  SELECT match_id, team, x.i AS i, x.d AS d
  FROM pd, UNNEST(list_filter(list_transform(range(1, len(coalesce(gt, []))),
       i -> {'i': i, 'd': gt[i+1] - gt[i]}), x -> x.d > 0)) AS u(x)
),
ug AS (
  SELECT match_id, team, i, count(*) AS npos, min(d) AS dmin
  FROM ui
  GROUP BY match_id, team, i
),
ud AS (
  SELECT ui.match_id AS match_id, ui.team AS team, ui.i AS i
  FROM ui JOIN ug ON ui.match_id = ug.match_id AND ui.team = ug.team AND ui.i = ug.i
  GROUP BY ui.match_id, ui.team, ui.i, ug.dmin
  HAVING ug.dmin > 0 AND count(*) FILTER (ui.d = ug.dmin) >= 5
),
uteam AS (
  SELECT match_id, team, count(*) AS dels, min(i) AS fi
  FROM ud
  GROUP BY match_id, team
),
ev AS (
  SELECT m.match_id, m.wt, m.tier, m.ts,
         mbm.mb_first_t, mbm.mb_first_c, shrm.shr_first_t,
         CASE WHEN shrm.shr_first_owner = 'Team0' THEN 'Team1' ELSE 'Team0' END AS shr_first_team,
         u0.fi AS fi0, u1.fi AS fi1,
         CASE WHEN u1.fi IS NULL OR u0.fi < u1.fi THEN 'Team0'
              WHEN u0.fi IS NULL OR u1.fi < u0.fi THEN 'Team1' END AS urn_first_team,
         least(u0.fi, u1.fi) AS urn_fi,
         coalesce(u0.dels, 0) AS dels0, coalesce(u1.dels, 0) AS dels1
  FROM m
  LEFT JOIN mbm USING (match_id)
  LEFT JOIN shrm USING (match_id)
  LEFT JOIN uteam u0 ON m.match_id = u0.match_id AND u0.team = 'Team0'
  LEFT JOIN uteam u1 ON m.match_id = u1.match_id AND u1.team = 'Team1'
),
ev2 AS (
  SELECT *,
         len(list_filter(ts, x -> x < mb_first_t)) AS idx_mb,
         len(list_filter(ts, x -> x < shr_first_t)) AS idx_shr,
         coalesce(urn_fi, 0) AS idx_urn,
         CASE WHEN urn_fi IS NOT NULL THEN ts[urn_fi + 1] END AS urn_first_t
  FROM ev
),
p2 AS (
  SELECT pd.match_id, pd.team, ev2.wt, ev2.tier, ev2.mb_first_t, ev2.mb_first_c, ev2.shr_first_t,
         ev2.shr_first_team, ev2.urn_first_team, ev2.urn_first_t, ev2.idx_mb, ev2.idx_shr, ev2.idx_urn,
         ev2.dels0, ev2.dels1, ev2.fi0, ev2.fi1,
         CASE WHEN ev2.idx_mb > 0 THEN coalesce(pd.nw, [])[ev2.idx_mb] END AS nw_mb,
         CASE WHEN ev2.idx_shr > 0 THEN coalesce(pd.nw, [])[ev2.idx_shr] END AS nw_shr,
         CASE WHEN ev2.idx_urn > 0 THEN coalesce(pd.nw, [])[ev2.idx_urn] END AS nw_urn
  FROM pd JOIN ev2 USING (match_id)
),
agg AS (
  SELECT match_id, any_value(wt) AS wt, any_value(tier) AS tier,
         any_value(mb_first_t) AS mb_first_t, any_value(mb_first_c) AS mb_first_c,
         any_value(shr_first_t) AS shr_first_t, any_value(shr_first_team) AS shr_first_team,
         any_value(urn_first_team) AS urn_first_team, any_value(urn_first_t) AS urn_first_t,
         any_value(idx_mb) AS idx_mb, any_value(idx_shr) AS idx_shr, any_value(idx_urn) AS idx_urn,
         any_value(dels0) AS dels0, any_value(dels1) AS dels1,
         sum(CASE WHEN team = 'Team0' THEN nw_mb END) AS mb_s0,
         sum(CASE WHEN team = 'Team1' THEN nw_mb END) AS mb_s1,
         sum(CASE WHEN team = 'Team0' THEN nw_shr END) AS shr_s0,
         sum(CASE WHEN team = 'Team1' THEN nw_shr END) AS shr_s1,
         sum(CASE WHEN team = 'Team0' THEN nw_urn END) AS urn_s0,
         sum(CASE WHEN team = 'Team1' THEN nw_urn END) AS urn_s1,
         count(*) FILTER (team = 'Team0' AND nw_mb IS NULL)
           + count(*) FILTER (team = 'Team1' AND nw_mb IS NULL) AS mb_nulls,
         count(*) FILTER (team = 'Team0' AND nw_shr IS NULL)
           + count(*) FILTER (team = 'Team1' AND nw_shr IS NULL) AS shr_nulls,
         count(*) FILTER (team = 'Team0' AND nw_urn IS NULL)
           + count(*) FILTER (team = 'Team1' AND nw_urn IS NULL) AS urn_nulls
  FROM p2
  GROUP BY match_id
),
cls AS (
  SELECT *,
         CASE WHEN mb_first_c IS NULL THEN NULL
              WHEN idx_mb = 0 OR mb_nulls > 0 OR mb_s0 IS NULL OR mb_s1 IS NULL THEN 'unbekannt'
              WHEN (CASE WHEN mb_first_c = 'Team0' THEN mb_s0 ELSE mb_s1 END)
                   > 1.05 * (CASE WHEN mb_first_c = 'Team0' THEN mb_s1 ELSE mb_s0 END) THEN 'vorn'
              WHEN (CASE WHEN mb_first_c = 'Team0' THEN mb_s0 ELSE mb_s1 END)
                   >= 0.95 * (CASE WHEN mb_first_c = 'Team0' THEN mb_s1 ELSE mb_s0 END) THEN 'gleich'
              ELSE 'hinten' END AS mb_class,
         CASE WHEN shr_first_team IS NULL THEN NULL
              WHEN idx_shr = 0 OR shr_nulls > 0 OR shr_s0 IS NULL OR shr_s1 IS NULL THEN 'unbekannt'
              WHEN (CASE WHEN shr_first_team = 'Team0' THEN shr_s0 ELSE shr_s1 END)
                   > 1.05 * (CASE WHEN shr_first_team = 'Team0' THEN shr_s1 ELSE shr_s0 END) THEN 'vorn'
              WHEN (CASE WHEN shr_first_team = 'Team0' THEN shr_s0 ELSE shr_s1 END)
                   >= 0.95 * (CASE WHEN shr_first_team = 'Team0' THEN shr_s1 ELSE shr_s0 END) THEN 'gleich'
              ELSE 'hinten' END AS shr_class,
         CASE WHEN urn_first_team IS NULL THEN NULL
              WHEN idx_urn = 0 OR urn_nulls > 0 OR urn_s0 IS NULL OR urn_s1 IS NULL THEN 'unbekannt'
              WHEN (CASE WHEN urn_first_team = 'Team0' THEN urn_s0 ELSE urn_s1 END)
                   > 1.05 * (CASE WHEN urn_first_team = 'Team0' THEN urn_s1 ELSE urn_s0 END) THEN 'vorn'
              WHEN (CASE WHEN urn_first_team = 'Team0' THEN urn_s0 ELSE urn_s1 END)
                   >= 0.95 * (CASE WHEN urn_first_team = 'Team0' THEN urn_s1 ELSE urn_s0 END) THEN 'gleich'
              ELSE 'hinten' END AS urn_class,
         coalesce((mb_first_c = wt)::INT, 0)
           + coalesce((shr_first_team = wt)::INT, 0)
           + coalesce((urn_first_team = wt)::INT, 0) AS f_win
  FROM agg
)
SELECT tier,
       count(*) AS n_matches,
       count(*) FILTER (mb_first_t IS NOT NULL AND shr_first_t IS NOT NULL AND urn_first_t IS NOT NULL) AS n_all3,
       count(*) FILTER (mb_first_t IS NOT NULL AND shr_first_t IS NOT NULL AND urn_first_team IS NOT NULL
         AND mb_first_t <= urn_first_t AND mb_first_t <= shr_first_t) AS first_mb,
       count(*) FILTER (mb_first_t IS NOT NULL AND shr_first_t IS NOT NULL AND urn_first_team IS NOT NULL
         AND urn_first_t < mb_first_t AND urn_first_t <= shr_first_t) AS first_urn,
       count(*) FILTER (mb_first_t IS NOT NULL AND shr_first_t IS NOT NULL AND urn_first_team IS NOT NULL
         AND shr_first_t < mb_first_t AND shr_first_t < urn_first_t) AS first_shr,
       count(*) FILTER (mb_first_t IS NOT NULL AND shr_first_t IS NOT NULL AND urn_first_t IS NOT NULL AND f_win = 0) AS f0,
       count(*) FILTER (mb_first_t IS NOT NULL AND shr_first_t IS NOT NULL AND urn_first_t IS NOT NULL AND f_win = 1) AS f1,
       count(*) FILTER (mb_first_t IS NOT NULL AND shr_first_t IS NOT NULL AND urn_first_t IS NOT NULL AND f_win = 2) AS f2,
       count(*) FILTER (mb_first_t IS NOT NULL AND shr_first_t IS NOT NULL AND urn_first_t IS NOT NULL AND f_win = 3) AS f3,
       count(*) FILTER (mb_first_t IS NOT NULL AND shr_first_t IS NOT NULL AND urn_first_t IS NOT NULL AND f_win >= 2) AS maj_wins,
       count(*) FILTER (mb_class IS NOT NULL) AS mb_n,
       count(*) FILTER (mb_class = 'vorn') AS mb_vorn,
       count(*) FILTER (mb_class = 'vorn' AND mb_first_c = wt) AS mb_vorn_wins,
       count(*) FILTER (mb_class = 'gleich') AS mb_gleich,
       count(*) FILTER (mb_class = 'gleich' AND mb_first_c = wt) AS mb_gleich_wins,
       count(*) FILTER (mb_class = 'hinten') AS mb_hinten,
       count(*) FILTER (mb_class = 'hinten' AND mb_first_c = wt) AS mb_hinten_wins,
       count(*) FILTER (mb_class = 'unbekannt') AS mb_unk,
       count(*) FILTER (shr_class IS NOT NULL) AS shr_n,
       count(*) FILTER (shr_class = 'vorn') AS shr_vorn,
       count(*) FILTER (shr_class = 'vorn' AND shr_first_team = wt) AS shr_vorn_wins,
       count(*) FILTER (shr_class = 'gleich') AS shr_gleich,
       count(*) FILTER (shr_class = 'gleich' AND shr_first_team = wt) AS shr_gleich_wins,
       count(*) FILTER (shr_class = 'hinten') AS shr_hinten,
       count(*) FILTER (shr_class = 'hinten' AND shr_first_team = wt) AS shr_hinten_wins,
       count(*) FILTER (shr_class = 'unbekannt') AS shr_unk,
       count(*) FILTER (urn_class IS NOT NULL) AS urn_n,
       count(*) FILTER (urn_class = 'vorn') AS urn_vorn,
       count(*) FILTER (urn_class = 'vorn' AND urn_first_team = wt) AS urn_vorn_wins,
       count(*) FILTER (urn_class = 'gleich') AS urn_gleich,
       count(*) FILTER (urn_class = 'gleich' AND urn_first_team = wt) AS urn_gleich_wins,
       count(*) FILTER (urn_class = 'hinten') AS urn_hinten,
       count(*) FILTER (urn_class = 'hinten' AND urn_first_team = wt) AS urn_hinten_wins,
       count(*) FILTER (urn_class = 'unbekannt') AS urn_unk,
       count(*) FILTER (dels0 + dels1 > 0) AS n_with_delivery,
       sum(dels0) AS dels0_sum,
       sum(dels1) AS dels1_sum,
       count(*) FILTER (urn_first_team IS NOT NULL) AS n_with_first,
       sum(urn_first_t) AS urn_first_t_sum,
       count(*) FILTER (urn_first_team = wt) AS first_team_wins,
       count(*) FILTER (dels0 != dels1) AS n_with_more,
       count(*) FILTER (CASE WHEN dels0 > dels1 THEN 'Team0' WHEN dels1 > dels0 THEN 'Team1' END = wt) AS more_wins
FROM cls
GROUP BY tier
ORDER BY tier;

-- Stichproben zur Methodik
-- Zeilenidentitaet der Match-Felder ueber die 12 Spielerzeilen (Stichprobe)
SELECT min("mid_boss.destroyed_time_s") = max("mid_boss.destroyed_time_s") AS mb_t_same,
       min("mid_boss.team_killed") = max("mid_boss.team_killed") AS mb_k_same,
       min("mid_boss.team_claimed") = max("mid_boss.team_claimed") AS mb_c_same,
       min("objectives.team_objective") = max("objectives.team_objective") AS ob_n_same,
       min("objectives.team") = max("objectives.team") AS ob_t_same,
       min("objectives.destroyed_time_s") = max("objectives.destroyed_time_s") AS ob_d_same,
       min("stats.time_stamp_s") = max("stats.time_stamp_s") AS ts_same
FROM match_player
WHERE match_id = 105553799;

-- Urnen-Zeitreihen des Beispiel-Match aus dem Auftrag
SELECT match_id, team, player_slot,
       "stats.time_stamp_s" AS ts, "stats.gold_treasure" AS gt,
       "stats.gold_boss" AS gb, "stats.gold_boss_orb" AS gbo, "stats.net_worth" AS nw
FROM match_player
WHERE match_id = 104753027
ORDER BY player_slot;

-- Objectives- und Midboss-Struktur eines Beispiel-Match
SELECT match_id, winning_team, duration_s,
       "objectives.team_objective" AS ob_n, "objectives.team" AS ob_t,
       "objectives.destroyed_time_s" AS ob_d, "objectives.first_damage_time_s" AS ob_fd,
       "mid_boss.team_killed" AS mb_k, "mid_boss.team_claimed" AS mb_c,
       "mid_boss.destroyed_time_s" AS mb_t
FROM match_player
WHERE start_time >= TIMESTAMPTZ '2026-09-14 00:00:00+00'
  AND start_time < TIMESTAMPTZ '2026-09-15 00:00:00+00'
  AND game_mode = 'Normal' AND match_mode = 'Ranked'
  AND match_outcome = 'TeamWin'
LIMIT 1;

-- power_up_buffs-Typen (Rift-Pruefung, drei Stunden)
SELECT u.type AS buff_type, count(*) AS n
FROM match_player m, UNNEST(m."power_up_buffs.type") AS u(type)
WHERE m.start_time >= TIMESTAMPTZ '2026-09-14 12:00:00+00'
  AND m.start_time < TIMESTAMPTZ '2026-09-14 15:00:00+00'
  AND m.game_mode = 'Normal' AND m.match_mode = 'Ranked'
GROUP BY u.type
ORDER BY n DESC
LIMIT 60;

-- Urnen-Gegenprobe: Zuwachsserien fuer 20 Stichproben-Match (IDs in urn_check_ids.json)
SELECT match_id, team, player_slot,
       list_filter(list_transform(range(1, len(coalesce("stats.gold_treasure", []))),
         i -> {'t': coalesce("stats.time_stamp_s", [])[i + 1],
               'd': "stats.gold_treasure"[i + 1] - "stats.gold_treasure"[i]}),
         x -> x.d > 0) AS spruenge
FROM match_player
WHERE match_id IN (1, 2)
ORDER BY match_id, team, player_slot;

-- A2 (Paket A2): Siegquote nach Zeitpunkt der Erst-Objectives, tageweise wie QD (hier Tag
-- 2026-08-13) und clientseitig gemergt. Je Ereignis (erster Midboss-Claim, erste Urnen-Abgabe,
-- erster Shrine-Fall) Zeitklassen mal Ranggruppe (1 bis 4, 5 bis 7, 8 bis 11) mit n, Siegen und
-- der Schichtung nach Soul-Vorsprung (mb_class/shr_class/urn_class wie QD) aus einem Durchlauf
-- mit FILTER. Die Zweige hist_mb/hist_shr liefern 60-Sekunden-Histogramme je Rangstufe fuer die
-- Mediane, hist_urn das Histogramm der Urnen-Stuetzpunkte. Ereignisse ohne Zeitangabe
-- (destroyed_time_s nur 0 bzw. fehlende Stuetzstellen) erscheinen mit NULL-Schluessel und werden
-- beim Merge getrennt ausgewiesen. Mediane koennen nicht tageweise gemergt werden und kommen aus
-- den Histogrammen; Urne exakt auf Stuetzpunkten, Midboss und Shrine auf 60 s interpoliert.
WITH raw AS (
  SELECT match_id, account_id, team, created_at, average_badge, winning_team,
         "stats.time_stamp_s" AS ts, "stats.net_worth" AS nw, "stats.gold_treasure" AS gt,
         "mid_boss.destroyed_time_s" AS mb_t, "mid_boss.team_claimed" AS mb_c,
         "mid_boss.team_killed" AS mb_k,
         "objectives.team_objective" AS ob_n, "objectives.team" AS ob_t,
         "objectives.destroyed_time_s" AS ob_d
  FROM match_player
  WHERE start_time >= TIMESTAMPTZ '2026-08-13 00:00:00+00'
    AND start_time < TIMESTAMPTZ '2026-08-14 00:00:00+00'
    AND game_mode = 'Normal' AND match_mode = 'Ranked' AND match_outcome = 'TeamWin'
),
pd AS (
  SELECT match_id, account_id,
         arg_max(team, created_at) AS team,
         arg_max(average_badge, created_at) AS average_badge,
         arg_max(winning_team, created_at) AS winning_team,
         arg_max(ts, created_at) AS ts,
         arg_max(nw, created_at) AS nw,
         arg_max(gt, created_at) AS gt,
         arg_max(mb_t, created_at) AS mb_t,
         arg_max(mb_c, created_at) AS mb_c,
         arg_max(mb_k, created_at) AS mb_k,
         arg_max(ob_n, created_at) AS ob_n,
         arg_max(ob_t, created_at) AS ob_t,
         arg_max(ob_d, created_at) AS ob_d
  FROM raw GROUP BY match_id, account_id
),
m AS (
  SELECT match_id, min(winning_team) AS wt, min(ts) AS ts,
         least(greatest(floor(min(average_badge)/10.0)::INT, 1), 11) AS tier,
         min(mb_t) AS mb_t, min(mb_c) AS mb_c, min(mb_k) AS mb_k,
         min(ob_n) AS ob_n, min(ob_t) AS ob_t, min(ob_d) AS ob_d
  FROM pd GROUP BY match_id
),
mbm AS (
  SELECT match_id, min(t) AS mb_first_t, arg_min(c, t) AS mb_first_c, arg_min(k, t) AS mb_first_k
  FROM (SELECT m.match_id, m.mb_c[g.i] AS c, m.mb_k[g.i] AS k, m.mb_t[g.i] AS t
        FROM m, range(1, len(coalesce(m.mb_t, [])) + 1) AS g(i))
  GROUP BY match_id
),
shrm AS (
  SELECT match_id, min(d) FILTER (d > 0) AS shr_first_t,
         arg_min(t, d) FILTER (d > 0) AS shr_first_owner
  FROM (SELECT m.match_id, m.ob_n[g.i] AS n, m.ob_t[g.i] AS t, m.ob_d[g.i] AS d
        FROM m, range(1, len(coalesce(m.ob_n, [])) + 1) AS g(i))
  WHERE n LIKE 'TitanShieldGenerator%'
  GROUP BY match_id
),
ui AS (
  SELECT match_id, team, x.i AS i, x.d AS d
  FROM pd, UNNEST(list_filter(list_transform(range(1, len(coalesce(gt, []))),
       i -> {'i': i, 'd': gt[i+1] - gt[i]}), x -> x.d > 0)) AS u(x)
),
ug AS (
  SELECT match_id, team, i, count(*) AS npos, min(d) AS dmin
  FROM ui
  GROUP BY match_id, team, i
),
ud AS (
  SELECT ui.match_id AS match_id, ui.team AS team, ui.i AS i
  FROM ui JOIN ug ON ui.match_id = ug.match_id AND ui.team = ug.team AND ui.i = ug.i
  GROUP BY ui.match_id, ui.team, ui.i, ug.dmin
  HAVING ug.dmin > 0 AND count(*) FILTER (ui.d = ug.dmin) >= 5
),
uteam AS (
  SELECT match_id, team, count(*) AS dels, min(i) AS fi
  FROM ud
  GROUP BY match_id, team
),
ev AS (
  SELECT m.match_id, m.wt, m.tier, m.ts,
         mbm.mb_first_t, mbm.mb_first_c, mbm.mb_first_k, shrm.shr_first_t,
         CASE WHEN shrm.shr_first_owner = 'Team0' THEN 'Team1' ELSE 'Team0' END AS shr_first_team,
         u0.fi AS fi0, u1.fi AS fi1,
         CASE WHEN u1.fi IS NULL OR u0.fi < u1.fi THEN 'Team0'
              WHEN u0.fi IS NULL OR u1.fi < u0.fi THEN 'Team1' END AS urn_first_team,
         least(u0.fi, u1.fi) AS urn_fi
  FROM m
  LEFT JOIN mbm USING (match_id)
  LEFT JOIN shrm USING (match_id)
  LEFT JOIN uteam u0 ON m.match_id = u0.match_id AND u0.team = 'Team0'
  LEFT JOIN uteam u1 ON m.match_id = u1.match_id AND u1.team = 'Team1'
),
ev2 AS (
  SELECT *,
         len(list_filter(ts, x -> x < mb_first_t)) AS idx_mb,
         len(list_filter(ts, x -> x < shr_first_t)) AS idx_shr,
         coalesce(urn_fi, 0) AS idx_urn,
         CASE WHEN urn_fi IS NOT NULL THEN ts[urn_fi + 1] END AS urn_first_t
  FROM ev
),
p2 AS (
  SELECT pd.match_id, pd.team, ev2.wt, ev2.tier, ev2.mb_first_t, ev2.mb_first_c, ev2.mb_first_k,
         ev2.shr_first_t, ev2.shr_first_team, ev2.urn_first_team, ev2.urn_first_t,
         ev2.idx_mb, ev2.idx_shr, ev2.idx_urn,
         CASE WHEN ev2.idx_mb > 0 THEN coalesce(pd.nw, [])[ev2.idx_mb] END AS nw_mb,
         CASE WHEN ev2.idx_shr > 0 THEN coalesce(pd.nw, [])[ev2.idx_shr] END AS nw_shr,
         CASE WHEN ev2.idx_urn > 0 THEN coalesce(pd.nw, [])[ev2.idx_urn] END AS nw_urn
  FROM pd JOIN ev2 USING (match_id)
),
agg AS (
  SELECT match_id, any_value(wt) AS wt, any_value(tier) AS tier,
         any_value(mb_first_t) AS mb_first_t, any_value(mb_first_c) AS mb_first_c,
         any_value(mb_first_k) AS mb_first_k,
         any_value(shr_first_t) AS shr_first_t, any_value(shr_first_team) AS shr_first_team,
         any_value(urn_first_team) AS urn_first_team, any_value(urn_first_t) AS urn_first_t,
         any_value(idx_mb) AS idx_mb, any_value(idx_shr) AS idx_shr, any_value(idx_urn) AS idx_urn,
         sum(CASE WHEN team = 'Team0' THEN nw_mb END) AS mb_s0,
         sum(CASE WHEN team = 'Team1' THEN nw_mb END) AS mb_s1,
         sum(CASE WHEN team = 'Team0' THEN nw_shr END) AS shr_s0,
         sum(CASE WHEN team = 'Team1' THEN nw_shr END) AS shr_s1,
         sum(CASE WHEN team = 'Team0' THEN nw_urn END) AS urn_s0,
         sum(CASE WHEN team = 'Team1' THEN nw_urn END) AS urn_s1,
         count(*) FILTER (team = 'Team0' AND nw_mb IS NULL)
           + count(*) FILTER (team = 'Team1' AND nw_mb IS NULL) AS mb_nulls,
         count(*) FILTER (team = 'Team0' AND nw_shr IS NULL)
           + count(*) FILTER (team = 'Team1' AND nw_shr IS NULL) AS shr_nulls,
         count(*) FILTER (team = 'Team0' AND nw_urn IS NULL)
           + count(*) FILTER (team = 'Team1' AND nw_urn IS NULL) AS urn_nulls
  FROM p2 GROUP BY match_id
),
cls AS (
  SELECT *,
         CASE WHEN mb_first_c IS NULL THEN NULL
              WHEN idx_mb = 0 OR mb_nulls > 0 OR mb_s0 IS NULL OR mb_s1 IS NULL THEN 'unbekannt'
              WHEN (CASE WHEN mb_first_c = 'Team0' THEN mb_s0 ELSE mb_s1 END)
                   > 1.05 * (CASE WHEN mb_first_c = 'Team0' THEN mb_s1 ELSE mb_s0 END) THEN 'vorn'
              WHEN (CASE WHEN mb_first_c = 'Team0' THEN mb_s0 ELSE mb_s1 END)
                   >= 0.95 * (CASE WHEN mb_first_c = 'Team0' THEN mb_s1 ELSE mb_s0 END) THEN 'gleich'
              ELSE 'hinten' END AS mb_class,
         CASE WHEN shr_first_team IS NULL THEN NULL
              WHEN idx_shr = 0 OR shr_nulls > 0 OR shr_s0 IS NULL OR shr_s1 IS NULL THEN 'unbekannt'
              WHEN (CASE WHEN shr_first_team = 'Team0' THEN shr_s0 ELSE shr_s1 END)
                   > 1.05 * (CASE WHEN shr_first_team = 'Team0' THEN shr_s1 ELSE shr_s0 END) THEN 'vorn'
              WHEN (CASE WHEN shr_first_team = 'Team0' THEN shr_s0 ELSE shr_s1 END)
                   >= 0.95 * (CASE WHEN shr_first_team = 'Team0' THEN shr_s1 ELSE shr_s0 END) THEN 'gleich'
              ELSE 'hinten' END AS shr_class,
         CASE WHEN urn_first_team IS NULL THEN NULL
              WHEN idx_urn = 0 OR urn_nulls > 0 OR urn_s0 IS NULL OR urn_s1 IS NULL THEN 'unbekannt'
              WHEN (CASE WHEN urn_first_team = 'Team0' THEN urn_s0 ELSE urn_s1 END)
                   > 1.05 * (CASE WHEN urn_first_team = 'Team0' THEN urn_s1 ELSE urn_s0 END) THEN 'vorn'
              WHEN (CASE WHEN urn_first_team = 'Team0' THEN urn_s0 ELSE urn_s1 END)
                   >= 0.95 * (CASE WHEN urn_first_team = 'Team0' THEN urn_s1 ELSE urn_s0 END) THEN 'gleich'
              ELSE 'hinten' END AS urn_class
  FROM agg
),
gr AS (
  SELECT tier, wt, mb_first_t, mb_first_c, mb_first_k, shr_first_t, shr_first_team,
         urn_first_t, urn_first_team, mb_class, shr_class, urn_class,
         CASE WHEN tier <= 4 THEN 'niedrig' WHEN tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg
  FROM cls
),
zeilen AS (
  SELECT 'mb' AS event, (mb_first_t // 300) * 300 AS b0, tg AS grp,
         count(*) AS n, count(*) FILTER (mb_first_c = wt) AS wins,
         count(*) FILTER (mb_class = 'vorn') AS n_vorn,
         count(*) FILTER (mb_class = 'vorn' AND mb_first_c = wt) AS w_vorn,
         count(*) FILTER (mb_class = 'gleich') AS n_gleich,
         count(*) FILTER (mb_class = 'gleich' AND mb_first_c = wt) AS w_gleich,
         count(*) FILTER (mb_class = 'hinten') AS n_hinten,
         count(*) FILTER (mb_class = 'hinten' AND mb_first_c = wt) AS w_hinten,
         count(*) FILTER (mb_class = 'unbekannt') AS n_unb,
         count(*) FILTER (mb_class = 'unbekannt' AND mb_first_c = wt) AS w_unb,
         count(*) FILTER (mb_first_k != mb_first_c) AS steals,
         NULL::VARCHAR AS hist
  FROM gr WHERE mb_first_c IS NOT NULL GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'shr' AS event, (shr_first_t // 300) * 300 AS b0, tg AS grp,
         count(*) AS n, count(*) FILTER (shr_first_team = wt) AS wins,
         count(*) FILTER (shr_class = 'vorn') AS n_vorn,
         count(*) FILTER (shr_class = 'vorn' AND shr_first_team = wt) AS w_vorn,
         count(*) FILTER (shr_class = 'gleich') AS n_gleich,
         count(*) FILTER (shr_class = 'gleich' AND shr_first_team = wt) AS w_gleich,
         count(*) FILTER (shr_class = 'hinten') AS n_hinten,
         count(*) FILTER (shr_class = 'hinten' AND shr_first_team = wt) AS w_hinten,
         count(*) FILTER (shr_class = 'unbekannt') AS n_unb,
         count(*) FILTER (shr_class = 'unbekannt' AND shr_first_team = wt) AS w_unb,
         0 AS steals,
         NULL::VARCHAR AS hist
  FROM gr WHERE shr_first_team IS NOT NULL GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'urn' AS event, urn_first_t AS b0, tg AS grp,
         count(*) AS n, count(*) FILTER (urn_first_team = wt) AS wins,
         count(*) FILTER (urn_class = 'vorn') AS n_vorn,
         count(*) FILTER (urn_class = 'vorn' AND urn_first_team = wt) AS w_vorn,
         count(*) FILTER (urn_class = 'gleich') AS n_gleich,
         count(*) FILTER (urn_class = 'gleich' AND urn_first_team = wt) AS w_gleich,
         count(*) FILTER (urn_class = 'hinten') AS n_hinten,
         count(*) FILTER (urn_class = 'hinten' AND urn_first_team = wt) AS w_hinten,
         count(*) FILTER (urn_class = 'unbekannt') AS n_unb,
         count(*) FILTER (urn_class = 'unbekannt' AND urn_first_team = wt) AS w_unb,
         0 AS steals,
         NULL::VARCHAR AS hist
  FROM gr WHERE urn_first_team IS NOT NULL GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'hist_mb' AS event, 0 AS b0, tier::VARCHAR AS grp, count(*) AS n,
         0 AS wins, 0 AS n_vorn, 0 AS w_vorn, 0 AS n_gleich, 0 AS w_gleich,
         0 AS n_hinten, 0 AS w_hinten, 0 AS n_unb, 0 AS w_unb, 0 AS steals,
         to_json(histogram(mb_first_t // 60))::VARCHAR AS hist
  FROM gr WHERE mb_first_c IS NOT NULL GROUP BY tier
  UNION ALL
  SELECT 'hist_shr' AS event, 0 AS b0, tier::VARCHAR AS grp, count(*) AS n,
         0 AS wins, 0 AS n_vorn, 0 AS w_vorn, 0 AS n_gleich, 0 AS w_gleich,
         0 AS n_hinten, 0 AS w_hinten, 0 AS n_unb, 0 AS w_unb, 0 AS steals,
         to_json(histogram(shr_first_t // 60))::VARCHAR AS hist
  FROM gr WHERE shr_first_team IS NOT NULL GROUP BY tier
  UNION ALL
  SELECT 'hist_urn' AS event, 0 AS b0, tier::VARCHAR AS grp, count(*) AS n,
         0 AS wins, 0 AS n_vorn, 0 AS w_vorn, 0 AS n_gleich, 0 AS w_gleich,
         0 AS n_hinten, 0 AS w_hinten, 0 AS n_unb, 0 AS w_unb, 0 AS steals,
         to_json(histogram(urn_first_t))::VARCHAR AS hist
  FROM gr WHERE urn_first_team IS NOT NULL GROUP BY tier
)
SELECT * FROM zeilen ORDER BY event, b0, grp

-- Q8: K8 Urnen-Laeufer je Ranggruppe (gleiche Abfrage tageweise, hier Tag 2026-08-13).
-- Läufer = eindeutiges Maximum des gold_treasure-Zuwachses im Abgabe-Intervall über dem Team-Minimum,
-- sonst unbekannt; dazu Rang im Team, Tode im Abgabe-Intervall, Soul-Swing gegen Intervalle ohne
-- Abgabe, Endstatistik gegen den Kollegen-Median. Grid = Stützstelle auf dem Raster, Payload als JSON.
WITH raw AS (
  SELECT match_id, account_id, team, created_at, average_badge, winning_team,
         "stats.time_stamp_s" AS ts, "stats.net_worth" AS nws, "stats.gold_treasure" AS gt,
         "death_details.game_time_s" AS dts,
         hero_id, assigned_lane, net_worth AS nwe, kills, deaths
  FROM match_player
  WHERE start_time >= TIMESTAMPTZ '2026-08-13 00:00:00+00'
    AND start_time < TIMESTAMPTZ '2026-08-14 00:00:00+00'
    AND game_mode = 'Normal' AND match_mode = 'Ranked' AND match_outcome = 'TeamWin'
),
pd AS (
  SELECT match_id, account_id,
         arg_max(team, created_at) AS team,
         arg_max(average_badge, created_at) AS average_badge,
         arg_max(winning_team, created_at) AS winning_team,
         arg_max(ts, created_at) AS ts,
         arg_max(nws, created_at) AS nws,
         arg_max(gt, created_at) AS gt,
         arg_max(dts, created_at) AS dts,
         arg_max(hero_id, created_at) AS hero_id,
         arg_max(assigned_lane, created_at) AS assigned_lane,
         arg_max(nwe, created_at) AS nwe,
         arg_max(kills, created_at) AS kills,
         arg_max(deaths, created_at) AS deaths
  FROM raw GROUP BY match_id, account_id
),
m AS (
  SELECT match_id, min(winning_team) AS wt, min(ts) AS ts,
         least(greatest(floor(min(average_badge)/10.0)::INT, 1), 11) AS tier
  FROM pd GROUP BY match_id
),
ui AS (
  SELECT match_id, team, account_id, x.i AS i, x.d AS d
  FROM pd, UNNEST(list_filter(list_transform(range(1, len(coalesce(gt, []))),
       i -> {'i': i, 'd': gt[i+1] - gt[i]}), x -> x.d > 0)) AS u(x)
),
ug AS (
  SELECT match_id, team, i, count(*) AS npos, min(d) AS dmin
  FROM ui GROUP BY match_id, team, i
),
umax AS (
  SELECT match_id, team, i, max(d) AS maxd
  FROM ui GROUP BY match_id, team, i
),
udel AS (
  SELECT ui.match_id AS match_id, ui.team AS team, ui.i AS i,
         ug.dmin AS dmin, um.maxd AS maxd,
         count(*) FILTER (ui.d = ug.dmin) AS an_min,
         count(*) FILTER (ui.d = um.maxd) AS an_max,
         min(CASE WHEN ui.d = um.maxd THEN ui.account_id END) AS l_acct
  FROM ui
  JOIN ug ON ui.match_id = ug.match_id AND ui.team = ug.team AND ui.i = ug.i
  JOIN umax um ON ui.match_id = um.match_id AND ui.team = um.team AND ui.i = um.i
  GROUP BY 1, 2, 3, 4, 5
  HAVING ug.dmin > 0 AND count(*) FILTER (ui.d = ug.dmin) >= 5
),
dlv AS (
  SELECT d.match_id AS match_id, d.team AS team, d.i AS i,
         (d.maxd > d.dmin AND d.an_max = 1) AS hat_laeufer,
         d.l_acct AS l_acct, m.tier AS tier, m.wt AS wt,
         m.ts[d.i] AS t0, m.ts[d.i + 1] AS t1
  FROM udel d JOIN m ON m.match_id = d.match_id
),
pidx AS (
  SELECT p.match_id AS match_id, p.account_id AS account_id, p.team AS team, g.k AS k,
         p.nws[g.k] AS nwk
  FROM pd p JOIN m ON m.match_id = p.match_id,
       range(1, len(m.ts) + 1) AS g(k)
),
lsum AS (
  SELECT match_id, k,
         sum(CASE WHEN team = 'Team0' THEN nwk END) AS s0,
         sum(CASE WHEN team = 'Team1' THEN nwk END) AS s1,
         count(*) FILTER (nwk IS NULL) AS nnull
  FROM pidx GROUP BY match_id, k
),
lead AS (
  SELECT match_id, k, CASE WHEN nnull = 0 THEN s0 - s1 END AS lead0
  FROM lsum
),
trank AS (
  SELECT p.match_id AS match_id, p.team AS team, p.k AS i, p.account_id AS acct,
         1 + count(*) FILTER (q.nwk > p.nwk) AS rk,
         count(*) FILTER (q.nwk IS NULL OR p.nwk IS NULL) AS nnull
  FROM pidx p
  JOIN (SELECT DISTINCT match_id, i FROM dlv) dd ON dd.match_id = p.match_id AND dd.i = p.k
  JOIN pidx q ON q.match_id = p.match_id AND q.team = p.team AND q.k = p.k
             AND q.account_id != p.account_id
  GROUP BY 1, 2, 3, 4
),
roster AS (
  SELECT match_id, team,
         list(struct_pack(a := account_id, n := nwe, k := kills, d := deaths)) AS ros
  FROM pd GROUP BY match_id, team
),
r AS (
  SELECT d.match_id AS match_id, d.team AS team, d.wt AS wt,
         CASE WHEN d.tier <= 4 THEN 'niedrig' WHEN d.tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg,
         p.hero_id AS hero_id, p.assigned_lane AS lane,
         p.nwe AS l_nwe, p.kills AS l_kills, p.deaths AS l_deaths,
         tr.rk AS rk, tr.nnull AS rk_null,
         list_sort(list_transform(list_filter(ro.ros, x -> x.a != d.l_acct), x -> x.n))[3] AS m_nw,
         list_sort(list_transform(list_filter(ro.ros, x -> x.a != d.l_acct), x -> x.k))[3] AS m_k,
         list_sort(list_transform(list_filter(ro.ros, x -> x.a != d.l_acct), x -> x.d))[3] AS m_d
  FROM dlv d
  JOIN pd p ON p.match_id = d.match_id AND p.account_id = d.l_acct
  JOIN roster ro ON ro.match_id = d.match_id AND ro.team = d.team
  LEFT JOIN trank tr ON tr.match_id = d.match_id AND tr.team = d.team AND tr.i = d.i
                    AND tr.acct = d.l_acct
  WHERE d.hat_laeufer
),
dsw AS (
  SELECT CASE WHEN d.tier <= 4 THEN 'niedrig' WHEN d.tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg,
         CASE WHEN d.t1 <= 900 THEN ((d.t1 + 179) // 180) * 180 ELSE 900 + ((d.t1 - 900 + 299) // 300) * 300 END AS grid,
         CASE WHEN la.lead0 IS NOT NULL AND lb.lead0 IS NOT NULL
              THEN (CASE WHEN d.team = 'Team0' THEN 1 ELSE -1 END) * (lb.lead0 - la.lead0) END AS delta,
         abs(CASE WHEN la.lead0 IS NOT NULL AND lb.lead0 IS NOT NULL
              THEN (CASE WHEN d.team = 'Team0' THEN 1 ELSE -1 END) * (lb.lead0 - la.lead0) END) AS adelta
  FROM dlv d
  JOIN lead la ON la.match_id = d.match_id AND la.k = d.i
  JOIN lead lb ON lb.match_id = d.match_id AND lb.k = d.i + 1
),
dlint AS (SELECT DISTINCT match_id, i FROM dlv),
nsw AS (
  SELECT CASE WHEN m.tier <= 4 THEN 'niedrig' WHEN m.tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg,
         CASE WHEN m.ts[la.k + 1] <= 900 THEN ((m.ts[la.k + 1] + 179) // 180) * 180 ELSE 900 + ((m.ts[la.k + 1] - 900 + 299) // 300) * 300 END AS grid,
         t.sgn * (lb.lead0 - la.lead0) AS delta,
         abs(t.sgn * (lb.lead0 - la.lead0)) AS adelta
  FROM lead la
  JOIN lead lb ON lb.match_id = la.match_id AND lb.k = la.k + 1
  JOIN m ON m.match_id = la.match_id
  CROSS JOIN (VALUES ('Team0', 1), ('Team1', -1)) AS t(tname, sgn)
  WHERE NOT EXISTS (SELECT 1 FROM dlint x WHERE x.match_id = la.match_id AND x.i = la.k)
),
runners AS (
  SELECT DISTINCT match_id, l_acct AS acct FROM dlv WHERE hat_laeufer
),
runs AS (
  SELECT x.match_id AS match_id, x.acct AS acct, p.team AS team, m.ts AS mts,
         coalesce(p.dts, []) AS dl, m.tier AS tier
  FROM runners x
  JOIN pd p ON p.match_id = x.match_id AND p.account_id = x.acct
  JOIN m ON m.match_id = x.match_id
),
rint AS (
  SELECT ru.match_id AS match_id, ru.acct AS acct, ru.team AS team,
         CASE WHEN ru.tier <= 4 THEN 'niedrig' WHEN ru.tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg,
         g.k AS k, ru.mts[g.k] AS t0, ru.mts[g.k + 1] AS t1,
         (ru.mts[g.k + 1]::BIGINT - ru.mts[g.k]::BIGINT) AS sec,
         len(list_filter(ru.dl, y -> y >= ru.mts[g.k] AND y < ru.mts[g.k + 1])) AS nd
  FROM runs ru, range(1, len(ru.mts)) AS g(k)
),
rint2 AS (
  SELECT x.*, CASE WHEN di.i IS NOT NULL THEN 1 ELSE 0 END AS is_del
  FROM rint x
  LEFT JOIN (SELECT match_id, l_acct, i FROM dlv WHERE hat_laeufer) di
    ON di.match_id = x.match_id AND di.l_acct = x.acct AND di.i = x.k
),
zeilen AS (
  SELECT 'swing_del' AS zeile, tg, grid, count(*) AS n,
         to_json(struct_pack(s := sum(delta), sa := sum(adelta),
                             nn := count(*) FILTER (delta IS NULL)))::VARCHAR AS payload
  FROM dsw GROUP BY tg, grid
  UNION ALL
  SELECT 'swing_ohne' AS zeile, tg, grid, count(*) AS n,
         to_json(struct_pack(sa := sum(adelta), nn := count(*) FILTER (adelta IS NULL)))::VARCHAR AS payload
  FROM nsw GROUP BY tg, grid
  UNION ALL
  SELECT 'swing_del_pool' AS zeile, tg, NULL AS grid, count(*) AS n,
         to_json(struct_pack(s := sum(delta), sa := sum(adelta), nn := count(*) FILTER (delta IS NULL),
                             h := to_json(histogram(greatest(-24, least(24, delta // 2500)))),
                             ha := to_json(histogram(greatest(24, least(48, adelta // 2500 + 24))))))::VARCHAR AS payload
  FROM dsw GROUP BY tg
  UNION ALL
  SELECT 'swing_ohne_pool' AS zeile, tg, NULL AS grid, count(*) AS n,
         to_json(struct_pack(sa := sum(adelta), nn := count(*) FILTER (adelta IS NULL),
                             ha := to_json(histogram(greatest(24, least(48, adelta // 2500 + 24))))))::VARCHAR AS payload
  FROM nsw GROUP BY tg
  UNION ALL
  SELECT 'laeufer' AS zeile, tg, NULL AS grid, count(*) AS n,
         to_json(struct_pack(
           wins := count(*) FILTER (wt = team),
           rk1 := count(*) FILTER (rk = 1), rk2 := count(*) FILTER (rk = 2),
           rk3 := count(*) FILTER (rk = 3), rk4 := count(*) FILTER (rk = 4),
           rk5 := count(*) FILTER (rk = 5), rk6 := count(*) FILTER (rk = 6),
           rk_unk := count(*) FILTER (rk IS NULL OR rk_null > 0),
           hh := to_json(histogram(hero_id)), hl := to_json(histogram(lane)),
           nw_ueber := count(*) FILTER (l_nwe > m_nw),
           nw_gleich := count(*) FILTER (l_nwe = m_nw),
           nw_unter := count(*) FILTER (l_nwe < m_nw),
           k_ueber := count(*) FILTER (l_kills > m_k),
           k_gleich := count(*) FILTER (l_kills = m_k),
           k_unter := count(*) FILTER (l_kills < m_k),
           d_ueber := count(*) FILTER (l_deaths > m_d),
           d_gleich := count(*) FILTER (l_deaths = m_d),
           d_unter := count(*) FILTER (l_deaths < m_d),
           s_nw := sum(l_nwe), s_mnw := sum(m_nw),
           s_k := sum(l_kills), s_mk := sum(m_k),
           s_d := sum(l_deaths), s_md := sum(m_d),
           hn := to_json(histogram(greatest(-20, least(20, (l_nwe::BIGINT - m_nw::BIGINT) // 5000)))),
           hk := to_json(histogram(greatest(-15, least(15, l_kills::BIGINT - m_k::BIGINT)))),
           hd := to_json(histogram(greatest(-15, least(15, l_deaths::BIGINT - m_d::BIGINT))))
         ))::VARCHAR AS payload
  FROM r GROUP BY tg
  UNION ALL
  SELECT 'laeufer_unk' AS zeile,
         CASE WHEN tier <= 4 THEN 'niedrig' WHEN tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg,
         NULL AS grid, count(*) AS n, '{}'::VARCHAR AS payload
  FROM dlv WHERE NOT hat_laeufer GROUP BY 2
  UNION ALL
  SELECT 'tod' AS zeile, tg, NULL AS grid,
         count(*) FILTER (is_del = 1) AS n,
         to_json(struct_pack(
           del_ints := count(*) FILTER (is_del = 1),
           del_tod_ints := count(*) FILTER (is_del = 1 AND nd > 0),
           del_tode := sum(nd) FILTER (is_del = 1),
           del_sek := sum(sec) FILTER (is_del = 1),
           oth_ints := count(*) FILTER (is_del = 0),
           oth_tod_ints := count(*) FILTER (is_del = 0 AND nd > 0),
           oth_tode := sum(nd) FILTER (is_del = 0),
           oth_sek := sum(sec) FILTER (is_del = 0)
         ))::VARCHAR AS payload
  FROM rint2 GROUP BY tg
)
SELECT zeile, tg, grid, n, payload FROM zeilen ORDER BY zeile, tg, grid NULLS LAST
