CREATE TEMP TABLE match_player (
  match_id BIGINT, player_slot INTEGER, created_at TIMESTAMPTZ,
  winning_team VARCHAR, average_badge INTEGER, duration_s INTEGER,
  game_mode_version INTEGER, team VARCHAR, abandon_match_time_s INTEGER,
  "objectives.team_objective" VARCHAR[], "objectives.team" VARCHAR[],
  "objectives.destroyed_time_s" BIGINT[], "stats.time_stamp_s" BIGINT[],
  "stats.net_worth" BIGINT[], game_mode VARCHAR, match_mode VARCHAR, match_outcome VARCHAR
);
WITH fixtures(id, winner, badge, duration_s, names, owners, times) AS (
  VALUES
  (1, 'Team0', 40, 2400, ['BarrackBossLane1', 'BarrackBossLane3', 'BarrackBossLane4', 'BarrackBossLane1'], ['Team1', 'Team1', 'Team1', 'Team0'], [900, 1200, 1800, 1500]),
  (2, 'Team1', 60, 1800, ['BarrackBossLane1', 'BarrackBossLane1'], ['Team1', 'Team0'], [1200, 1250]),
  (3, 'Team0', 90, 1600, ['BarrackBossLane1', 'BarrackBossLane1'], ['Team1', 'Team0'], [1500, 1500]),
  (4, 'Team0', NULL, 2000, [], [], []),
  (5, 'Team1', 41, 1000, ['BarrackBossLane1'], ['Team0'], [0]),
  (6, 'Team0', 70, 1800, ['BarrackBossLane1', 'BarrackBossLane1'], ['Team1', 'Team1'], [900, 900]),
  (7, 'Team0', 40, 1800, ['BarrackBossLane1'], ['Team1'], [2000]),
  (8, 'Team0', 40, 1800, ['BarrackBossLane1', 'BarrackBossLane3'], ['Team1'], [900]),
  (9, 'Team0', 40, 1800, ['BarrackBossLane2'], ['Team1'], [900]),
  (10, 'Team1', 80, 1700, ['BarrackBossLane1'], ['Team0'], [100]),
  (11, 'Team0', 70, 900, ['BarrackBossLane1'], ['Team1'], [900]),
  (12, 'Team0', 40, 1800, ['BarrackBossLane1'], ['Team1'], [900]),
  (13, 'Team0', 40, 1800, ['BarrackBossLane1'], ['Team1'], [900]),
  (14, 'Team0', 40, 1800, ['BarrackBossLane1', 'BarrackBossLane1'], ['Team1', 'Team1'], [900, 1000]),
  (15, 'Team0', 40, 1800, ['BarrackBossLane1'], ['Team1'], [900]),
  (16, 'Team1', 60, 2100, ['BarrackBossLane1', 'BarrackBossLane3'], ['Team1', 'Team1'], [900, 900]),
  (17, 'Team0', 40, 1800, ['BarrackBossLane1'], ['Team1'], [900]),
  (18, 'Team0', 40, 1800, ['BarrackBossLane1'], ['Team1'], [900]),
  (19, 'Team0', 40, 1800, ['BarrackBossLane1'], ['Team1'], [-10]),
  (20, 'Team0', 40, 1800, ['BarrackBossLane1'], ['Team2'], [900])
)
INSERT INTO match_player
SELECT 106000000 + f.id, s.slot, TIMESTAMPTZ '2026-09-22 00:00:00+00',
  CASE WHEN f.id = 15 AND s.slot = 12 THEN 'Team1' ELSE f.winner END,
  f.badge, f.duration_s, 2,
  CASE WHEN s.slot <= 6 THEN 'Team0' ELSE 'Team1' END,
  CASE WHEN f.id = 2 AND s.slot = 12 THEN 180 ELSE 0 END,
  list_concat(f.names, ['Core']),
  list_concat(f.owners, [CASE WHEN f.winner = 'Team0' THEN 'Team1' ELSE 'Team0' END]),
  list_concat(f.times, [f.duration_s::BIGINT]),
  CASE WHEN f.id = 18 THEN [0] ELSE [600,900,1200,1500,1800,2100] END,
  CASE WHEN f.id = 17 AND s.slot = 12 THEN NULL
    WHEN f.id = 18 THEN [1000]
    WHEN f.id = 1 AND s.slot <= 6 THEN [1000,3000,3500,4000,4500,5000]
    WHEN f.id = 2 AND s.slot <= 6 THEN [800,800,900,1000,1100,1200]
    ELSE [1000,1000,1000,1000,1000,1000] END,
  'Normal', 'Ranked', 'TeamWin'
FROM fixtures f CROSS JOIN range(1,13) AS s(slot)
WHERE NOT (f.id = 12 AND s.slot = 12);

INSERT INTO match_player
SELECT * REPLACE (TIMESTAMPTZ '2026-09-21 00:00:00+00' AS created_at,
  'Team1' AS winning_team)
FROM match_player WHERE match_id = 106000001 AND player_slot = 1;

INSERT INTO match_player
SELECT * REPLACE ([999,999,999,999,999,999] AS "stats.net_worth")
FROM match_player WHERE match_id = 106000013 AND player_slot = 1;

INSERT INTO match_player
SELECT * REPLACE (106000021 AS match_id,
  []::VARCHAR[] AS "objectives.team_objective",
  []::VARCHAR[] AS "objectives.team",
  []::BIGINT[] AS "objectives.destroyed_time_s")
FROM match_player WHERE match_id = 106000005;

WITH raw AS MATERIALIZED (
  SELECT match_id, player_slot, created_at,
    struct_pack(
      w := winning_team, b := average_badge, d := duration_s,
      v := game_mode_version, team := team, ab := abandon_match_time_s,
      n := "objectives.team_objective", o := "objectives.team",
      t := "objectives.destroyed_time_s", ts := "stats.time_stamp_s",
      nw := "stats.net_worth"
    ) AS p
  FROM match_player
  WHERE match_id >= 106000000 AND match_id < 107000000
    AND game_mode = 'Normal' AND match_mode = 'Ranked'
    AND match_outcome = 'TeamWin'
), latest AS (
  SELECT *, max(created_at) OVER (PARTITION BY match_id, player_slot) AS latest_at
  FROM raw
), pd AS MATERIALIZED (
  SELECT match_id, player_slot, any_value(p) AS p,
    count(DISTINCT p) AS latest_versions
  FROM latest WHERE created_at = latest_at
  GROUP BY match_id, player_slot
), matches AS MATERIALIZED (
  SELECT match_id, any_value(p) AS p, count(*) AS players,
    count(*) FILTER (p.team = 'Team0') AS team0_players,
    count(*) FILTER (p.team = 'Team1') AS team1_players,
    count(*) FILTER (player_slot IS NULL OR player_slot NOT BETWEEN 1 AND 12) AS bad_slots,
    max(latest_versions) AS latest_versions,
    count(DISTINCT struct_pack(w := p.w, b := p.b, d := p.d, v := p.v,
      n := p.n, o := p.o, t := p.t)) AS metadata_versions,
    bool_or(p.ab > 0) AS has_abandon
  FROM pd GROUP BY match_id
), complete AS MATERIALIZED (
  SELECT * FROM matches
  WHERE players = 12 AND team0_players = 6 AND team1_players = 6
    AND bad_slots = 0 AND latest_versions = 1 AND metadata_versions = 1
    AND p.w IN ('Team0', 'Team1') AND p.d > 0
    AND p.n IS NOT NULL AND p.o IS NOT NULL AND p.t IS NOT NULL
    AND len(p.n) = len(p.o) AND len(p.n) = len(p.t)
    AND len(list_filter(list_zip(p.n, p.o, p.t), x ->
      x[1] = 'Core' AND x[2] IN ('Team0', 'Team1') AND x[2] <> p.w
      AND x[3] > 0 AND x[3] <= p.d)) = 1
), base_rows AS MATERIALIZED (
  SELECT match_id, p.d::BIGINT AS duration_s, x[1] AS objective,
    x[2] AS defender, x[3]::BIGINT AS fallen_at
  FROM complete, UNNEST(list_zip(p.n, p.o, p.t)) AS u(x)
  WHERE starts_with(x[1], 'BarrackBossLane')
), invalid_base AS (
  SELECT DISTINCT match_id FROM base_rows
  WHERE objective NOT IN ('BarrackBossLane1', 'BarrackBossLane3', 'BarrackBossLane4')
    OR defender IS NULL OR defender NOT IN ('Team0', 'Team1')
    OR fallen_at IS NULL OR fallen_at < 0 OR fallen_at > duration_s
  UNION
  SELECT match_id FROM base_rows WHERE fallen_at > 0
  GROUP BY match_id, objective, defender
  HAVING count(DISTINCT fallen_at) > 1
), eligible AS MATERIALIZED (
  SELECT *, CASE WHEN p.b BETWEEN 10 AND 49 THEN 'low'
    WHEN p.b BETWEEN 50 AND 79 THEN 'mid'
    WHEN p.b BETWEEN 80 AND 119 THEN 'high' ELSE 'unknown' END AS elo
  FROM complete WHERE match_id NOT IN (SELECT match_id FROM invalid_base)
), base_events AS MATERIALIZED (
  SELECT DISTINCT b.match_id, b.objective, b.defender, b.fallen_at
  FROM base_rows b JOIN eligible e USING (match_id)
  WHERE b.fallen_at > 0
), first_times AS (
  SELECT match_id, min(fallen_at) AS fallen_at
  FROM base_events GROUP BY match_id
), first_candidates AS MATERIALIZED (
  SELECT b.match_id, f.fallen_at, min(b.defender) AS defender,
    count(DISTINCT b.defender) AS defenders
  FROM first_times f JOIN base_events b
    ON b.match_id = f.match_id AND b.fallen_at = f.fallen_at
  GROUP BY b.match_id, f.fallen_at
), ordered AS (
  SELECT *, row_number() OVER (
    PARTITION BY match_id, defender ORDER BY fallen_at, objective
  ) AS milestone
  FROM base_events
), observation_events AS MATERIALIZED (
  SELECT match_id, 'first' AS event_type, 1 AS milestone, defender, fallen_at
  FROM first_candidates WHERE defenders = 1
  UNION ALL
  SELECT match_id, 'milestone' AS event_type, milestone, defender, fallen_at
  FROM ordered
), checkpoints AS MATERIALIZED (
  SELECT pd.match_id, x[1]::BIGINT AS sample_at,
    sum(x[2]) FILTER (pd.p.team = 'Team0') AS souls0,
    sum(x[2]) FILTER (pd.p.team = 'Team1') AS souls1
  FROM pd JOIN eligible e USING (match_id),
    UNNEST(list_zip(pd.p.ts, pd.p.nw)) AS u(x)
  WHERE pd.p.ts IS NOT NULL AND pd.p.nw IS NOT NULL
    AND len(pd.p.ts) = len(pd.p.nw)
    AND x[1] >= 0 AND x[1] <= e.p.d AND x[2] IS NOT NULL AND x[2] >= 0
  GROUP BY pd.match_id, x[1]
  HAVING count(*) = 12 AND count(DISTINCT pd.player_slot) = 12
    AND count(*) FILTER (pd.p.team = 'Team0') = 6
    AND count(*) FILTER (pd.p.team = 'Team1') = 6
), event_pre AS (
  SELECT o.match_id, o.event_type, o.milestone, o.defender, o.fallen_at,
    e.p.w AS winner, e.p.d::BIGINT AS duration_s, e.p.v AS map_version,
    e.elo, e.has_abandon,
    arg_max(struct_pack(t := c.sample_at, s0 := c.souls0, s1 := c.souls1),
      c.sample_at) FILTER (c.sample_at IS NOT NULL) AS pre
  FROM observation_events o JOIN eligible e USING (match_id)
  LEFT JOIN checkpoints c ON c.match_id = o.match_id
    AND c.sample_at < o.fallen_at AND c.sample_at >= o.fallen_at - 300
  GROUP BY ALL
), event_values AS (
  SELECT *, CASE WHEN defender = 'Team1' THEN pre.s0 ELSE pre.s1 END AS attacker_souls,
    CASE WHEN defender = 'Team1' THEN pre.s1 ELSE pre.s0 END AS defender_souls
  FROM event_pre
), event_states AS MATERIALIZED (
  SELECT *, CASE WHEN attacker_souls IS NULL OR defender_souls IS NULL
      OR attacker_souls <= 0 OR defender_souls <= 0 THEN 'unknown'
    WHEN attacker_souls > 1.05 * defender_souls THEN 'ahead'
    WHEN defender_souls > 1.05 * attacker_souls THEN 'behind'
    ELSE 'even' END AS soul_state,
    CASE WHEN fallen_at < 900 THEN '00-15'
      WHEN fallen_at < 1200 THEN '15-20'
      WHEN fallen_at < 1500 THEN '20-25'
      WHEN fallen_at < 1800 THEN '25-30'
      WHEN fallen_at < 2400 THEN '30-40' ELSE '40+' END AS timing,
    winner <> defender AS attacker_won
  FROM event_values
), first_followup AS (
  SELECT s.match_id,
    count(b.objective) FILTER (b.defender = s.defender) AS additional_enemy_records,
    count(b.objective) FILTER (b.defender <> s.defender) AS own_records_lost
  FROM event_states s LEFT JOIN base_events b
    ON b.match_id = s.match_id AND b.fallen_at > s.fallen_at
      AND b.fallen_at <= s.fallen_at + 300
  WHERE s.event_type = 'first'
  GROUP BY s.match_id
), landmarks AS MATERIALIZED (
  SELECT e.match_id, e.p.w AS winner, e.p.d::BIGINT AS duration_s,
    e.p.v AS map_version, e.elo, e.has_abandon, l.minute, side.team,
    count(DISTINCT b.objective) FILTER (b.defender = side.team) AS lost,
    count(DISTINCT b.objective) FILTER (b.defender <> side.team) AS taken
  FROM eligible e
  CROSS JOIN (VALUES (15), (20), (25), (30), (35), (40)) AS l(minute)
  CROSS JOIN (VALUES ('Team0'), ('Team1')) AS side(team)
  LEFT JOIN base_events b ON b.match_id = e.match_id AND b.fallen_at <= l.minute * 60
  WHERE e.p.d > l.minute * 60
  GROUP BY ALL
)
, assertions AS (
SELECT 'candidate_matches' AS test_name, coalesce(((SELECT count(*) FROM matches) = 21), false) AS passed
UNION ALL
SELECT 'metadata_rejections' AS test_name, coalesce(((SELECT count(*) FROM complete) = 16), false) AS passed
UNION ALL
SELECT 'base_rejections' AS test_name, coalesce(((SELECT count(*) FROM invalid_base) = 5), false) AS passed
UNION ALL
SELECT 'eligible_matches' AS test_name, coalesce(((SELECT count(*) FROM eligible) = 11), false) AS passed
UNION ALL
SELECT 'latest_row_is_coherent' AS test_name, coalesce(((SELECT p.w FROM eligible WHERE match_id = 106000001) = 'Team0'), false) AS passed
UNION ALL
SELECT 'latest_conflict_rejected' AS test_name, coalesce((NOT EXISTS (SELECT 1 FROM eligible WHERE match_id = 106000013)), false) AS passed
UNION ALL
SELECT 'zero_is_not_destroyed' AS test_name, coalesce((NOT EXISTS (SELECT 1 FROM base_events WHERE match_id = 106000005)), false) AS passed
UNION ALL
SELECT 'exact_duplicate_collapsed' AS test_name, coalesce(((SELECT count(*) FROM base_events WHERE match_id = 106000006) = 1), false) AS passed
UNION ALL
SELECT 'contradictory_times_rejected' AS test_name, coalesce((NOT EXISTS (SELECT 1 FROM eligible WHERE match_id = 106000014)), false) AS passed
UNION ALL
SELECT 'opposing_tie_not_first' AS test_name, coalesce((NOT EXISTS (SELECT 1 FROM event_states WHERE match_id = 106000003 AND event_type = 'first')), false) AS passed
UNION ALL
SELECT 'same_team_tie_one_first' AS test_name, coalesce(((SELECT count(*) FROM event_states WHERE match_id = 106000016 AND event_type = 'first') = 1), false) AS passed
UNION ALL
SELECT 'same_team_tie_two_records' AS test_name, coalesce(((SELECT count(*) FROM event_states WHERE match_id = 106000016 AND event_type = 'milestone') = 2), false) AS passed
UNION ALL
SELECT 'owner_inversion' AS test_name, coalesce(((SELECT attacker_won FROM event_states WHERE match_id = 106000001 AND event_type = 'first')), false) AS passed
UNION ALL
SELECT 'pre_sample_strictly_before' AS test_name, coalesce(((SELECT soul_state = 'even' AND pre.t = 600 FROM event_states WHERE match_id = 106000001 AND event_type = 'first')), false) AS passed
UNION ALL
SELECT 'attacker_behind' AS test_name, coalesce(((SELECT soul_state = 'behind' AND NOT attacker_won FROM event_states WHERE match_id = 106000002 AND event_type = 'first')), false) AS passed
UNION ALL
SELECT 'early_event_no_unsigned_underflow' AS test_name, coalesce(((SELECT soul_state = 'unknown' FROM event_states WHERE match_id = 106000010 AND event_type = 'first')), false) AS passed
UNION ALL
SELECT 'missing_player_souls_unknown' AS test_name, coalesce(((SELECT soul_state = 'unknown' FROM event_states WHERE match_id = 106000017 AND event_type = 'first')), false) AS passed
UNION ALL
SELECT 'stale_souls_unknown' AS test_name, coalesce(((SELECT soul_state = 'unknown' FROM event_states WHERE match_id = 106000018 AND event_type = 'first')), false) AS passed
UNION ALL
SELECT 'landmark_includes_event_at_boundary' AS test_name, coalesce(((SELECT lost = 0 AND taken = 1 FROM landmarks WHERE match_id = 106000001 AND team = 'Team0' AND minute = 15)), false) AS passed
UNION ALL
SELECT 'landmark_no_future_leak' AS test_name, coalesce(((SELECT lost = 0 AND taken = 2 FROM landmarks WHERE match_id = 106000001 AND team = 'Team0' AND minute = 20)), false) AS passed
UNION ALL
SELECT 'landmark_both_sides' AS test_name, coalesce(((SELECT lost = 1 AND taken = 2 FROM landmarks WHERE match_id = 106000001 AND team = 'Team0' AND minute = 25)), false) AS passed
UNION ALL
SELECT 'ended_at_landmark_excluded' AS test_name, coalesce((NOT EXISTS (SELECT 1 FROM landmarks WHERE match_id = 106000011 AND minute = 15)), false) AS passed
UNION ALL
SELECT 'no_past_end_landmarks' AS test_name, coalesce((NOT EXISTS (SELECT 1 FROM landmarks WHERE match_id = 106000001 AND minute = 40)), false) AS passed
UNION ALL
SELECT 'followup_boundary' AS test_name, coalesce(((SELECT additional_enemy_records = 1 AND own_records_lost = 0 FROM first_followup WHERE match_id = 106000001)), false) AS passed
UNION ALL
SELECT 'followup_counterattack' AS test_name, coalesce(((SELECT additional_enemy_records = 0 AND own_records_lost = 1 FROM first_followup WHERE match_id = 106000002)), false) AS passed
UNION ALL
SELECT 'simultaneous_is_not_later' AS test_name, coalesce(((SELECT additional_enemy_records = 0 FROM first_followup WHERE match_id = 106000016)), false) AS passed
UNION ALL
SELECT 'first_match_count' AS test_name, coalesce(((SELECT count(*) FROM event_states WHERE event_type = 'first' AND elo <> 'unknown') = 8), false) AS passed
UNION ALL
SELECT 'first_horizon_partition' AS test_name, coalesce(((SELECT count(*) FROM event_states WHERE event_type = 'first' AND duration_s <= fallen_at + 300) = 1 AND (SELECT count(*) FROM event_states WHERE event_type = 'first' AND duration_s > fallen_at + 300) = 7), false) AS passed
UNION ALL
SELECT 'all_record_counts_valid' AS test_name, coalesce((NOT EXISTS (SELECT 1 FROM landmarks WHERE lost > 3 OR taken > 3 OR lost < 0 OR taken < 0)), false) AS passed
UNION ALL
SELECT 'new_map_labels_not_silently_mapped' AS test_name, coalesce((NOT EXISTS (SELECT 1 FROM eligible WHERE match_id = 106000009)), false) AS passed
UNION ALL
SELECT 'absent_objective_telemetry_not_zero_losses' AS test_name, coalesce((NOT EXISTS (SELECT 1 FROM eligible WHERE match_id = 106000021)), false) AS passed
)
SELECT count(*) AS tests, sum(CASE WHEN passed THEN 1 ELSE error(test_name) END) AS passed FROM assertions;
