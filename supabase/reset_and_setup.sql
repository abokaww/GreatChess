-- ============================================================
-- GreatChess: полный сброс и создание таблиц заново
-- Выполните в Supabase → SQL Editor → Run
-- ============================================================

drop table if exists public.saved_games cascade;
drop table if exists public.rooms cascade;

-- Комнаты мультиплеера (доступны всем: гости + авторизованные)
create table public.rooms (
  id text primary key,
  host_id text not null,
  host_color text not null check (host_color in ('white', 'black')),
  white_player_id text,
  black_player_id text,
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Сохранённые партии (только для владельца аккаунта Google)
create table public.saved_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('ai', 'local', 'multiplayer')),
  title text not null,
  room_id text references public.rooms (id) on delete set null,
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

alter table public.rooms enable row level security;
alter table public.saved_games enable row level security;

-- rooms: открытые политики (гости без auth.uid)
drop policy if exists "rooms_select" on public.rooms;
drop policy if exists "rooms_insert" on public.rooms;
drop policy if exists "rooms_update" on public.rooms;
drop policy if exists "rooms_delete" on public.rooms;

create policy "rooms_select" on public.rooms for select using (true);
create policy "rooms_insert" on public.rooms for insert with check (true);
create policy "rooms_update" on public.rooms for update using (true);
create policy "rooms_delete" on public.rooms for delete using (true);

-- saved_games: только свой user_id
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
