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
