-- Initial migration for rooms table (consolidated)
drop table if exists public.rooms cascade;

create table public.rooms (
  id text primary key,
  code text not null unique check (char_length(code) = 6),
  name text not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid,
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  game_state jsonb not null default '{}'::jsonb,
  current_turn text check (current_turn in ('white','black')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

-- RLS: anyone can select
create policy "rooms_select" on public.rooms for select using (true);

-- Authenticated users can insert only if host_id = auth.uid()
create policy "rooms_insert_auth" on public.rooms for insert with check (auth.uid() = host_id);

-- Host or guest can update their room
create policy "rooms_update_host_or_guest" on public.rooms for update using (
  auth.uid() = host_id or auth.uid() = guest_id
);

-- Trigger to keep updated_at
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

-- Enable publication for realtime
-- Note: requires superuser or proper rights when pushing migration
alter publication supabase_realtime add table public.rooms;
