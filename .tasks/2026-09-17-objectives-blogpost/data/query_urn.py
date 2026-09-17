import json
import time
from mcp_query import run_query

W = ("start_time >= TIMESTAMPTZ '2026-08-13 00:00:00+00' AND start_time < TIMESTAMPTZ '2026-09-16 00:00:00+00' "
     "AND game_mode = 'Normal' AND match_mode = 'Ranked' AND match_outcome = 'TeamWin'")

QC = (
    "WITH raw AS ("
    "  SELECT match_id, account_id, team, created_at, average_badge, winning_team, "
    "    \"stats.time_stamp_s\" AS ts, \"stats.gold_treasure\" AS gt "
    "  FROM match_player WHERE " + W +
    "),"
    "pd AS ("
    "  SELECT match_id, account_id, team, average_badge, winning_team, ts, gt "
    "  FROM (SELECT *, row_number() OVER (PARTITION BY match_id, account_id ORDER BY created_at DESC) AS rn FROM raw) "
    "  WHERE rn = 1"
    "),"
    "m2 AS ("
    "  SELECT match_id, min(winning_team) AS wt, "
    "    least(greatest(floor(min(average_badge)/10.0)::INT, 1), 11) AS tier, min(ts) AS ts "
    "  FROM pd GROUP BY match_id"
    "),"
    "ui AS ("
    "  SELECT match_id, team, x.i AS i, x.d AS d "
    "  FROM pd, UNNEST(list_filter(list_transform(range(1, len(coalesce(gt, []))), "
    "    i -> {'i': i, 'd': gt[i+1] - gt[i]}), x -> x.d > 0)) AS u(x)"
    "),"
    "ug AS ("
    "  SELECT match_id, team, i, count(*) AS npos, min(d) AS dmin "
    "  FROM ui GROUP BY match_id, team, i"
    "),"
    "ud AS ("
    "  SELECT ui.match_id AS match_id, ui.team AS team, ui.i AS i "
    "  FROM ui JOIN ug ON ui.match_id = ug.match_id AND ui.team = ug.team AND ui.i = ug.i "
    "  GROUP BY ui.match_id, ui.team, ui.i, ug.dmin "
    "  HAVING ug.dmin > 0 AND count(*) FILTER (ui.d = ug.dmin) >= 5"
    "),"
    "uteam AS ("
    "  SELECT match_id, team, count(*) AS dels, min(i) AS fi FROM ud GROUP BY match_id, team"
    "),"
    "um AS ("
    "  SELECT m2.match_id, m2.wt, m2.tier, m2.ts, "
    "    coalesce(sum(CASE WHEN u.team = 'Team0' THEN u.dels END), 0) AS dels0, "
    "    coalesce(sum(CASE WHEN u.team = 'Team1' THEN u.dels END), 0) AS dels1, "
    "    min(CASE WHEN u.team = 'Team0' THEN u.fi END) AS fi0, "
    "    min(CASE WHEN u.team = 'Team1' THEN u.fi END) AS fi1 "
    "  FROM m2 LEFT JOIN uteam u USING (match_id) GROUP BY m2.match_id, m2.wt, m2.tier, m2.ts"
    ")"
    "SELECT tier, count(*) AS n_matches, "
    "count(*) FILTER (dels0 + dels1 > 0) AS n_with_delivery, "
    "(sum(dels0) + sum(dels1))::DOUBLE / count(*) AS dels_per_match, "
    "sum(dels0) AS dels_team0, sum(dels1) AS dels_team1, "
    "quantile_cont(CASE WHEN fi0 IS NOT NULL OR fi1 IS NOT NULL THEN ts[least(fi0, fi1) + 1] END, 0.5) AS first_del_t_p50, "
    "avg(CASE WHEN fi0 IS NOT NULL OR fi1 IS NOT NULL THEN ts[least(fi0, fi1) + 1] END) AS first_del_t_mean, "
    "count(*) FILTER (fi0 IS NOT NULL OR fi1 IS NOT NULL) AS n_with_first, "
    "count(*) FILTER (CASE WHEN fi0 < fi1 THEN 'Team0' WHEN fi1 < fi0 THEN 'Team1' END = wt) AS first_team_wins, "
    "count(*) FILTER (dels0 != dels1) AS n_with_more, "
    "count(*) FILTER (CASE WHEN dels0 > dels1 THEN 'Team0' WHEN dels1 > dels0 THEN 'Team1' END = wt) AS more_wins "
    "FROM um GROUP BY tier ORDER BY tier"
)

if __name__ == "__main__":
    t0 = time.time()
    res = run_query(QC)
    with open("qc_urn.json", "w") as f:
        json.dump(res, f)
    print("qc_urn.json rows:", res.get("rowCount"), f"({time.time()-t0:.0f}s)", flush=True)
