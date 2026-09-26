import json
import sys
import time

from mcp_query import run_query
from query_chunks import WEEKS, window

if __name__ == "__main__":
    teile = {}
    for name, start, end in WEEKS:
        sql = ("SELECT hero_id, count(*) AS n FROM match_player WHERE " + window((name, start, end)) +
               " AND match_outcome = 'TeamWin' GROUP BY hero_id ORDER BY hero_id")
        res = run_query(sql)
        for hid, n in res["rows"]:
            teile[hid] = teile.get(hid, 0) + n
        print(name, "rows:", res.get("rowCount"), flush=True)
        time.sleep(5)
    with open("hero_basis.json", "w") as f:
        json.dump(teile, f)
    print("hero_basis.json geschrieben,", sum(teile.values()), "Spielerzeilen")
