-- Sponsored stations: a paid placement shown with a "Commanditée" label.
-- It never changes the ranking (CLAUDE.md): the order is computed from the total
-- fill-up cost only, in src/features/recommendation/rank.ts.
--
-- Set by us (service_role) under a commercial agreement; the Régie importer
-- does not touch it (not in its upsert), and visitors can't change it
-- (no write privileges on stations, migration create_stations).

alter table public.stations
  add column sponsored boolean not null default false;

comment on column public.stations.sponsored is
  'Paid placement: labeled "Commanditée" in the app, never affects the ranking.';
