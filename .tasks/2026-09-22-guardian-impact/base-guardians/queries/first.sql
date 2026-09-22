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

SELECT map_version,
  CASE WHEN grouping(elo) = 1 THEN 'all' ELSE elo END AS elo,
  CASE WHEN grouping(timing) = 1 THEN 'all' ELSE timing END AS timing,
  CASE WHEN grouping(soul_state) = 1 THEN 'all' ELSE soul_state END AS soul_state,
  count(*) AS matches,
  count(*) FILTER (attacker_won) AS attacker_wins,
  count(*) FILTER (NOT attacker_won) AS defender_wins,
  median(fallen_at) AS median_fallen_s,
  median(duration_s - fallen_at) AS median_remaining_s,
  median(fallen_at - pre.t) AS median_pre_sample_age_s,
  count(*) FILTER (has_abandon) AS matches_with_abandon,
  count(*) FILTER (attacker_won AND NOT has_abandon) AS wins_without_abandon,
  count(*) FILTER (duration_s <= fallen_at + 300 AND attacker_won) AS ended_with_attacker_win_by_5m,
  count(*) FILTER (duration_s <= fallen_at + 300 AND NOT attacker_won) AS ended_with_defender_win_by_5m,
  count(*) FILTER (duration_s > fallen_at + 300) AS still_playing_after_5m,
  count(*) FILTER (duration_s > fallen_at + 300 AND f.additional_enemy_records > 0) AS survivors_with_more_enemy_records_by_5m,
  count(*) FILTER (duration_s > fallen_at + 300 AND f.own_records_lost > 0) AS survivors_with_own_loss_by_5m
FROM event_states s JOIN first_followup f USING (match_id)
WHERE event_type = 'first' AND elo <> 'unknown'
GROUP BY GROUPING SETS (
  (map_version), (map_version, elo), (map_version, timing),
  (map_version, elo, timing), (map_version, soul_state), (map_version, elo, soul_state)
)
ORDER BY map_version, elo, timing, soul_state;
