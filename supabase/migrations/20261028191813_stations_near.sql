-- stations_near: stations selling a fuel within a radius, cheapest first.
--
-- Same rules as the web app's findNearbyStations (src/features/stations/nearby.ts),
-- which runs on the phone so the user's position never leaves it. This function
-- is for callers that shouldn't download all stations first (future mobile app,
-- server-side jobs). Callers sending a user's position should round it first:
-- API request logs must never hold precise coordinates (CLAUDE.md, Loi 25).

create function public.stations_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer,
  p_fuel text
)
returns table (
  id text,
  name text,
  brand text,
  address text,
  region text,
  postal_code text,
  lat double precision,
  lng double precision,
  price integer,
  distance_m integer,
  prices_updated_at timestamptz
)
language plpgsql
stable -- reads only: lets Postgres optimize and PostgREST allow GET requests
security invoker -- runs with the caller's rights, so RLS on stations still applies
set search_path = ''
as $$
declare
  v_origin extensions.geography;
begin
  -- Validate input: this function is reachable by anyone through the API.
  if p_fuel is null or p_fuel not in ('regular', 'premium', 'diesel') then
    raise exception 'p_fuel must be regular, premium or diesel, got %', p_fuel
      using errcode = '22023'; -- invalid_parameter_value
  end if;
  -- Capped so a single call can't ask for the whole province.
  if p_radius_m is null or p_radius_m not between 100 and 100000 then
    raise exception 'p_radius_m must be between 100 and 100000 meters, got %', p_radius_m
      using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid coordinates (%, %)', p_lat, p_lng using errcode = '22023';
  end if;

  v_origin := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  return query
  select *
  from (
    select
      s.id, s.name, s.brand, s.address, s.region, s.postal_code, s.lat, s.lng,
      case p_fuel
        when 'regular' then s.price_regular
        when 'premium' then s.price_premium
        else s.price_diesel
      end as price,
      -- use_spheroid = false: distance on a sphere, like the app's haversine
      -- formula, so the website and this function agree on who is "within 10 km".
      round(extensions.st_distance(s.location, v_origin, false))::integer as distance_m,
      s.prices_updated_at
    from public.stations as s
    -- st_dwithin can use the GiST index on location: only nearby rows are examined.
    where extensions.st_dwithin(s.location, v_origin, p_radius_m, false)
  ) as nearby
  where nearby.price is not null
  order by nearby.price, nearby.distance_m
  limit 200;
end;
$$;

comment on function public.stations_near is
  'Stations selling p_fuel within p_radius_m of (p_lat, p_lng), cheapest first, then closest. Max 200.';

-- Public data, like the stations table itself.
grant execute on function public.stations_near(double precision, double precision, integer, text)
  to anon, authenticated;
