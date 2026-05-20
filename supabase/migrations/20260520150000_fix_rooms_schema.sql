-- Fix rooms table schema to match application code
-- Drop old rooms table and recreate with correct columns
drop table if exists public.rooms cascade;

-- Recreate rooms table with correct schema
create table public.rooms (
  id text primary key,
  code text not null unique,
  name text not null,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid,
  host_color text not null check (host_color in ('white', 'black')),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.rooms enable row level security;

-- RLS policies: room id acts as shared secret; guests and auth users can sync live games
create policy "rooms_select" on public.rooms for select using (true);
create policy "rooms_insert" on public.rooms for insert with check (true);
create policy "rooms_update" on public.rooms for update using (true);
create policy "rooms_delete" on public.rooms for delete using (true);

-- Trigger for updated_at
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

-- Update foreign key references from saved_games (if they exist)
alter table public.saved_games
drop constraint if exists saved_games_room_id_fkey;

alter table public.saved_games
add constraint saved_games_room_id_fkey
  foreign key (room_id) references public.rooms(id) on delete set null;
