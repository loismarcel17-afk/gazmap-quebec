-- stations_near: sort on the exact distance, not the rounded one.
--
-- The first version ordered by distance_m, already rounded to the meter: two
-- stations at the same price, 5 452.6 m and 5 453.0 m away, both became 5 453 m
-- and came out in arbitrary order, unlike the web app (which sorts on exact
-- distances). Rule: sort on exact values, round only for display. The station id
-- is a final tie-breaker so the order is always the same (collate "C": plain
-- byte order, the same as JavaScript's < on these ASCII ids).

create or replace function public.stations_near(
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
stable
security invoker
set search_path = ''
as $$
declare
  v_origin extensions.geography;
begin
  if p_fuel is null or p_fuel not in ('regular', 'premium', 'diesel') then
    raise exception 'p_fuel must be regular, premium or diesel, got %', p_fuel
      using errcode = '22023';
  end if;
  if p_radius_m is null or p_radius_m not between 100 and 100000 then
    raise exception 'p_radius_m must be between 100 and 100000 meters, got %', p_radius_m
      using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid coordinates (%, %)', p_lat, p_lng using errcode = '22023';
  end if;

  v_origin := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  return query
  select
    nearby.id, nearby.name, nearby.brand, nearby.address, nearby.region, nearby.postal_code,
    nearby.lat, nearby.lng, nearby.price,
    round(nearby.distance)::integer as distance_m, -- rounded for display only
    nearby.prices_updated_at
  from (
    select
      s.*,
      case p_fuel
        when 'regular' then s.price_regular
        when 'premium' then s.price_premium
        else s.price_diesel
      end as price,
      extensions.st_distance(s.location, v_origin, false) as distance
    from public.stations as s
    where extensions.st_dwithin(s.location, v_origin, p_radius_m, false)
  ) as nearby
  where nearby.price is not null
  order by nearby.price, nearby.distance, nearby.id collate "C"
  limit 200;
end;
$$;
