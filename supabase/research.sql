-- LoadMind research: workload, focus and time in the app, compared between grades and social media habits.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run. The editor runs as the project owner, so it sees
-- every row (the app itself never can: row level security lets each user see only their own data).
-- Only totals per group come out, never one person. Groups with fewer than 3 people are left out, so nobody
-- can be recognised, and users with less than 3 days in the app are left out, so one-time visits don't skew it.
--
-- What each user's data holds (inside user_data.data):
--   profile.grade   "7".."12", "uni" or "other"      asked once on the dashboard, can be changed in Settings
--   profile.social  "0" under 1 h, "1" 1-2 h, "2" 2-4 h, "4" more than 4 h of social media a day
--   appTime         {"2026-11-08": 34, ...}           minutes in LoadMind per day (only while the page is used)
--   focus           {"2026-11-08": {"m": 50, "n": 2}} focus timer minutes and full sessions per day
--   load            {"2026-11-08": {"x": 80, "s": 1450, "n": 25}}
--                   overload index of the day: x = highest, s / n = average while the app was open
--
-- Columns: app_min_per_day = minutes in LoadMind a day, focus_min_per_day = focus timer minutes a day,
-- focus_share_pct = focus minutes out of minutes in the app, avg_overload / avg_peak_overload = 0-100 (higher is worse),
-- red_days_pct = days that reached 75+. The last row also has the correlation (-1 to 1) between hours on social
-- media (the middle of each answer: 0.5, 1.5, 3, 5) and focus / overload; it needs about 20+ people to mean anything.

with u as (
  select
    coalesce(nullif(d.data #>> '{profile,grade}', ''), 'not set') as grade,
    coalesce(nullif(d.data #>> '{profile,social}', ''), 'not set') as social,
    coalesce(d.data -> 'appTime', '{}') as app,
    coalesce(d.data -> 'focus', '{}') as focus,
    coalesce(d.data -> 'load', '{}') as load
  from public.user_data d
),
per_user as (
  select
    grade, social,
    case social when '0' then 0.5 when '1' then 1.5 when '2' then 3 when '4' then 5 end as social_h,
    (select count(*) from jsonb_each(app)) as days,
    (select coalesce(sum(v::text::numeric), 0) from jsonb_each(app) a(k, v)) as app_min,
    (select coalesce(sum((v ->> 'm')::numeric), 0) from jsonb_each(focus) f(k, v)) as focus_min,
    (select avg((v ->> 's')::numeric / nullif((v ->> 'n')::numeric, 0)) from jsonb_each(load) l(k, v)) as avg_load,
    (select avg((v ->> 'x')::numeric) from jsonb_each(load) l(k, v)) as avg_peak_load,
    (select count(*) from jsonb_each(load) l(k, v) where (v ->> 'x')::numeric >= 75) as red_days
  from u
),
active as (select * from per_user where days >= 3),
grouped as (
  select 1 as part, 'grade' as by_what, grade as grp, case when grade ~ '^\d+$' then grade::int else 99 end as sort, active.* from active
  union all
  select 2, 'social media', case social when '0' then 'under 1 h' when '1' then '1-2 h' when '2' then '2-4 h' when '4' then '4+ h' else 'not set' end, coalesce(social_h, 99), active.* from active
  union all
  select 3, 'everyone', 'all users', 0, active.* from active
)
select
  by_what,
  grp                                                        as "group",
  count(*)                                                   as users,
  round(avg(app_min / days), 1)                              as app_min_per_day,
  round(avg(focus_min / days), 1)                            as focus_min_per_day,
  round(100 * sum(focus_min) / nullif(sum(app_min), 0), 1)   as focus_share_pct,
  round(avg(avg_load), 1)                                    as avg_overload,
  round(avg(avg_peak_load), 1)                               as avg_peak_overload,
  round(100 * sum(red_days) / nullif(sum(days), 0), 1)       as red_days_pct,
  case when part = 3 then round(corr(social_h, focus_min / days)::numeric, 2) end as corr_social_vs_focus,
  case when part = 3 then round(corr(social_h, avg_load)::numeric, 2) end         as corr_social_vs_overload
from grouped
group by part, by_what, grp, sort
having count(*) >= 3 or part = 3
order by part, sort, grp;
