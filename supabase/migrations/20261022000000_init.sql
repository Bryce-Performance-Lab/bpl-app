-- Bryce Performance Lab: coaching platform schema
-- Run once in the Supabase SQL editor (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Settings: who the coach is. Only this email gets the coach site.
-- ---------------------------------------------------------------------------
create table public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;   -- no policies: not readable from the app
insert into public.app_config (key, value) values ('coach_email', 'rileymacbryce@gmail.com');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'athlete' check (role in ('coach', 'athlete')),
  created_at timestamptz not null default now()
);

create table public.athletes (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  user_id    uuid unique references public.profiles (id) on delete set null,   -- set when the athlete creates their account
  name       text not null,
  email      text not null,
  event      text,
  test_date  date,
  lt1        integer,            -- pace at LT1, seconds per km
  lt2        integer,            -- pace at LT2, seconds per km
  zones      jsonb not null default '[]'::jsonb,   -- [{code, fast, slow, hr}]  (sec/km)
  created_at timestamptz not null default now(),
  constraint athletes_email_lower check (email = lower(email))
);
create unique index athletes_coach_email on public.athletes (coach_id, email);

create table public.sessions (
  id         uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  date       date not null,
  title      text not null default '',
  tag        text not null default 'Easy',
  setting    text,
  steps      jsonb not null default '[]'::jsonb,   -- [{label, reps, amount, unit, zone, recAmount, recUnit, recZone}]
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_athlete_date on public.sessions (athlete_id, date);

create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.athletes (id) on delete cascade,
  session_id    uuid unique references public.sessions (id) on delete set null,
  date          date not null,
  km            numeric,
  duration_sec  integer,
  rpe           numeric check (rpe between 1 and 10),
  comment       text,                                  -- athlete's note
  coach_comment text,                                  -- coach's reply
  lactate       jsonb not null default '[]'::jsonb,    -- [{at, v}]
  parts         jsonb not null default '[]'::jsonb,    -- compact .FIT parts (records every 2 s, laps, session totals)
  analysis      jsonb,                                 -- detected reps, verdicts, pace trace
  files         text[] not null default '{}',          -- original .FIT files in storage
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index activities_athlete_date on public.activities (athlete_id, date);

-- ---------------------------------------------------------------------------
-- Helper checks (security definer so policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'coach');
$$;

create or replace function public.coaches_athlete(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from athletes where id = aid and coach_id = auth.uid());
$$;

create or replace function public.is_my_athlete_record(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from athletes where id = aid and user_id = auth.uid());
$$;

-- Lets the sign-up page say "ask your coach to add you" before trying.
create or replace function public.can_sign_up(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(trim(p_email)) = (select value from app_config where key = 'coach_email')
      or exists (select 1 from athletes where email = lower(trim(p_email)));
$$;
grant execute on function public.can_sign_up(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- New accounts: only the coach's email or an invited athlete may sign up.
-- Invited athletes are linked to their coach automatically.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  v_coach text := (select value from app_config where key = 'coach_email');
begin
  if v_email = v_coach then
    insert into profiles (id, email, full_name, role)
    values (new.id, v_email, new.raw_user_meta_data ->> 'full_name', 'coach');
  elsif exists (select 1 from athletes where email = v_email) then
    insert into profiles (id, email, full_name, role)
    values (new.id, v_email, new.raw_user_meta_data ->> 'full_name', 'athlete');
    update athletes set user_id = new.id where email = v_email and user_id is null;
  else
    raise exception 'not_invited' using hint = 'Ask your coach to add your email first.';
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- If the coach adds an athlete whose account already exists, link it straight away.
create or replace function public.link_existing_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  if new.user_id is null then
    select id into new.user_id from profiles where email = new.email and role = 'athlete'
      and not exists (select 1 from athletes a where a.user_id = profiles.id and a.id <> new.id);
  end if;
  return new;
end;
$$;
create trigger athletes_link before insert or update of email on public.athletes
  for each row execute function public.link_existing_account();

-- Athletes can log runs but can't write the coach's reply.
create or replace function public.protect_coach_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then
    if tg_op = 'INSERT' then new.coach_comment := null;
    else new.coach_comment := old.coach_comment; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger activities_protect before insert or update on public.activities
  for each row execute function public.protect_coach_comment();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: athletes only ever see their own data;
-- the coach sees and edits their own athletes.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.athletes   enable row level security;
alter table public.sessions   enable row level security;
alter table public.activities enable row level security;

create policy "own profile" on public.profiles for select using (id = auth.uid());

create policy "coach manages own athletes" on public.athletes for all
  using (coach_id = auth.uid() and public.is_coach())
  with check (coach_id = auth.uid() and public.is_coach());
create policy "athlete reads own record" on public.athletes for select
  using (user_id = auth.uid());

create policy "coach manages sessions" on public.sessions for all
  using (public.coaches_athlete(athlete_id)) with check (public.coaches_athlete(athlete_id));
create policy "athlete reads own sessions" on public.sessions for select
  using (public.is_my_athlete_record(athlete_id));

create policy "coach manages activities" on public.activities for all
  using (public.coaches_athlete(athlete_id)) with check (public.coaches_athlete(athlete_id));
create policy "athlete manages own activities" on public.activities for all
  using (public.is_my_athlete_record(athlete_id)) with check (public.is_my_athlete_record(athlete_id));

-- ---------------------------------------------------------------------------
-- Original .FIT files: private bucket, one folder per athlete id
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('fit-files', 'fit-files', false, 20971520)
on conflict (id) do nothing;

create policy "fit files read" on storage.objects for select
  using (bucket_id = 'fit-files' and (
    public.coaches_athlete(((storage.foldername(name))[1])::uuid) or public.is_my_athlete_record(((storage.foldername(name))[1])::uuid)));
create policy "fit files upload" on storage.objects for insert
  with check (bucket_id = 'fit-files' and (
    public.coaches_athlete(((storage.foldername(name))[1])::uuid) or public.is_my_athlete_record(((storage.foldername(name))[1])::uuid)));
create policy "fit files delete" on storage.objects for delete
  using (bucket_id = 'fit-files' and (
    public.coaches_athlete(((storage.foldername(name))[1])::uuid) or public.is_my_athlete_record(((storage.foldername(name))[1])::uuid)));
