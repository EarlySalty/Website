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
