-- LoadMind anonymous usage: one row per browser per day, for guests and signed-in users alike.
-- No email, name, IP or task text is stored: only a random id made in the browser and a few numbers.
-- The site writes it only through track_day() below; nobody can read the table from the site.

create table if not exists public.usage_daily (
  anon_id      uuid not null,
  day          date not null,
  first_seen   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  app_min      int  not null default 0,   -- minutes in LoadMind that day (while the page is used)
  focus_min    int  not null default 0,   -- focus timer minutes that day
  tasks        int  not null default 0,   -- tasks the person has added so far (all days)
  load_max     int,                       -- highest overload index that day, 0-100
  load_avg     int,                       -- average overload index that day, 0-100
  grade        text,
  social       text,
  lang         text,
  mobile       boolean not null default false,
  signed_in    boolean not null default false,
  auth_opened  boolean not null default false, -- opened the sign in / sign up window that day
  signup_tried boolean not null default false, -- pressed "Create account" that day
  src          text,                           -- ?from= / utm_source of the first visit, if any
  primary key (anon_id, day)
);

alter table public.usage_daily enable row level security;
revoke all on public.usage_daily from anon, authenticated;

create or replace function public.track_day(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_day  date;
begin
  begin
    v_id  := (p ->> 'id')::uuid;
    v_day := (p ->> 'day')::date;
  exception when others then
    return;
  end;
  if v_id is null or v_day is null or v_day not between current_date - 1 and current_date + 1 then
    return;
  end if;
  -- a cap so a script can't fill the table: at most 20000 new browsers a day
  if not exists (select 1 from public.usage_daily where anon_id = v_id and day = v_day)
     and (select count(*) from public.usage_daily where day = v_day) >= 20000 then
    return;
  end if;

  insert into public.usage_daily as u (anon_id, day, app_min, focus_min, tasks, load_max, load_avg, grade, social, lang, mobile, signed_in, auth_opened, signup_tried, src)
  values (
    v_id, v_day,
    least(greatest(coalesce((p ->> 'app')::int, 0), 0), 1440),
    least(greatest(coalesce((p ->> 'focus')::int, 0), 0), 1440),
    least(greatest(coalesce((p ->> 'tasks')::int, 0), 0), 100000),
    case when p ? 'loadMax' then least(greatest((p ->> 'loadMax')::int, 0), 100) end,
    case when p ? 'loadAvg' then least(greatest((p ->> 'loadAvg')::int, 0), 100) end,
    case when p ->> 'grade' in ('7','8','9','10','11','12','uni','other') then p ->> 'grade' end,
    case when p ->> 'social' in ('0','1','2','4') then p ->> 'social' end,
    case when p ->> 'lang' in ('en','ru') then p ->> 'lang' end,
    coalesce((p ->> 'mobile')::boolean, false),
    coalesce((p ->> 'signedIn')::boolean, false),
    coalesce((p ->> 'authOpened')::boolean, false),
    coalesce((p ->> 'signupTried')::boolean, false),
    case when p ->> 'src' ~ '^[A-Za-z0-9_.-]{1,40}$' then p ->> 'src' end
  )
  on conflict (anon_id, day) do update set
    updated_at   = now(),
    app_min      = greatest(u.app_min, excluded.app_min),
    focus_min    = greatest(u.focus_min, excluded.focus_min),
    tasks        = greatest(u.tasks, excluded.tasks),
    load_max     = coalesce(excluded.load_max, u.load_max),
    load_avg     = coalesce(excluded.load_avg, u.load_avg),
    grade        = coalesce(excluded.grade, u.grade),
    social       = coalesce(excluded.social, u.social),
    lang         = coalesce(excluded.lang, u.lang),
    mobile       = u.mobile or excluded.mobile,
    signed_in    = u.signed_in or excluded.signed_in,
    auth_opened  = u.auth_opened or excluded.auth_opened,
    signup_tried = u.signup_tried or excluded.signup_tried,
    src          = coalesce(u.src, excluded.src);
exception when others then
  return; -- a bad value is simply ignored, the site never sees an error
end;
$$;

revoke all on function public.track_day(jsonb) from public;
grant execute on function public.track_day(jsonb) to anon, authenticated;


-- ===== Handy queries (Supabase -> SQL Editor) =====

-- People per day: how many browsers opened LoadMind, how many actually used it, and the way to an account.
-- select day,
--        count(*)                                   as people,
--        count(*) filter (where app_min >= 1)       as used_1_min_plus,
--        count(*) filter (where tasks > 0)          as added_tasks,
--        count(*) filter (where focus_min > 0)      as used_focus,
--        count(*) filter (where mobile)             as on_phone,
--        count(*) filter (where auth_opened)        as opened_sign_in,
--        count(*) filter (where signup_tried)       as pressed_create_account,
--        count(*) filter (where signed_in)          as signed_in
-- from public.usage_daily group by day order by day desc;

-- Where people came from (links like loadmind.dev/?from=telegram):
-- select coalesce(src, 'direct') as src, count(distinct anon_id) as people
-- from public.usage_daily group by 1 order by 2 desc;

-- Who came back: people seen on 2+ different days.
-- select count(*) from (select anon_id from public.usage_daily group by anon_id having count(*) >= 2) t;
