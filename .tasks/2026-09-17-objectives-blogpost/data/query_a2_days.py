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
         "stats.time_stamp_s" AS ts, "stats.net_worth" AS nw, "stats.gold_treasure" AS gt,
         "mid_boss.destroyed_time_s" AS mb_t, "mid_boss.team_claimed" AS mb_c,
         "mid_boss.team_killed" AS mb_k,
         "objectives.team_objective" AS ob_n, "objectives.team" AS ob_t,
         "objectives.destroyed_time_s" AS ob_d
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
         arg_max(nw, created_at) AS nw,
         arg_max(gt, created_at) AS gt,
         arg_max(mb_t, created_at) AS mb_t,
         arg_max(mb_c, created_at) AS mb_c,
         arg_max(mb_k, created_at) AS mb_k,
         arg_max(ob_n, created_at) AS ob_n,
         arg_max(ob_t, created_at) AS ob_t,
         arg_max(ob_d, created_at) AS ob_d
  FROM raw GROUP BY match_id, account_id
),
m AS (
  SELECT match_id, min(winning_team) AS wt, min(ts) AS ts,
         least(greatest(floor(min(average_badge)/10.0)::INT, 1), 11) AS tier,
         min(mb_t) AS mb_t, min(mb_c) AS mb_c, min(mb_k) AS mb_k,
         min(ob_n) AS ob_n, min(ob_t) AS ob_t, min(ob_d) AS ob_d
  FROM pd GROUP BY match_id
),
mbm AS (
  SELECT match_id, min(t) AS mb_first_t, arg_min(c, t) AS mb_first_c, arg_min(k, t) AS mb_first_k
  FROM (SELECT m.match_id, m.mb_c[g.i] AS c, m.mb_k[g.i] AS k, m.mb_t[g.i] AS t
        FROM m, range(1, len(coalesce(m.mb_t, [])) + 1) AS g(i))
  GROUP BY match_id
),
shrm AS (
  SELECT match_id, min(d) FILTER (d > 0) AS shr_first_t,
         arg_min(t, d) FILTER (d > 0) AS shr_first_owner
  FROM (SELECT m.match_id, m.ob_n[g.i] AS n, m.ob_t[g.i] AS t, m.ob_d[g.i] AS d
        FROM m, range(1, len(coalesce(m.ob_n, [])) + 1) AS g(i))
  WHERE n LIKE 'TitanShieldGenerator%'
  GROUP BY match_id
),
ui AS (
  SELECT match_id, team, x.i AS i, x.d AS d
  FROM pd, UNNEST(list_filter(list_transform(range(1, len(coalesce(gt, []))),
       i -> {{'i': i, 'd': gt[i+1] - gt[i]}}), x -> x.d > 0)) AS u(x)
),
ug AS (
  SELECT match_id, team, i, count(*) AS npos, min(d) AS dmin
  FROM ui
  GROUP BY match_id, team, i
),
ud AS (
  SELECT ui.match_id AS match_id, ui.team AS team, ui.i AS i
  FROM ui JOIN ug ON ui.match_id = ug.match_id AND ui.team = ug.team AND ui.i = ug.i
  GROUP BY ui.match_id, ui.team, ui.i, ug.dmin
  HAVING ug.dmin > 0 AND count(*) FILTER (ui.d = ug.dmin) >= 5
),
uteam AS (
  SELECT match_id, team, count(*) AS dels, min(i) AS fi
  FROM ud
  GROUP BY match_id, team
),
ev AS (
  SELECT m.match_id, m.wt, m.tier, m.ts,
         mbm.mb_first_t, mbm.mb_first_c, mbm.mb_first_k, shrm.shr_first_t,
         CASE WHEN shrm.shr_first_owner = 'Team0' THEN 'Team1' ELSE 'Team0' END AS shr_first_team,
         u0.fi AS fi0, u1.fi AS fi1,
         CASE WHEN u1.fi IS NULL OR u0.fi < u1.fi THEN 'Team0'
              WHEN u0.fi IS NULL OR u1.fi < u0.fi THEN 'Team1' END AS urn_first_team,
         least(u0.fi, u1.fi) AS urn_fi
  FROM m
  LEFT JOIN mbm USING (match_id)
  LEFT JOIN shrm USING (match_id)
  LEFT JOIN uteam u0 ON m.match_id = u0.match_id AND u0.team = 'Team0'
  LEFT JOIN uteam u1 ON m.match_id = u1.match_id AND u1.team = 'Team1'
),
ev2 AS (
  SELECT *,
         len(list_filter(ts, x -> x < mb_first_t)) AS idx_mb,
         len(list_filter(ts, x -> x < shr_first_t)) AS idx_shr,
         coalesce(urn_fi, 0) AS idx_urn,
         CASE WHEN urn_fi IS NOT NULL THEN ts[urn_fi + 1] END AS urn_first_t
  FROM ev
),
p2 AS (
  SELECT pd.match_id, pd.team, ev2.wt, ev2.tier, ev2.mb_first_t, ev2.mb_first_c, ev2.mb_first_k,
         ev2.shr_first_t, ev2.shr_first_team, ev2.urn_first_team, ev2.urn_first_t,
         ev2.idx_mb, ev2.idx_shr, ev2.idx_urn,
         CASE WHEN ev2.idx_mb > 0 THEN coalesce(pd.nw, [])[ev2.idx_mb] END AS nw_mb,
         CASE WHEN ev2.idx_shr > 0 THEN coalesce(pd.nw, [])[ev2.idx_shr] END AS nw_shr,
         CASE WHEN ev2.idx_urn > 0 THEN coalesce(pd.nw, [])[ev2.idx_urn] END AS nw_urn
  FROM pd JOIN ev2 USING (match_id)
),
agg AS (
  SELECT match_id, any_value(wt) AS wt, any_value(tier) AS tier,
         any_value(mb_first_t) AS mb_first_t, any_value(mb_first_c) AS mb_first_c,
         any_value(mb_first_k) AS mb_first_k,
         any_value(shr_first_t) AS shr_first_t, any_value(shr_first_team) AS shr_first_team,
         any_value(urn_first_team) AS urn_first_team, any_value(urn_first_t) AS urn_first_t,
         any_value(idx_mb) AS idx_mb, any_value(idx_shr) AS idx_shr, any_value(idx_urn) AS idx_urn,
         sum(CASE WHEN team = 'Team0' THEN nw_mb END) AS mb_s0,
         sum(CASE WHEN team = 'Team1' THEN nw_mb END) AS mb_s1,
         sum(CASE WHEN team = 'Team0' THEN nw_shr END) AS shr_s0,
         sum(CASE WHEN team = 'Team1' THEN nw_shr END) AS shr_s1,
         sum(CASE WHEN team = 'Team0' THEN nw_urn END) AS urn_s0,
         sum(CASE WHEN team = 'Team1' THEN nw_urn END) AS urn_s1,
         count(*) FILTER (team = 'Team0' AND nw_mb IS NULL)
           + count(*) FILTER (team = 'Team1' AND nw_mb IS NULL) AS mb_nulls,
         count(*) FILTER (team = 'Team0' AND nw_shr IS NULL)
           + count(*) FILTER (team = 'Team1' AND nw_shr IS NULL) AS shr_nulls,
         count(*) FILTER (team = 'Team0' AND nw_urn IS NULL)
           + count(*) FILTER (team = 'Team1' AND nw_urn IS NULL) AS urn_nulls
  FROM p2 GROUP BY match_id
),
cls AS (
  SELECT *,
         CASE WHEN mb_first_c IS NULL THEN NULL
              WHEN idx_mb = 0 OR mb_nulls > 0 OR mb_s0 IS NULL OR mb_s1 IS NULL THEN 'unbekannt'
              WHEN (CASE WHEN mb_first_c = 'Team0' THEN mb_s0 ELSE mb_s1 END)
                   > 1.05 * (CASE WHEN mb_first_c = 'Team0' THEN mb_s1 ELSE mb_s0 END) THEN 'vorn'
              WHEN (CASE WHEN mb_first_c = 'Team0' THEN mb_s0 ELSE mb_s1 END)
                   >= 0.95 * (CASE WHEN mb_first_c = 'Team0' THEN mb_s1 ELSE mb_s0 END) THEN 'gleich'
              ELSE 'hinten' END AS mb_class,
         CASE WHEN shr_first_team IS NULL THEN NULL
              WHEN idx_shr = 0 OR shr_nulls > 0 OR shr_s0 IS NULL OR shr_s1 IS NULL THEN 'unbekannt'
              WHEN (CASE WHEN shr_first_team = 'Team0' THEN shr_s0 ELSE shr_s1 END)
                   > 1.05 * (CASE WHEN shr_first_team = 'Team0' THEN shr_s1 ELSE shr_s0 END) THEN 'vorn'
              WHEN (CASE WHEN shr_first_team = 'Team0' THEN shr_s0 ELSE shr_s1 END)
                   >= 0.95 * (CASE WHEN shr_first_team = 'Team0' THEN shr_s1 ELSE shr_s0 END) THEN 'gleich'
              ELSE 'hinten' END AS shr_class,
         CASE WHEN urn_first_team IS NULL THEN NULL
              WHEN idx_urn = 0 OR urn_nulls > 0 OR urn_s0 IS NULL OR urn_s1 IS NULL THEN 'unbekannt'
              WHEN (CASE WHEN urn_first_team = 'Team0' THEN urn_s0 ELSE urn_s1 END)
                   > 1.05 * (CASE WHEN urn_first_team = 'Team0' THEN urn_s1 ELSE urn_s0 END) THEN 'vorn'
              WHEN (CASE WHEN urn_first_team = 'Team0' THEN urn_s0 ELSE urn_s1 END)
                   >= 0.95 * (CASE WHEN urn_first_team = 'Team0' THEN urn_s1 ELSE urn_s0 END) THEN 'gleich'
              ELSE 'hinten' END AS urn_class
  FROM agg
),
gr AS (
  SELECT tier, wt, mb_first_t, mb_first_c, mb_first_k, shr_first_t, shr_first_team,
         urn_first_t, urn_first_team, mb_class, shr_class, urn_class,
         CASE WHEN tier <= 4 THEN 'niedrig' WHEN tier <= 7 THEN 'mittel' ELSE 'hoch' END AS tg
  FROM cls
),
zeilen AS (
  SELECT 'mb' AS event, (mb_first_t // 300) * 300 AS b0, tg AS grp,
         count(*) AS n, count(*) FILTER (mb_first_c = wt) AS wins,
         count(*) FILTER (mb_class = 'vorn') AS n_vorn,
         count(*) FILTER (mb_class = 'vorn' AND mb_first_c = wt) AS w_vorn,
         count(*) FILTER (mb_class = 'gleich') AS n_gleich,
         count(*) FILTER (mb_class = 'gleich' AND mb_first_c = wt) AS w_gleich,
         count(*) FILTER (mb_class = 'hinten') AS n_hinten,
         count(*) FILTER (mb_class = 'hinten' AND mb_first_c = wt) AS w_hinten,
         count(*) FILTER (mb_class = 'unbekannt') AS n_unb,
         count(*) FILTER (mb_class = 'unbekannt' AND mb_first_c = wt) AS w_unb,
         count(*) FILTER (mb_first_k != mb_first_c) AS steals,
         NULL::VARCHAR AS hist
  FROM gr WHERE mb_first_c IS NOT NULL GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'shr' AS event, (shr_first_t // 300) * 300 AS b0, tg AS grp,
         count(*) AS n, count(*) FILTER (shr_first_team = wt) AS wins,
         count(*) FILTER (shr_class = 'vorn') AS n_vorn,
         count(*) FILTER (shr_class = 'vorn' AND shr_first_team = wt) AS w_vorn,
         count(*) FILTER (shr_class = 'gleich') AS n_gleich,
         count(*) FILTER (shr_class = 'gleich' AND shr_first_team = wt) AS w_gleich,
         count(*) FILTER (shr_class = 'hinten') AS n_hinten,
         count(*) FILTER (shr_class = 'hinten' AND shr_first_team = wt) AS w_hinten,
         count(*) FILTER (shr_class = 'unbekannt') AS n_unb,
         count(*) FILTER (shr_class = 'unbekannt' AND shr_first_team = wt) AS w_unb,
         0 AS steals,
         NULL::VARCHAR AS hist
  FROM gr WHERE shr_first_team IS NOT NULL GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'urn' AS event, urn_first_t AS b0, tg AS grp,
         count(*) AS n, count(*) FILTER (urn_first_team = wt) AS wins,
         count(*) FILTER (urn_class = 'vorn') AS n_vorn,
         count(*) FILTER (urn_class = 'vorn' AND urn_first_team = wt) AS w_vorn,
         count(*) FILTER (urn_class = 'gleich') AS n_gleich,
         count(*) FILTER (urn_class = 'gleich' AND urn_first_team = wt) AS w_gleich,
         count(*) FILTER (urn_class = 'hinten') AS n_hinten,
         count(*) FILTER (urn_class = 'hinten' AND urn_first_team = wt) AS w_hinten,
         count(*) FILTER (urn_class = 'unbekannt') AS n_unb,
         count(*) FILTER (urn_class = 'unbekannt' AND urn_first_team = wt) AS w_unb,
         0 AS steals,
         NULL::VARCHAR AS hist
  FROM gr WHERE urn_first_team IS NOT NULL GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'hist_mb' AS event, 0 AS b0, tier::VARCHAR AS grp, count(*) AS n,
         0 AS wins, 0 AS n_vorn, 0 AS w_vorn, 0 AS n_gleich, 0 AS w_gleich,
         0 AS n_hinten, 0 AS w_hinten, 0 AS n_unb, 0 AS w_unb, 0 AS steals,
         to_json(histogram(mb_first_t // 60))::VARCHAR AS hist
  FROM gr WHERE mb_first_c IS NOT NULL GROUP BY tier
  UNION ALL
  SELECT 'hist_shr' AS event, 0 AS b0, tier::VARCHAR AS grp, count(*) AS n,
         0 AS wins, 0 AS n_vorn, 0 AS w_vorn, 0 AS n_gleich, 0 AS w_gleich,
         0 AS n_hinten, 0 AS w_hinten, 0 AS n_unb, 0 AS w_unb, 0 AS steals,
         to_json(histogram(shr_first_t // 60))::VARCHAR AS hist
  FROM gr WHERE shr_first_team IS NOT NULL GROUP BY tier
  UNION ALL
  SELECT 'hist_urn' AS event, 0 AS b0, tier::VARCHAR AS grp, count(*) AS n,
         0 AS wins, 0 AS n_vorn, 0 AS w_vorn, 0 AS n_gleich, 0 AS w_gleich,
         0 AS n_hinten, 0 AS w_hinten, 0 AS n_unb, 0 AS w_unb, 0 AS steals,
         to_json(histogram(urn_first_t))::VARCHAR AS hist
  FROM gr WHERE urn_first_team IS NOT NULL GROUP BY tier
)
SELECT * FROM zeilen ORDER BY event, b0, grp"""


def a2_sql(day):
    start = day.strftime("%Y-%m-%d 00:00:00+00")
    end = (day + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00+00")
    return SQL_TEMPLATE.format(start=start, end=end)


def fname_for(day):
    return f"a2_D_{day.strftime('%Y%m%d')}.json"


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
                res = run_query(a2_sql(day))
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
