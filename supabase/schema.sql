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

-- adds one request for the signed-in user and returns how many are left today (below 0 = limit reached)
create or replace function public.use_ai(daily_limit int default 30)
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.ai_usage as u (user_id, day, count)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = u.count + 1
  returning u.count into n;
  return daily_limit - n;
end $$;

revoke execute on function public.use_ai(int) from public, anon;
grant execute on function public.use_ai(int) to authenticated;
