-- ===========================================================================
-- Mana Table — Supabase schema
-- ===========================================================================
-- Paste this whole file into the Supabase SQL editor and hit Run.
-- It is safe to run more than once.
--
-- Design note: an entire table (players, life totals, commander damage,
-- planechase deck, scheme deck, roles, log) is a single JSON document in one
-- row. Writes are a compare-and-set on `version`, which is what stops two
-- phones tapping at the same instant from clobbering each other.
-- ===========================================================================

create table if not exists public.rooms (
  code       text        primary key,
  state      jsonb       not null,
  version    integer     not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists rooms_updated_at_idx on public.rooms (updated_at);

-- Realtime only sends *changed* columns on UPDATE unless the table has a full
-- replica identity. We store the game in one jsonb column, so without this a
-- listener can receive an event with no `state` in it.
alter table public.rooms replica identity full;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- There are no accounts: knowing the five-character room code *is* the
-- authorisation. Keep that in mind if you ever put real prizes on the line.
alter table public.rooms enable row level security;

drop policy if exists "rooms_select" on public.rooms;
create policy "rooms_select" on public.rooms
  for select using (true);

drop policy if exists "rooms_insert" on public.rooms;
create policy "rooms_insert" on public.rooms
  for insert with check (true);

drop policy if exists "rooms_update" on public.rooms;
create policy "rooms_update" on public.rooms
  for update using (true) with check (true);

drop policy if exists "rooms_delete" on public.rooms;
create policy "rooms_delete" on public.rooms
  for delete using (true);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Housekeeping (optional but recommended)
-- ---------------------------------------------------------------------------
-- Abandoned tables otherwise sit in the database forever. Run this whenever
-- you feel like it, or schedule it with pg_cron:
--
--   select cron.schedule('manatable-cleanup', '0 4 * * *',
--                        $$select public.delete_stale_rooms(48)$$);
--
create or replace function public.delete_stale_rooms(older_than_hours int default 48)
returns int
language plpgsql
as $$
declare
  removed int;
begin
  delete from public.rooms
   where updated_at < now() - make_interval(hours => older_than_hours);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cleanup from the previous version of the app (OPTIONAL — read before running)
-- ---------------------------------------------------------------------------
-- The old build kept its data in three normalised tables. Nothing reads them
-- any more. Uncomment only if you are sure you do not want that history.
--
-- drop table if exists public.commander_damage;
-- drop table if exists public.players;
-- drop table if exists public.lobbies;
