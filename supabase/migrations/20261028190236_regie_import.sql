-- Régie importer: station status, price history, import log, and the function
-- the import-regie Edge Function calls to store a snapshot atomically.

-- Stations ---------------------------------------------------------------------

alter table public.stations
  add column status text,
  -- Last snapshot that listed this station: tells apart a closed / removed
  -- station from one whose prices just haven't changed.
  add column last_seen_at timestamptz;

comment on column public.stations.status is 'Status reported by the Régie, e.g. "En opération"';

-- Price history ------------------------------------------------------------------
-- One row each time a station's prices change (not every import): ~2 500 rows
-- per day instead of ~60 000 if we stored every snapshot.

create table public.station_price_history (
  station_id text not null references public.stations (id) on delete cascade,
  published_at timestamptz not null,
  price_regular integer check (price_regular between 500 and 5000),
  price_premium integer check (price_premium between 500 and 5000),
  price_diesel integer check (price_diesel between 500 and 5000),
  primary key (station_id, published_at)
);

comment on table public.station_price_history is
  'Prices of a station from published_at until its next row. Source: Régie de l''énergie.';

alter table public.station_price_history enable row level security;

create policy "Price history is readable by everyone"
  on public.station_price_history for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.station_price_history from anon, authenticated;

-- Import log ---------------------------------------------------------------------
-- Operational data for us, not for visitors: no policy, no access from the browser.

create table public.import_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  status text not null check (status in ('imported', 'not_modified', 'skipped_stale', 'failed')),
  -- HTTP ETag of the feed: lets the next run ask "changed since?" (HTTP 304 if not)
  source_etag text,
  published_at timestamptz,
  station_count integer,
  price_change_count integer,
  issue_count integer,
  error text
);

alter table public.import_runs enable row level security;
revoke all on public.import_runs from anon, authenticated;

-- Import function ----------------------------------------------------------------

-- Shape of one station sent by the Edge Function (snake_case, flat prices).
create type public.regie_station_input as (
  id text,
  name text,
  brand text,
  address text,
  region text,
  postal_code text,
  lat double precision,
  lng double precision,
  status text,
  price_regular integer,
  price_premium integer,
  price_diesel integer
);

-- One call = one transaction: the snapshot is stored completely or not at all.
create function public.import_regie_stations(p_published_at timestamptz, p_stations jsonb)
returns table (station_count integer, price_change_count integer)
language plpgsql
-- Runs with the caller's rights (service_role); search_path = '' forces fully
-- qualified names, so nobody can slip a look-alike table into the lookup path.
security invoker
set search_path = ''
as $$
declare
  v_changes integer := 0;
  v_new integer := 0;
begin
  -- Feeds can arrive out of order (retries): never overwrite newer prices with older ones.
  if exists (select 1 from public.stations where prices_updated_at > p_published_at) then
    return query select 0, 0;
    return;
  end if;

  -- 1. History for known stations whose prices changed (compared before overwriting them).
  insert into public.station_price_history (station_id, published_at, price_regular, price_premium, price_diesel)
  select i.id, p_published_at, i.price_regular, i.price_premium, i.price_diesel
  from jsonb_populate_recordset(null::public.regie_station_input, p_stations) as i
  join public.stations as s on s.id = i.id
  where (s.price_regular, s.price_premium, s.price_diesel)
        is distinct from (i.price_regular, i.price_premium, i.price_diesel)
  on conflict do nothing;
  get diagnostics v_changes = row_count;

  -- 2. Upsert: insert new stations, update the others.
  insert into public.stations (
    id, name, brand, address, region, postal_code, lat, lng, status,
    price_regular, price_premium, price_diesel, prices_updated_at, last_seen_at
  )
  select i.id, i.name, i.brand, i.address, i.region, i.postal_code, i.lat, i.lng, i.status,
         i.price_regular, i.price_premium, i.price_diesel, p_published_at, p_published_at
  from jsonb_populate_recordset(null::public.regie_station_input, p_stations) as i
  on conflict (id) do update set
    name = excluded.name,
    brand = excluded.brand,
    address = excluded.address,
    region = excluded.region,
    postal_code = excluded.postal_code,
    lat = excluded.lat,
    lng = excluded.lng,
    status = excluded.status,
    price_regular = excluded.price_regular,
    price_premium = excluded.price_premium,
    price_diesel = excluded.price_diesel,
    prices_updated_at = excluded.prices_updated_at,
    last_seen_at = excluded.last_seen_at;

  -- 3. First history point for stations seen for the first time (they exist now,
  --    so the foreign key is satisfied).
  insert into public.station_price_history (station_id, published_at, price_regular, price_premium, price_diesel)
  select s.id, p_published_at, s.price_regular, s.price_premium, s.price_diesel
  from public.stations as s
  where s.last_seen_at = p_published_at
    and not exists (select 1 from public.station_price_history as h where h.station_id = s.id);
  get diagnostics v_new = row_count;

  return query select jsonb_array_length(p_stations), v_changes + v_new;
end;
$$;

comment on function public.import_regie_stations is
  'Stores a Régie snapshot. Called by the import-regie Edge Function with the service_role key only.';

-- Functions are executable by everyone by default: lock it down to the server.
revoke execute on function public.import_regie_stations(timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.import_regie_stations(timestamptz, jsonb) to service_role;
