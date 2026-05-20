-- Multiplayer rooms (host picks color when creating invite link)
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

-- Per-user saved games (AI, local, multiplayer) — persists across sessions
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
create index saved_games_user_mode_ongoing_idx on public.saved_games (user_id, mode)
  where (not finished);

alter table public.rooms enable row level security;
alter table public.saved_games enable row level security;

-- Rooms: room id acts as shared secret; guests and auth users can sync live games
create policy "rooms_select" on public.rooms for select using (true);
create policy "rooms_insert" on public.rooms for insert with check (true);
create policy "rooms_update" on public.rooms for update using (true);

-- Saved games: only owner
create policy "saved_games_select_own" on public.saved_games
  for select using (auth.uid() = user_id);
create policy "saved_games_insert_own" on public.saved_games
  for insert with check (auth.uid() = user_id);
create policy "saved_games_update_own" on public.saved_games
  for update using (auth.uid() = user_id);
create policy "saved_games_delete_own" on public.saved_games
  for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

create trigger saved_games_updated_at
  before update on public.saved_games
  for each row execute function public.set_updated_at();
