-- LoadMind database. Run once: Supabase -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again.

-- 1. One row per user with all their LoadMind data (tasks, settings, focus log)
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "user_data: read own" on public.user_data;
drop policy if exists "user_data: insert own" on public.user_data;
drop policy if exists "user_data: update own" on public.user_data;
drop policy if exists "user_data: delete own" on public.user_data;

create policy "user_data: read own" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_data: insert own" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_data: update own" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_data: delete own" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_data to authenticated;

-- the server sets the time of every change, so devices can tell which copy is newer
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch before insert or update on public.user_data
  for each row execute function public.touch_updated_at();

-- 2. AI requests per user per day (the Worker checks this before calling Gemini)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage: read own" on public.ai_usage;
create policy "ai_usage: read own" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.ai_usage to authenticated;

-- adds one request for the signed-in user and returns how many are left today (below 0 = limit reached).
-- Besides the per-user limit there is one limit for the whole site, so many new accounts can't run up the AI bill.
drop function if exists public.use_ai(int);
create or replace function public.use_ai(daily_limit int default 30, total_limit int default 1500)
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int;
  total int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  -- anyone signed in can call this, so the limits can only be lowered from outside, never raised
  daily_limit := least(greatest(daily_limit, 1), 50);
  total_limit := least(greatest(total_limit, 1), 1500);
  -- already at the limit: refuse without counting, so refused tries don't fill up the site total
  select u.count into n from public.ai_usage u where u.user_id = auth.uid() and u.day = current_date;
  if coalesce(n, 0) >= daily_limit then
    return -1;
  end if;
  select coalesce(sum(u.count), 0) into total from public.ai_usage u where u.day = current_date;
  if total >= total_limit then
    return -1;
  end if;
  insert into public.ai_usage as u (user_id, day, count)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = u.count + 1
  returning u.count into n;
  return daily_limit - n;
end $$;
revoke execute on function public.use_ai(int, int) from public, anon;
grant execute on function public.use_ai(int, int) to authenticated;
create index if not exists ai_usage_day on public.ai_usage (day);

-- 3. Feedback from the «Feedback» button in the app. Anyone can send it, with or without an account,
--    but nobody can read it through the app. Read it in Supabase -> Table Editor -> feedback.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text check (kind in ('bug', 'idea', 'like', 'other')),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  contact text check (char_length(contact) <= 200),
  lang text check (lang in ('en', 'ru')),
  page text check (char_length(page) <= 40)
);

alter table public.feedback enable row level security;

drop policy if exists "feedback: send" on public.feedback;
create policy "feedback: send" on public.feedback
  for insert to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));

revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;

-- at most 30 messages an hour from everyone together and 5 an hour from one account, so the form can't be used for spam
create or replace function public.feedback_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feedback f where f.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'feedback limit';
  end if;
  if new.user_id is not null and (select count(*) from public.feedback f
      where f.user_id = new.user_id and f.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'feedback limit';
  end if;
  return new;
end $$;
revoke execute on function public.feedback_rate_limit() from public, anon, authenticated;
drop trigger if exists feedback_limit on public.feedback;
create trigger feedback_limit before insert on public.feedback
  for each row execute function public.feedback_rate_limit();
create index if not exists feedback_created on public.feedback (created_at);
