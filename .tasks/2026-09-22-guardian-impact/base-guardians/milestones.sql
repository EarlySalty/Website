SELECT map_version, milestone,
  CASE WHEN grouping(elo) = 1 THEN 'all' ELSE elo END AS elo,
  CASE WHEN grouping(timing) = 1 THEN 'all' ELSE timing END AS timing,
  CASE WHEN grouping(soul_state) = 1 THEN 'all' ELSE soul_state END AS soul_state,
  count(*) AS team_observations,
  count(DISTINCT match_id) AS distinct_matches,
  count(*) FILTER (attacker_won) AS attacker_wins,
  count(*) FILTER (NOT attacker_won) AS defender_wins,
  median(fallen_at) AS median_fallen_s,
  median(duration_s - fallen_at) AS median_remaining_s,
  count(*) FILTER (has_abandon) AS observations_with_abandon,
  count(*) FILTER (attacker_won AND NOT has_abandon) AS wins_without_abandon
FROM event_states
WHERE event_type = 'milestone' AND elo <> 'unknown'
GROUP BY GROUPING SETS (
  (map_version, milestone), (map_version, milestone, elo),
  (map_version, milestone, timing), (map_version, milestone, soul_state)
)
ORDER BY map_version, milestone, elo, timing, soul_state;
