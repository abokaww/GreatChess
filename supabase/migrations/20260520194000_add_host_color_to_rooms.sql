-- Add host_color column for multiplayer room flow
alter table public.rooms add column if not exists host_color text not null default 'white';

alter table public.rooms drop constraint if exists rooms_host_color_check;
create constraint rooms_host_color_check on public.rooms check (host_color in ('white','black'));

-- Ensure existing room rows have a valid game_state value
update public.rooms set game_state = coalesce(game_state, '{}'::jsonb)
  where game_state is null;
