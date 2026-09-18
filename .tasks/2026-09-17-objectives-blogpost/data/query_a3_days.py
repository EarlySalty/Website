import json
import os
import sys
import time
from datetime import date, timedelta

from mcp_query import run_query

START = date(2026, 8, 13)
END = date(2026, 9, 15)

PASSES = 3
SLEEP = 5

SQL_TEMPLATE = """WITH raw AS (
  SELECT match_id, account_id, team, created_at, average_badge, winning_team,
         "stats.time_stamp_s" AS ts, "stats.net_worth" AS nws, "stats.gold_treasure" AS gt,
         "death_details.game_time_s" AS dts,
         hero_id, assigned_lane, net_worth AS nwe, kills, deaths
  FROM match_player
  WHERE start_time >= TIMESTAMPTZ '{start}'
    AND start_time < TIMESTAMPTZ '{end}'
    AND game_mode = 'Normal' AND match_mode = 'Ranked' AND match_outcome = 'TeamWin'
),
pd AS (
  SELECT match_id, account_id,
         arg_max(team, created_at) AS team,
         arg_max(average_badge, created_at) AS average_badge,
         arg_max(winning_team, created_at) AS winning_team,
         arg_max(ts, created_at) AS ts,
         arg_max(nws, created_at) AS nws,
         arg_max(gt, created_at) AS gt,
         arg_max(dts, created_at) AS dts,
         arg_max(hero_id, created_at) AS hero_id,
         arg_max(assigned_lane, created_at) AS assigned_lane,
         arg_max(nwe, created_at) AS nwe,
         arg_max(kills, created_at) AS kills,
         arg_max(deaths, created_at) AS deaths
  FROM raw GROUP BY match_id, account_id
),
m AS (
  SELECT match_id, min(winning_team) AS wt, min(ts) AS ts,
         least(greatest(floor(min(average_badge)/10.0)::INT, 1), 11) AS tier
  FROM pd GROUP BY match_id
),
ui AS (
  SELECT match_id, team, account_id, x.i AS i, x.d AS d
  FROM pd, UNNEST(list_filter(list_transform(range(1, len(coalesce(gt, []))),
       i -> {'i': i, 'd': gt[i+1] - gt[i]}), x -> x.d > 0)) AS u(x)
),
ug AS (
  SELECT match_id, team, i, count(*) AS npos, min(d) AS dmin
  FROM ui GROUP BY match_id, team, i
),
umax AS (
  SELECT match_id, team, i, max(d) AS maxd
  FROM ui GROUP BY match_id, team, i
),
udel AS (
  SELECT ui.match_id AS match_id, ui.team AS team, ui.i AS i,
         ug.dmin AS dmin, um.maxd AS maxd,
         count(*) FILTER (ui.d = ug.dmin) AS an_min,
         count(*) FILTER (ui.d = um.maxd) AS an_max,
         min(CASE WHEN ui.d = um.maxd THEN ui.account_id END) AS l_acct
  FROM ui
  JOIN ug ON ui.match_id = ug.match_id AND ui.team = ug.team AND ui.i = ug.i
  JOIN umax um ON ui.match_id = um.match_id AND ui.team = um.team AND ui.i = um.i
  GROUP BY 1, 2, 3, 4, 5
  HAVING ug.dmin > 0 AND count(*) FILTER (ui.d = ug.dmin) >= 5
),
dlv AS (
  SELECT d.match_id AS match_id, d.team AS team, d.i AS i,
         (d.maxd > d.dmin AND d.an_max = 1) AS hat_laeufer,
         d.l_acct AS l_acct, m.tier AS tier, m.wt AS wt,
         m.ts[d.i] AS t0, m.ts[d.i + 1] AS t1
  FROM udel d JOIN m ON m.match_id = d.match_id
),
pidx AS (
  SELECT p.match_id AS match_id, p.account_id AS account_id, p.team AS team, g.k AS k,
         p.nws[g.k] AS nwk
  FROM pd p JOIN m ON m.match_id = p.match_id,
       range(1, len(m.ts) + 1) AS g(k)
),
lsum AS (
  SELECT match_id, k,
         sum(CASE WHEN team = 'Team0' THEN nwk END) AS s0,
         sum(CASE WHEN team = 'Team1' THEN nwk END) AS s1,
         count(*) FILTER (nwk IS NULL) AS nnull
  FROM pidx GROUP BY match_id, k
),
lead AS (
  SELECT match_id, k, CASE WHEN nnull = 0 THEN s0 - s1 END AS lead0
  FROM lsum
),
trank AS (
  SELECT p.match_id AS match_id, p.team AS team, p.k AS i, p.account_id AS acct,
         1 + count(*) FILTER (q.nwk > p.nwk) AS rk,
         count(*) FILTER (q.nwk IS NULL OR p.nwk IS NULL) AS nnull
  FROM pidx p
  JOIN (SELECT DISTINCT match_id, i FROM dlv) dd ON dd.match_id = p.match_id AND dd.i = p.k
  JOIN pidx q ON q.match_id = p.match_id AND q.team = p.team AND q.k = p.k
             AND q.account_id != p.account_id
  GROUP BY 1, 2, 3, 4
),
roster AS (
  SELECT match_id, team,
         list(struct_pack(a := account_id, n := nwe, k := kills, d := deaths)) AS ros
  FROM pd GROUP BY match_id, team
),
r AS (
  SELECT d.match_id AS match_id, d.team AS team, d.wt AS wt,
         CASE WHEN d.tier <= 4 THEN 'niedrig' WHEN d.tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg,
         p.hero_id AS hero_id, p.assigned_lane AS lane,
         p.nwe AS l_nwe, p.kills AS l_kills, p.deaths AS l_deaths,
         tr.rk AS rk, tr.nnull AS rk_null,
         list_sort(list_transform(list_filter(ro.ros, x -> x.a != d.l_acct), x -> x.n))[3] AS m_nw,
         list_sort(list_transform(list_filter(ro.ros, x -> x.a != d.l_acct), x -> x.k))[3] AS m_k,
         list_sort(list_transform(list_filter(ro.ros, x -> x.a != d.l_acct), x -> x.d))[3] AS m_d
  FROM dlv d
  JOIN pd p ON p.match_id = d.match_id AND p.account_id = d.l_acct
  JOIN roster ro ON ro.match_id = d.match_id AND ro.team = d.team
  LEFT JOIN trank tr ON tr.match_id = d.match_id AND tr.team = d.team AND tr.i = d.i
                    AND tr.acct = d.l_acct
  WHERE d.hat_laeufer
),
dsw AS (
  SELECT CASE WHEN d.tier <= 4 THEN 'niedrig' WHEN d.tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg,
         CASE WHEN d.t1 <= 900 THEN ((d.t1 + 179) // 180) * 180 ELSE 900 + ((d.t1 - 900 + 299) // 300) * 300 END AS grid,
         CASE WHEN la.lead0 IS NOT NULL AND lb.lead0 IS NOT NULL
              THEN (CASE WHEN d.team = 'Team0' THEN 1 ELSE -1 END) * (lb.lead0 - la.lead0) END AS delta,
         abs(CASE WHEN la.lead0 IS NOT NULL AND lb.lead0 IS NOT NULL
              THEN (CASE WHEN d.team = 'Team0' THEN 1 ELSE -1 END) * (lb.lead0 - la.lead0) END) AS adelta
  FROM dlv d
  JOIN lead la ON la.match_id = d.match_id AND la.k = d.i
  JOIN lead lb ON lb.match_id = d.match_id AND lb.k = d.i + 1
),
dlint AS (SELECT DISTINCT match_id, i FROM dlv),
nsw AS (
  SELECT CASE WHEN m.tier <= 4 THEN 'niedrig' WHEN m.tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg,
         CASE WHEN m.ts[la.k + 1] <= 900 THEN ((m.ts[la.k + 1] + 179) // 180) * 180 ELSE 900 + ((m.ts[la.k + 1] - 900 + 299) // 300) * 300 END AS grid,
         t.sgn * (lb.lead0 - la.lead0) AS delta,
         abs(t.sgn * (lb.lead0 - la.lead0)) AS adelta
  FROM lead la
  JOIN lead lb ON lb.match_id = la.match_id AND lb.k = la.k + 1
  JOIN m ON m.match_id = la.match_id
  CROSS JOIN (VALUES ('Team0', 1), ('Team1', -1)) AS t(tname, sgn)
  WHERE NOT EXISTS (SELECT 1 FROM dlint x WHERE x.match_id = la.match_id AND x.i = la.k)
),
runners AS (
  SELECT DISTINCT match_id, l_acct AS acct FROM dlv WHERE hat_laeufer
),
runs AS (
  SELECT x.match_id AS match_id, x.acct AS acct, p.team AS team, m.ts AS mts,
         coalesce(p.dts, []) AS dl, m.tier AS tier
  FROM runners x
  JOIN pd p ON p.match_id = x.match_id AND p.account_id = x.acct
  JOIN m ON m.match_id = x.match_id
),
rint AS (
  SELECT ru.match_id AS match_id, ru.acct AS acct, ru.team AS team,
         CASE WHEN ru.tier <= 4 THEN 'niedrig' WHEN ru.tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg,
         g.k AS k, ru.mts[g.k] AS t0, ru.mts[g.k + 1] AS t1,
         (ru.mts[g.k + 1]::BIGINT - ru.mts[g.k]::BIGINT) AS sec,
         len(list_filter(ru.dl, y -> y >= ru.mts[g.k] AND y < ru.mts[g.k + 1])) AS nd
  FROM runs ru, range(1, len(ru.mts)) AS g(k)
),
rint2 AS (
  SELECT x.*, CASE WHEN di.i IS NOT NULL THEN 1 ELSE 0 END AS is_del
  FROM rint x
  LEFT JOIN (SELECT match_id, l_acct, i FROM dlv WHERE hat_laeufer) di
    ON di.match_id = x.match_id AND di.l_acct = x.acct AND di.i = x.k
),
zeilen AS (
  SELECT 'swing_del' AS zeile, tg, grid, count(*) AS n,
         to_json(struct_pack(s := sum(delta), sa := sum(adelta),
                             nn := count(*) FILTER (delta IS NULL)))::VARCHAR AS payload
  FROM dsw GROUP BY tg, grid
  UNION ALL
  SELECT 'swing_ohne' AS zeile, tg, grid, count(*) AS n,
         to_json(struct_pack(sa := sum(adelta), nn := count(*) FILTER (adelta IS NULL)))::VARCHAR AS payload
  FROM nsw GROUP BY tg, grid
  UNION ALL
  SELECT 'swing_del_pool' AS zeile, tg, NULL AS grid, count(*) AS n,
         to_json(struct_pack(s := sum(delta), sa := sum(adelta), nn := count(*) FILTER (delta IS NULL),
                             h := to_json(histogram(greatest(-24, least(24, delta // 2500)))),
                             ha := to_json(histogram(greatest(24, least(48, adelta // 2500 + 24))))))::VARCHAR AS payload
  FROM dsw GROUP BY tg
  UNION ALL
  SELECT 'swing_ohne_pool' AS zeile, tg, NULL AS grid, count(*) AS n,
         to_json(struct_pack(sa := sum(adelta), nn := count(*) FILTER (adelta IS NULL),
                             ha := to_json(histogram(greatest(24, least(48, adelta // 2500 + 24))))))::VARCHAR AS payload
  FROM nsw GROUP BY tg
  UNION ALL
  SELECT 'laeufer' AS zeile, tg, NULL AS grid, count(*) AS n,
         to_json(struct_pack(
           wins := count(*) FILTER (wt = team),
           rk1 := count(*) FILTER (rk = 1), rk2 := count(*) FILTER (rk = 2),
           rk3 := count(*) FILTER (rk = 3), rk4 := count(*) FILTER (rk = 4),
           rk5 := count(*) FILTER (rk = 5), rk6 := count(*) FILTER (rk = 6),
           rk_unk := count(*) FILTER (rk IS NULL OR rk_null > 0),
           hh := to_json(histogram(hero_id)), hl := to_json(histogram(lane)),
           nw_ueber := count(*) FILTER (l_nwe > m_nw),
           nw_gleich := count(*) FILTER (l_nwe = m_nw),
           nw_unter := count(*) FILTER (l_nwe < m_nw),
           k_ueber := count(*) FILTER (l_kills > m_k),
           k_gleich := count(*) FILTER (l_kills = m_k),
           k_unter := count(*) FILTER (l_kills < m_k),
           d_ueber := count(*) FILTER (l_deaths > m_d),
           d_gleich := count(*) FILTER (l_deaths = m_d),
           d_unter := count(*) FILTER (l_deaths < m_d),
           s_nw := sum(l_nwe), s_mnw := sum(m_nw),
           s_k := sum(l_kills), s_mk := sum(m_k),
           s_d := sum(l_deaths), s_md := sum(m_d),
           hn := to_json(histogram(greatest(-20, least(20, (l_nwe::BIGINT - m_nw::BIGINT) // 5000)))),
           hk := to_json(histogram(greatest(-15, least(15, l_kills::BIGINT - m_k::BIGINT)))),
           hd := to_json(histogram(greatest(-15, least(15, l_deaths::BIGINT - m_d::BIGINT))))
         ))::VARCHAR AS payload
  FROM r GROUP BY tg
  UNION ALL
  SELECT 'laeufer_unk' AS zeile,
         CASE WHEN tier <= 4 THEN 'niedrig' WHEN tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg,
         NULL AS grid, count(*) AS n, '{}'::VARCHAR AS payload
  FROM dlv WHERE NOT hat_laeufer GROUP BY 2
  UNION ALL
  SELECT 'tod' AS zeile, tg, NULL AS grid,
         count(*) FILTER (is_del = 1) AS n,
         to_json(struct_pack(
           del_ints := count(*) FILTER (is_del = 1),
           del_tod_ints := count(*) FILTER (is_del = 1 AND nd > 0),
           del_tode := sum(nd) FILTER (is_del = 1),
           del_sek := sum(sec) FILTER (is_del = 1),
           oth_ints := count(*) FILTER (is_del = 0),
           oth_tod_ints := count(*) FILTER (is_del = 0 AND nd > 0),
           oth_tode := sum(nd) FILTER (is_del = 0),
           oth_sek := sum(sec) FILTER (is_del = 0)
         ))::VARCHAR AS payload
  FROM rint2 GROUP BY tg
)
SELECT zeile, tg, grid, n, payload FROM zeilen ORDER BY zeile, tg, grid NULLS LAST"""

HERO_NAMES = "/tmp/hero_names.json"


def a3_sql(day):
    start = day.strftime("%Y-%m-%d 00:00:00+00")
    end = (day + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00+00")
    return SQL_TEMPLATE.replace("{start}", start).replace("{end}", end)


def fname_for(day):
    return f"a3_D_{day.strftime('%Y%m%d')}.json"


if __name__ == "__main__":
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for pass_no in range(1, PASSES + 1):
        fehlt = []
        day = START
        while day <= END:
            fname = fname_for(day)
            if only and fname != only:
                day += timedelta(days=1)
                continue
            if os.path.exists(fname):
                day += timedelta(days=1)
                continue
            fehlt.append(fname)
            t0 = time.time()
            try:
                res = run_query(a3_sql(day))
            except RuntimeError as e:
                print(fname, "FEHLER:", str(e)[:300], flush=True)
                day += timedelta(days=1)
                time.sleep(10)
                continue
            with open(fname, "w") as f:
                json.dump(res, f)
            groesse = os.path.getsize(fname)
            print(fname, "rows:", res.get("rowCount"), f"({time.time()-t0:.0f}s, {groesse//1024} KB)", flush=True)
            time.sleep(SLEEP)
            day += timedelta(days=1)
        if not fehlt:
            break
        print(f" Durchlauf {pass_no}: {len(fehlt)} Tage offen", flush=True)
    tag_fehler = [fname_for(START + timedelta(days=i)) for i in range((END - START).days + 1)
                  if not os.path.exists(fname_for(START + timedelta(days=i)))]
    if tag_fehler:
        print("OFFEN OHNE DATEI:", ",".join(tag_fehler), flush=True)
        sys.exit(1)
    print("alle Tage geladen", flush=True)
