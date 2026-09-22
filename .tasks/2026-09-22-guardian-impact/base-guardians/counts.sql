SELECT map_version, minute, lost, taken,
  CASE WHEN grouping(elo) = 1 THEN 'all' ELSE elo END AS elo,
  count(*) AS team_observations,
  count(DISTINCT match_id) AS distinct_matches,
  count(*) FILTER (winner = team) AS wins,
  count(*) FILTER (winner <> team) AS losses,
  count(*) FILTER (has_abandon) AS observations_with_abandon,
  count(*) FILTER (winner = team AND NOT has_abandon) AS wins_without_abandon
FROM landmarks WHERE elo <> 'unknown'
GROUP BY GROUPING SETS (
  (map_version, minute, lost, taken), (map_version, minute, lost, taken, elo)
)
ORDER BY map_version, minute, lost, taken, elo;
