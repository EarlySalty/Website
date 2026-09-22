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
