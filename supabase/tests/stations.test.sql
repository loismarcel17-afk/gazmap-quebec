-- pgTAP tests for public.stations. Run with: npx supabase test db
-- Everything runs inside a transaction that is rolled back: the database is left untouched.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- Structure ------------------------------------------------------------------

select has_table('public', 'stations', 'stations table exists');
select col_is_pk('public', 'stations', 'id', 'id is the primary key');
select col_not_null('public', 'stations', 'location', 'location is required');
select col_is_null('public', 'stations', 'price_diesel', 'a price can be null (fuel not sold)');
select has_index('public', 'stations', 'stations_location_idx', 'spatial index on location');
select is(
  (select relrowsecurity from pg_class where oid = 'public.stations'::regclass),
  true,
  'row level security is enabled'
);

-- Data rules -----------------------------------------------------------------

insert into public.stations (id, name, brand, address, region, postal_code, lat, lng,
                             price_regular, price_premium, price_diesel, prices_updated_at)
values ('test-quebec', 'Station test', 'Shell', '1 rue Saint-Jean, Québec', 'Capitale-Nationale',
        'G1R 1N1', 46.8139, -71.208, 1859, 2109, null, '2026-10-28T17:05:00Z');

select is(
  (select round(extensions.st_y(location::extensions.geometry)::numeric, 4)
     from public.stations where id = 'test-quebec'),
  46.8139::numeric,
  'location is derived from lat'
);
select is(
  (select round(extensions.st_x(location::extensions.geometry)::numeric, 4)
     from public.stations where id = 'test-quebec'),
  -71.2080::numeric,
  'location is derived from lng'
);
select is(
  -- st_distance returns double precision; pgTAP's is() needs both sides of the same type.
  (select round((extensions.st_distance(
     location,
     extensions.st_setsrid(extensions.st_makepoint(-73.5673, 45.5017), 4326)::extensions.geography
   ) / 1000)::numeric) from public.stations where id = 'test-quebec'),
  233::numeric,
  'distances are in meters on the Earth (Québec → Montréal ≈ 233 km)'
);

select throws_ok(
  $$insert into public.stations (id, address, region, postal_code, lat, lng, prices_updated_at)
    values ('null-island', 'x', 'x', 'x', 0, 0, now())$$,
  '23514', -- check_violation
  null,
  'rejects (0, 0) and other coordinates outside Québec'
);
select throws_ok(
  $$insert into public.stations (id, address, region, postal_code, lat, lng, price_regular, prices_updated_at)
    values ('typo', 'x', 'x', 'x', 46, -71, 18590, now())$$,
  '23514',
  null,
  'rejects an absurd price (1 859,0 ¢/L)'
);
select throws_ok(
  $$update public.stations set location = null where id = 'test-quebec'$$,
  '428C9', -- generated_always: the column can't be written directly
  null,
  'location cannot be written directly'
);

update public.stations set updated_at = '2000-01-01', price_regular = 1869 where id = 'test-quebec';
select is(
  (select updated_at from public.stations where id = 'test-quebec'),
  now(),
  'updated_at is refreshed on every update'
);

-- Access: what a visitor's browser (anon key) can and cannot do ----------------

set local role anon;

select is(
  (select count(*)::int from public.stations where id = 'test-quebec'),
  1,
  'anon can read stations'
);
select throws_ok(
  $$insert into public.stations (id, address, region, postal_code, lat, lng, prices_updated_at)
    values ('hack', 'x', 'x', 'x', 46, -71, now())$$,
  '42501', -- insufficient_privilege
  null,
  'anon cannot insert'
);
select throws_ok(
  $$update public.stations set price_regular = 999 where id = 'test-quebec'$$,
  '42501',
  null,
  'anon cannot update prices'
);
select throws_ok($$delete from public.stations$$, '42501', null, 'anon cannot delete');
select throws_ok(
  $$update public.stations set sponsored = true$$, '42501', null, 'anon cannot make a station sponsored'
);
select throws_ok($$truncate public.stations$$, '42501', null, 'anon cannot truncate');

reset role;
set local role authenticated;

select throws_ok(
  $$update public.stations set price_regular = 999 where id = 'test-quebec'$$,
  '42501',
  null,
  'a signed-in user cannot update prices either'
);

reset role;

select * from finish();
rollback;
