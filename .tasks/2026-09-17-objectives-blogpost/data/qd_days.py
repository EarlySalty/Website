import datetime
import json
import os
import sys
import time
from mcp_query import run_query
from query_chunks import qd_sql

START = datetime.date(2026, 8, 13)
END = datetime.date(2026, 9, 16)
skip_existing = "--force" not in sys.argv

day = START
while day < END:
    nxt = day + datetime.timedelta(days=1)
    fname = f"qd_D_{day.strftime('%Y%m%d')}.json"
    if skip_existing and os.path.exists(fname):
        print(fname, "existiert, uebersprungen", flush=True)
        day = nxt
        continue
    sql = qd_sql(("D", f"{day.strftime('%Y-%m-%d')} 00:00:00+00", f"{nxt.strftime('%Y-%m-%d')} 00:00:00+00"))
    ok = False
    for attempt in range(2):
        t0 = time.time()
        try:
            res = run_query(sql)
        except RuntimeError as e:
            print(fname, f"VERSUCH {attempt+1} FEHLER:", str(e)[:160], flush=True)
            time.sleep(30)
            continue
        with open(fname, "w") as f:
            json.dump(res, f)
        print(fname, "rows:", res.get("rowCount"), f"({time.time()-t0:.0f}s)", flush=True)
        ok = True
        break
    if not ok:
        print(fname, "ENDGUELTIG FEHLGESCHLAGEN", flush=True)
    day = nxt
    time.sleep(4)
print("FERTIG", flush=True)
