import json
import time
from mcp_query import run_query

W = ("start_time >= TIMESTAMPTZ '2026-09-14 00:00:00+00' AND start_time < TIMESTAMPTZ '2026-09-15 00:00:00+00' "
     "AND game_mode = 'Normal' AND match_mode = 'Ranked'")


def save(name, res, extra=""):
    with open(name, "w") as f:
        json.dump(res, f)
    print(name, "rows:", res.get("rowCount"), extra, flush=True)


t0 = time.time()
r1 = run_query(
    "SELECT match_id, winning_team, duration_s, "
    '"objectives.team_objective" AS ob_n, "objectives.team" AS ob_t, "objectives.destroyed_time_s" AS ob_d, '
    '"objectives.first_damage_time_s" AS ob_fd, '
    '"mid_boss.team_killed" AS mb_k, "mid_boss.team_claimed" AS mb_c, "mid_boss.destroyed_time_s" AS mb_t '
    "FROM match_player WHERE " + W + " AND match_outcome = 'TeamWin' LIMIT 1"
)
save("probe_objectives.json", r1, f"({time.time()-t0:.0f}s)")

t0 = time.time()
r2 = run_query(
    "SELECT match_id, team, player_slot, \"stats.time_stamp_s\" AS ts, \"stats.gold_treasure\" AS gt, "
    '"stats.gold_boss" AS gb, "stats.gold_boss_orb" AS gbo, "stats.net_worth" AS nw '
    "FROM match_player WHERE match_id = 104753027 ORDER BY player_slot"
)
save("probe_urn.json", r2, f"({time.time()-t0:.0f}s)")

t0 = time.time()
r3 = run_query(
    "SELECT u.type AS buff_type, count(*) AS n "
    "FROM match_player m, UNNEST(m.\"power_up_buffs.type\") AS u(type) "
    "WHERE " + W + " GROUP BY u.type ORDER BY n DESC LIMIT 60"
)
save("probe_buffs.json", r3, f"({time.time()-t0:.0f}s)")
