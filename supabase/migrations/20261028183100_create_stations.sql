-- Gas stations and their current prices, imported from the Régie de l'énergie.
-- Price history comes with the importer (PLAN.md task 4).

-- PostGIS: geographic types, distances on the Earth's surface, spatial indexes.
-- Supabase convention: extensions live in their own schema, not in public.
create extension if not exists postgis with schema extensions;
-- moddatetime: ready-made trigger that keeps updated_at current.
create extension if not exists moddatetime with schema extensions;

create table public.stations (
  -- Stable id computed by the Régie adapter (hash of name | address | postal code).
  id text primary key,
  name text,
  brand text,
  address text not null,
  region text not null,
  postal_code text not null,

  -- The importer writes plain lat / lng; the PostGIS point is derived from them,
  -- so the two can never disagree. Bounds: same box around Québec as the adapter,
  -- a last line of defense against swapped or (0, 0) coordinates.
  lat double precision not null check (lat between 44 and 63),
  lng double precision not null check (lng between -80 and -57),
  -- geography (not geometry): distances come out in meters on the curved Earth.
  -- 4326 = WGS 84, the GPS coordinate system.
  location extensions.geography(Point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
  ) stored not null,

  -- Prices in tenths of a cent per litre (1859 = 185.9 ¢/L); null = not sold / unknown.
  -- Integers, never floats: money must add up exactly.
  price_regular integer check (price_regular between 500 and 5000),
  price_premium integer check (price_premium between 500 and 5000),
  price_diesel integer check (price_diesel between 500 and 5000),
  -- When the Régie published these prices (not when we imported them).
  prices_updated_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stations is
  'Gas stations with their latest prices. Source: Régie de l''énergie. Read-only for clients.';
comment on column public.stations.price_regular is 'Tenths of a cent per litre (1859 = 185.9 ¢/L)';
comment on column public.stations.price_premium is 'Tenths of a cent per litre (1859 = 185.9 ¢/L)';
comment on column public.stations.price_diesel is 'Tenths of a cent per litre (1859 = 185.9 ¢/L)';

-- GiST index: makes "stations within X km of here" fast (PLAN.md task 5)
-- instead of computing the distance to all 2 500 stations.
create index stations_location_idx on public.stations using gist (location);

create trigger stations_set_updated_at
  before update on public.stations
  for each row execute function extensions.moddatetime(updated_at);

-- Row Level Security: without a policy, nobody (except service_role) sees a row.
alter table public.stations enable row level security;

-- Prices are public: the map works without an account.
create policy "Stations are readable by everyone"
  on public.stations for select
  to anon, authenticated
  using (true);

-- No insert / update / delete policy: only the importer, running with the
-- service_role key on the server, writes stations. Revoking the privileges as
-- well is defense in depth, and the only protection against TRUNCATE, which
-- ignores RLS entirely.
revoke insert, update, delete, truncate on public.stations from anon, authenticated;
