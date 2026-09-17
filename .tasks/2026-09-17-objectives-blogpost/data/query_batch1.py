import json
import sys
import time
from mcp_query import run_query

W = ("start_time >= TIMESTAMPTZ '2026-08-13 00:00:00+00' AND start_time < TIMESTAMPTZ '2026-09-16 00:00:00+00' "
     "AND game_mode = 'Normal' AND match_mode = 'Ranked'")
TIERS = "least(greatest(floor(min(average_badge)/10.0)::INT, 1), 11)"
TIERS_ROW = "least(greatest(floor(average_badge/10.0)::INT, 1), 11)"

QA = (
    "SELECT date_trunc('day', start_time) AS day, " + TIERS_ROW + " AS tier, "
    "count(*) AS rows_raw, count(DISTINCT (match_id, account_id)) AS player_rows, "
    "count(DISTINCT match_id) AS matches_all, "
    "count(DISTINCT CASE WHEN match_outcome = 'TeamWin' THEN match_id END) AS matches_teamwin "
    "FROM match_player WHERE " + W + " GROUP BY day, tier ORDER BY day, tier"
)

QB = (
    "WITH m AS ("
    "  SELECT match_id, " + TIERS + " AS tier, "
    "    min(winning_team) AS wt, min(duration_s) AS dur, bool_or(abandon_match_time_s > 0) AS ab, "
    "    min(\"mid_boss.destroyed_time_s\") AS mb_t, min(\"mid_boss.team_killed\") AS mb_k, "
    "    min(\"mid_boss.team_claimed\") AS mb_c, min(\"objectives.team_objective\") AS ob_n, "
    "    min(\"objectives.team\") AS ob_t, min(\"objectives.destroyed_time_s\") AS ob_d "
    "  FROM match_player WHERE " + W + " AND match_outcome = 'TeamWin' GROUP BY match_id"
    "),"
    "mb AS ("
    "  SELECT m.match_id, m.wt, m.tier, m.mb_c[g.i] AS c, m.mb_k[g.i] AS k, m.mb_t[g.i] AS t "
    "  FROM m, range(1, len(coalesce(m.mb_t, [])) + 1) AS g(i)"
    "),"
    "mbm AS ("
    "  SELECT match_id, any_value(wt) AS wt, any_value(tier) AS tier, count(*) AS n_mb, "
    "    min(t) AS mb_first_t, arg_min(c, t) AS mb_first_c, "
    "    count(*) FILTER (k != c) AS steals, "
    "    count(*) FILTER (k != c AND c = wt) AS steal_wins "
    "  FROM mb GROUP BY match_id"
    "),"
    "ob AS ("
    "  SELECT m.match_id, m.wt, m.tier, m.ob_n[g.i] AS n, m.ob_t[g.i] AS t, m.ob_d[g.i] AS d "
    "  FROM m, range(1, len(coalesce(m.ob_n, [])) + 1) AS g(i)"
    "),"
    "shrm AS ("
    "  SELECT match_id, any_value(wt) AS wt, any_value(tier) AS tier, "
    "    count(*) FILTER (d > 0) AS shr_falls, "
    "    min(d) FILTER (d > 0) AS shr_first_t, "
    "    arg_min(t, d) FILTER (d > 0) AS shr_first_owner, "
    "    count(*) FILTER (d > 0 AND t = wt) AS falls_owner_win, "
    "    count(*) FILTER (d > 0 AND t != wt) AS falls_owner_lose "
    "  FROM ob WHERE n LIKE 'TitanShieldGenerator%' GROUP BY match_id"
    "),"
    "j AS ("
    "  SELECT m.match_id, m.tier, m.ab, m.dur, m.wt, mbm.n_mb, mbm.mb_first_t, mbm.mb_first_c, "
    "    mbm.steals, mbm.steal_wins, shrm.shr_falls, shrm.shr_first_t, shrm.shr_first_owner, "
    "    shrm.falls_owner_win, shrm.falls_owner_lose "
    "  FROM m LEFT JOIN mbm USING (match_id) LEFT JOIN shrm USING (match_id)"
    ")"
    "SELECT tier, count(*) AS n_matches, count(*) FILTER (ab) AS n_abandon, "
    "count(*) FILTER (n_mb > 0) AS n_with_mb, "
    "sum(mb_first_t) FILTER (n_mb > 0) AS mb_first_t_sum, "
    "count(*) FILTER (mb_first_c = wt) AS mb_first_wins, "
    "sum(steals) AS steals_total, count(*) FILTER (steals > 0) AS n_steal_matches, "
    "sum(steal_wins) AS steal_wins_total, "
    "count(*) FILTER (shr_falls > 0) AS n_with_shrfall, "
    "sum(shr_first_t) FILTER (shr_falls > 0) AS shr_first_t_sum, "
    "count(*) FILTER (CASE WHEN shr_first_owner = 'Team0' THEN 'Team1' ELSE 'Team0' END = wt) AS shr_first_wins, "
    "sum(dur - shr_first_t) FILTER (shr_falls > 0) AS shr_end_gap_sum, "
    "sum(falls_owner_win) AS shr_falls_owner_win, sum(falls_owner_lose) AS shr_falls_owner_lose "
    "FROM j GROUP BY tier ORDER BY tier"
)


def main():
    which = sys.argv[1]
    fname = f"{which.lower()}_full.json"
    sql = QA if which == "QA" else QB
    t0 = time.time()
    res = run_query(sql)
    with open(fname, "w") as f:
        json.dump(res, f)
    print(fname, "rows:", res.get("rowCount"), f"({time.time()-t0:.0f}s)", flush=True)


if __name__ == "__main__":
    main()
