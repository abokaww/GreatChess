-- ============================================================
-- GreatChess: ПОЛНЫЙ СБРОС (вставьте в Supabase → SQL Editor → Run)
-- ============================================================

drop table if exists public.saved_games cascade;
drop table if exists public.rooms cascade;

-- Комнаты: код + название, только зарегистрированные (Google)
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  host_user_id uuid not null references auth.users (id) on delete cascade,
  guest_user_id uuid references auth.users (id) on delete set null,
  host_color text not null check (host_color in ('white', 'black')),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_not_self_guest check (guest_user_id is null or guest_user_id <> host_user_id)
);

create index rooms_code_idx on public.rooms (code);

-- Сохранённые партии (привязка к auth.users)
create table public.saved_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('ai', 'local', 'multiplayer')),
  title text not null,
  room_id uuid references public.rooms (id) on delete set null,
  fen text not null,
  pgn text not null default '',
  human_color text check (human_color in ('white', 'black')),
  player_color text check (player_color in ('white', 'black')),
  board_theme text not null default 'default',
  piece_theme text not null default 'default',
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_games_user_updated_idx on public.saved_games (user_id, updated_at desc);
create unique index saved_games_user_room_ongoing_idx
  on public.saved_games (user_id, room_id)
  where (mode = 'multiplayer' and not finished and room_id is not null);

alter table public.rooms enable row level security;
alter table public.saved_games enable row level security;

-- rooms: только авторизованные
drop policy if exists "rooms_select_auth" on public.rooms;
drop policy if exists "rooms_insert_host" on public.rooms;
drop policy if exists "rooms_update_players" on public.rooms;

create policy "rooms_select_auth" on public.rooms
  for select to authenticated using (true);

create policy "rooms_insert_host" on public.rooms
  for insert to authenticated with check (host_user_id = auth.uid());

create policy "rooms_update_players" on public.rooms
  for update to authenticated
  using (
    host_user_id = auth.uid()
    or guest_user_id = auth.uid()
    or (guest_user_id is null and status in ('waiting', 'active'))
  )
  with check (host_user_id = auth.uid() or guest_user_id = auth.uid());

-- saved_games: только свой аккаунт
drop policy if exists "saved_games_select_own" on public.saved_games;
drop policy if exists "saved_games_insert_own" on public.saved_games;
drop policy if exists "saved_games_update_own" on public.saved_games;
drop policy if exists "saved_games_delete_own" on public.saved_games;

create policy "saved_games_select_own" on public.saved_games
  for select using (auth.uid() = user_id);
create policy "saved_games_insert_own" on public.saved_games
  for insert with check (auth.uid() = user_id);
create policy "saved_games_update_own" on public.saved_games
  for update using (auth.uid() = user_id);
create policy "saved_games_delete_own" on public.saved_games
  for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_updated_at on public.rooms;
create trigger rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

drop trigger if exists saved_games_updated_at on public.saved_games;
create trigger saved_games_updated_at
  before update on public.saved_games
  for each row execute function public.set_updated_at();
