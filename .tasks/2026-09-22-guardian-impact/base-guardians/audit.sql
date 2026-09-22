SELECT
  (SELECT count(*) FROM raw) AS raw_player_rows,
  (SELECT count(*) FROM pd) AS unique_match_player_rows,
  (SELECT count(*) FROM matches) AS candidate_matches,
  (SELECT count(*) FROM complete) AS metadata_complete_matches,
  (SELECT count(*) FROM matches) - (SELECT count(*) FROM complete) AS rejected_metadata_matches,
  (SELECT count(*) FROM invalid_base) AS rejected_base_matches,
  (SELECT count(*) FROM eligible) AS eligible_matches,
  (SELECT count(*) FROM eligible WHERE elo = 'unknown') AS unknown_rank_matches,
  (SELECT count(*) FROM eligible WHERE p.v IS NULL) AS unknown_map_version_matches,
  (SELECT count(*) FROM eligible WHERE has_abandon) AS matches_with_abandon,
  (SELECT count(*) FROM eligible e WHERE NOT EXISTS
    (SELECT 1 FROM base_events b WHERE b.match_id = e.match_id)) AS matches_without_recorded_base_loss,
  (SELECT count(*) FROM base_events) AS distinct_destroyed_base_records,
  (SELECT count(*) FROM first_candidates WHERE defenders > 1) AS opposing_simultaneous_first_matches,
  (SELECT count(*) FROM event_states WHERE event_type = 'first' AND elo <> 'unknown') AS first_ranked_matches,
  (SELECT count(*) FROM event_states WHERE event_type = 'first' AND elo <> 'unknown'
    AND soul_state = 'unknown') AS first_ranked_missing_pre_souls,
  (SELECT count(*) FROM event_states WHERE event_type = 'first' AND elo <> 'unknown'
    AND duration_s <= fallen_at + 300) AS first_ranked_ended_by_5m,
  (SELECT count(*) FROM event_states WHERE event_type = 'first' AND elo <> 'unknown'
    AND duration_s > fallen_at + 300) AS first_ranked_survived_5m,
  (SELECT count(*) FROM event_states WHERE milestone NOT BETWEEN 1 AND 3) AS invalid_milestones,
  (SELECT count(*) FROM landmarks WHERE lost NOT BETWEEN 0 AND 3 OR taken NOT BETWEEN 0 AND 3) AS invalid_counts;
