-- pgTAP tests for public.stations_near.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

delete from public.station_price_history;
delete from public.stations;

-- Origin: downtown Québec City. Test stations are placed due east of it at exact
-- distances with st_project (geography, meters, azimuth in radians).
create temp table origin as
select extensions.st_setsrid(extensions.st_makepoint(-71.208, 46.8139), 4326)::extensions.geography as g;

insert into public.stations (id, name, address, region, postal_code, lat, lng,
                             price_regular, price_diesel, prices_updated_at)
select v.id, v.id, 'x', 'x', 'x',
       extensions.st_y(p::extensions.geometry), extensions.st_x(p::extensions.geometry),
       v.regular, v.diesel, now()
from (values
  ('a-3km',  3000, 1859, null),
  ('b-8km',  8000, 1829, null),
  ('c-12km', 12000, 1700, null), -- cheapest, but outside 10 km
  ('d-2km',  2000, null, 2899),  -- no regular gasoline
  ('e-5km',  5000, 1859, null)   -- same price as a-3km, farther
) as v(id, meters, regular, diesel),
lateral (select extensions.st_project((select g from origin), v.meters, radians(90)) as p) as projected;

-- Results ------------------------------------------------------------------------

select results_eq(
  $$select id from public.stations_near(46.8139, -71.208, 10000, 'regular')$$,
  $$values ('b-8km'), ('a-3km'), ('e-5km')$$,
  'within 10 km, cheapest first, then closest; stations without the fuel or too far are left out'
);
select ok(
  (select abs(distance_m - 3000) <= 15 from public.stations_near(46.8139, -71.208, 10000, 'regular') where id = 'a-3km'),
  'distance_m is the distance in meters (sphere vs. spheroid: within 0.5 %)'
);
select is(
  (select price from public.stations_near(46.8139, -71.208, 10000, 'regular') where id = 'b-8km'),
  1829,
  'price is the requested fuel''s price'
);
select results_eq(
  $$select id, price from public.stations_near(46.8139, -71.208, 10000, 'diesel')$$,
  $$values ('d-2km', 2899)$$,
  'another fuel gives another list'
);
select results_eq(
  $$select id from public.stations_near(46.8139, -71.208, 15000, 'regular')$$,
  $$values ('c-12km'), ('b-8km'), ('a-3km'), ('e-5km')$$,
  'a wider radius brings in the farther station'
);
select is_empty(
  $$select * from public.stations_near(48.4, -68.5, 10000, 'regular')$$,
  'nothing near Rimouski'
);

-- Sorting on exact distances --------------------------------------------------------
-- 40 cm apart, both round to the same distance_m: the order must follow the exact distance.
insert into public.stations (id, name, address, region, postal_code, lat, lng, price_regular, prices_updated_at)
select v.id, v.id, 'x', 'x', 'x',
       extensions.st_y(p::extensions.geometry), extensions.st_x(p::extensions.geometry), 1799, now()
from (values ('far-by-40cm', 4000.4), ('near', 4000.0)) as v(id, meters),
lateral (select extensions.st_project((select g from origin), v.meters, radians(0)) as p) as projected;

select results_eq(
  $$select id from public.stations_near(46.8139, -71.208, 10000, 'regular') where price = 1799$$,
  $$values ('near'), ('far-by-40cm')$$,
  'ties after rounding are ordered by the exact distance'
);
delete from public.stations where price_regular = 1799;

-- Input validation -----------------------------------------------------------------

select throws_ok(
  $$select * from public.stations_near(46.8, -71.2, 10000, 'e85')$$,
  '22023', null, 'rejects an unknown fuel'
);
select throws_ok(
  $$select * from public.stations_near(46.8, -71.2, 500000, 'regular')$$,
  '22023', null, 'rejects a radius over 100 km'
);
select throws_ok(
  $$select * from public.stations_near(146.8, -71.2, 10000, 'regular')$$,
  '22023', null, 'rejects impossible coordinates'
);

-- Access ---------------------------------------------------------------------------

grant select on origin to anon;
set local role anon;
select is(
  (select count(*)::int from public.stations_near(46.8139, -71.208, 10000, 'regular')),
  3,
  'a visitor can call it'
);
select is(
  (select provolatile from pg_proc where proname = 'stations_near'),
  's',
  'declared stable (read-only)'
);
reset role;

select is(
  (select prosecdef from pg_proc where proname = 'stations_near'),
  false,
  'security invoker: RLS on stations applies to the caller'
);

select * from finish();
rollback;
