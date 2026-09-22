WITH raw AS (
 SELECT match_id, created_at,
        struct_pack(wt := winning_team, badge := average_badge,
          duration := duration_s, version := game_mode_version,
          names := "objectives.team_objective", owners := "objectives.team",
          times := "objectives.destroyed_time_s") AS payload
 FROM match_player
 WHERE start_time >= TIMESTAMPTZ '2026-09-20 00:00:00+00'
   AND start_time < TIMESTAMPTZ '2026-09-21 00:00:00+00'
   AND game_mode = 'Normal' AND match_mode = 'Ranked'
   AND match_outcome = 'TeamWin' AND player_slot = 1
), latest AS (
 SELECT match_id, arg_max(payload, created_at) AS p FROM raw GROUP BY match_id
), matches AS (
 SELECT match_id, p.wt AS wt, p.duration AS duration, p.version AS version,
        floor(p.badge / 10.0)::INTEGER AS tier,
        p.names AS names, p.owners AS owners, p.times AS times
 FROM latest
 WHERE p.wt IN ('Team0','Team1') AND p.duration > 0
   AND len(p.names) = len(p.owners) AND len(p.names) = len(p.times)
), events AS (
 SELECT DISTINCT m.match_id, m.wt, m.duration, m.version, m.tier,
        CASE WHEN m.names[g.i] LIKE 'Tier1Lane%' THEN 'guardian' ELSE 'walker' END AS kind,
        regexp_extract(m.names[g.i], 'Lane([0-9]+)$', 1) AS lane,
        CASE WHEN m.owners[g.i] = 'Team0' THEN 'Team1' ELSE 'Team0' END AS attacker,
        m.times[g.i] AS t
 FROM matches m, range(1, len(m.names)+1) AS g(i)
 WHERE (m.names[g.i] LIKE 'Tier1Lane%' OR m.names[g.i] LIKE 'Tier2Lane%')
   AND m.owners[g.i] IN ('Team0','Team1')
   AND m.times[g.i] > 0 AND m.times[g.i] <= m.duration
), first_times AS (
 SELECT match_id, kind, 'match' AS scope, 'all' AS lane, min(t) AS t
 FROM events GROUP BY match_id, kind
 UNION ALL
 SELECT match_id, kind, 'lane' AS scope, lane, min(t) AS t
 FROM events GROUP BY match_id, kind, lane
), first_events AS (
 SELECT f.match_id, f.kind, f.scope, f.lane, f.t,
        min(e.wt) AS wt, min(e.duration) AS duration, min(e.version) AS version,
        min(e.tier) AS tier, count(DISTINCT e.attacker) AS teams_at_first_second,
        min(e.attacker) AS attacker, list(DISTINCT e.lane) AS first_lanes
 FROM first_times f JOIN events e
   ON e.match_id=f.match_id AND e.kind=f.kind AND e.t=f.t
   AND (f.scope='match' OR e.lane=f.lane)
 GROUP BY f.match_id,f.kind,f.scope,f.lane,f.t
), features AS (
 SELECT f.*,
        EXISTS(SELECT 1 FROM events e WHERE e.match_id=f.match_id AND e.kind='walker'
          AND e.attacker=f.attacker AND list_contains(f.first_lanes,e.lane)
          AND e.t>=f.t AND e.t<=f.t+300) AS walker_within_5m,
        EXISTS(SELECT 1 FROM events e WHERE e.match_id=f.match_id AND e.kind=f.kind
          AND e.attacker<>f.attacker AND list_contains(f.first_lanes,e.lane)
          AND e.t>f.t AND e.t<=f.t+180) AS counter_within_3m,
        CASE WHEN tier BETWEEN 1 AND 4 THEN 'low_1_4'
             WHEN tier BETWEEN 5 AND 7 THEN 'mid_5_7'
             WHEN tier BETWEEN 8 AND 11 THEN 'high_8_11' ELSE 'unknown' END AS elo,
        CASE WHEN t<300 THEN '00-05' WHEN t<480 THEN '05-08'
             WHEN t<660 THEN '08-11' WHEN t<900 THEN '11-15'
             WHEN t<1200 THEN '15-20' WHEN t<1500 THEN '20-25'
             ELSE '25+' END AS timing
 FROM first_events f
), output AS (
 SELECT 'summary' AS analysis, kind, scope, lane, 'all' AS elo, 'all' AS timing,
        count(*) AS n, count(*) FILTER(attacker=wt) AS wins,
        median(t)::DOUBLE AS median_s,
        count(*) FILTER(kind='guardian' AND walker_within_5m) AS follow_n,
        count(*) FILTER(kind='guardian' AND walker_within_5m AND attacker=wt) AS follow_wins,
        count(*) FILTER(counter_within_3m) AS counter_n,
        count(*) FILTER(counter_within_3m AND attacker=wt) AS counter_wins
 FROM features WHERE teams_at_first_second=1 AND elo<>'unknown'
 GROUP BY kind,scope,lane
 UNION ALL
 SELECT 'elo_timing',kind,scope,lane,elo,timing,count(*),count(*) FILTER(attacker=wt),
        median(t)::DOUBLE,
        count(*) FILTER(kind='guardian' AND walker_within_5m),
        count(*) FILTER(kind='guardian' AND walker_within_5m AND attacker=wt),
        count(*) FILTER(counter_within_3m),count(*) FILTER(counter_within_3m AND attacker=wt)
 FROM features WHERE teams_at_first_second=1 AND elo<>'unknown'
 GROUP BY kind,scope,lane,elo,timing
 UNION ALL
 SELECT 'elo',kind,scope,lane,elo,'all',count(*),count(*) FILTER(attacker=wt),
        median(t)::DOUBLE,
        count(*) FILTER(kind='guardian' AND walker_within_5m),
        count(*) FILTER(kind='guardian' AND walker_within_5m AND attacker=wt),
        count(*) FILTER(counter_within_3m),count(*) FILTER(counter_within_3m AND attacker=wt)
 FROM features WHERE teams_at_first_second=1 AND elo<>'unknown'
 GROUP BY kind,scope,lane,elo
 UNION ALL
 SELECT 'qa_ties',kind,scope,lane,'all','all',count(*),NULL,NULL,NULL,NULL,NULL,NULL
 FROM features WHERE teams_at_first_second<>1 GROUP BY kind,scope,lane
 UNION ALL
 SELECT 'qa_matches','all','match','all','all','all',count(*),NULL,NULL,NULL,NULL,NULL,NULL
 FROM matches
 UNION ALL
 SELECT 'qa_unknown_badge','all','match','all','unknown','all',count(*),NULL,NULL,NULL,NULL,NULL,NULL
 FROM matches WHERE tier IS NULL OR tier NOT BETWEEN 1 AND 11
)
SELECT * FROM output ORDER BY analysis,kind,scope,lane,elo,timing;
