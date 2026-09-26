WITH pd AS MATERIALIZED (
 SELECT match_id, player_slot,
   arg_max(struct_pack(team:=team, w:=winning_team, d:=duration_s,
     ts:="stats.time_stamp_s", nw:="stats.net_worth",
     names:="objectives.team_objective", owners:="objectives.team",
     times:="objectives.destroyed_time_s"), created_at) AS v
 FROM match_player
 WHERE match_id>=106000000 AND match_id<107000000
   AND game_mode='Normal' AND match_mode='Ranked' AND match_outcome='TeamWin'
   AND average_badge BETWEEN 10 AND 119
 GROUP BY match_id,player_slot
), e AS (
 SELECT *, list_filter(list_zip(v.names,v.owners,v.times), x ->
   starts_with(x[1],'Tier1Lane') AND x[3]>0 AND x[3]<=v.d
   AND x[2] IN ('Team0','Team1')) AS ev
 FROM pd
 WHERE len(v.names)=len(v.owners) AND len(v.names)=len(v.times)
   AND len(v.ts)=len(v.nw) AND v.ts=list_sort(v.ts)
), f AS (
 SELECT *,list_min(list_transform(ev,x->x[3])) AS t FROM e
), s AS (
 SELECT *,list_distinct(list_transform(list_filter(ev,x->x[3]=t),x->x[2])) AS os,
   list_max(list_filter(v.ts,x->x<t)) AS pt FROM f
), a AS (
 SELECT match_id,any_value(v.w<>os[1]) AS win,
   count(*) AS n,count(DISTINCT t) AS nt,count(DISTINCT os[1]) AS nowners,
   count(DISTINCT v.w) AS nwinners,
   count(v.nw[list_position(v.ts,pt)]) AS valid,
   sum(v.nw[list_position(v.ts,pt)]) FILTER(v.team<>os[1]) AS sa,
   sum(v.nw[list_position(v.ts,pt)]) FILTER(v.team=os[1]) AS sb,
   count(*) FILTER(v.team<>os[1]) AS na,count(*) FILTER(v.team=os[1]) AS nb,
   max(t-pt) AS age,min(pt) AS first_pt,max(pt) AS last_pt
 FROM s WHERE len(os)=1 GROUP BY match_id
), c AS (
 SELECT *,CASE WHEN valid<>12 OR first_pt<>last_pt OR age>300 THEN 'unknown'
   WHEN sa>1.05*sb THEN 'ahead' WHEN sa<0.95*sb THEN 'behind' ELSE 'even' END AS state
 FROM a WHERE n=12 AND na=6 AND nb=6 AND nt=1 AND nowners=1 AND nwinners=1
)
SELECT state,count(*) AS n,count(*) FILTER(win) AS wins,
 median(age) AS median_sample_age_s,max(age) AS max_sample_age_s
FROM c GROUP BY state ORDER BY state;
