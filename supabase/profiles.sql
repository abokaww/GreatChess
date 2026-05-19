-- Run in Supabase SQL Editor

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  username text unique,
  avatar_url text,
  city text,
  elo integer not null default 1000 check (elo >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  ai_requests_count integer not null default 0 check (ai_requests_count >= 0),
  last_ai_request_date date,
  is_pro boolean not null default false,
  coach_last_used timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text unique;
alter table public.profiles add column if not exists elo integer not null default 1000;
alter table public.profiles add column if not exists wins integer not null default 0;
alter table public.profiles add column if not exists losses integer not null default 0;
alter table public.profiles add column if not exists ai_requests_count integer not null default 0;
alter table public.profiles add column if not exists last_ai_request_date date;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, elo, wins, losses, ai_requests_count)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    1000,
    0,
    0,
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
