import json
import sys
import time
from mcp_query import run_query

WEEKS = [
    ("W1", "2026-08-13 00:00:00+00", "2026-08-20 00:00:00+00"),
    ("W2", "2026-08-20 00:00:00+00", "2026-08-27 00:00:00+00"),
    ("W3", "2026-08-27 00:00:00+00", "2026-09-03 00:00:00+00"),
    ("W4", "2026-09-03 00:00:00+00", "2026-09-10 00:00:00+00"),
    ("W5", "2026-09-10 00:00:00+00", "2026-09-16 00:00:00+00"),
]

ids = []
for name, start, end in WEEKS:
    sql = (
        "SELECT match_id FROM ("
        "  SELECT match_id, least(greatest(floor(min(average_badge)/10.0)::INT, 1), 11) AS tier "
        "  FROM match_player "
        f"  WHERE start_time >= TIMESTAMPTZ '{start}' AND start_time < TIMESTAMPTZ '{end}' "
        "    AND game_mode = 'Normal' AND match_mode = 'Ranked' AND match_outcome = 'TeamWin' "
        "  GROUP BY match_id"
        ") USING SAMPLE 4 ROWS"
    )
    res = run_query(sql)
    wids = [r[0] for r in res["rows"]]
    ids.extend(wids)
    print(name, wids, flush=True)
    time.sleep(3)

with open("urn_check_ids.json", "w") as f:
    json.dump(ids, f)

groups = [ids[i:i + 5] for i in range(0, len(ids), 5)]
for gi, grp in enumerate(groups):
    lst = ",".join(str(m) for m in grp)
    sql = (
        "SELECT match_id, team, player_slot, "
        "list_filter(list_transform(range(1, len(coalesce(\"stats.gold_treasure\", []))), "
        "  i -> {'t': coalesce(\"stats.time_stamp_s\", [])[i + 1], 'd': \"stats.gold_treasure\"[i + 1] - \"stats.gold_treasure\"[i]}), "
        "  x -> x.d > 0) AS spruenge "
        "FROM match_player WHERE match_id IN (" + lst + ") ORDER BY match_id, team, player_slot"
    )
    res = run_query(sql)
    with open(f"urn_check_{gi}.json", "w") as f:
        json.dump(res, f)
    print("gruppe", gi, "rows:", res.get("rowCount"), flush=True)
    time.sleep(3)
