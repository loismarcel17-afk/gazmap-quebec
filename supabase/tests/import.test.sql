-- pgTAP tests for the Régie import function, price history and import log.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- Start from empty tables whatever the local database holds (real imports):
-- the final rollback restores everything.
delete from public.station_price_history;
delete from public.stations;

-- Two stations, as the Edge Function sends them.
create temp table snapshot_1 as select '[
  {"id": "a", "name": "Station A", "brand": "Shell", "address": "1 rue A, Québec", "region": "Capitale-Nationale",
   "postal_code": "G1R 1A1", "lat": 46.81, "lng": -71.21, "status": "En opération",
   "price_regular": 1859, "price_premium": 2109, "price_diesel": null},
  {"id": "b", "name": "Station B", "brand": null, "address": "2 rue B, Lévis", "region": "Chaudière-Appalaches",
   "postal_code": "G6V 2B2", "lat": 46.80, "lng": -71.18, "status": "En opération",
   "price_regular": 1829, "price_premium": 2079, "price_diesel": 2899}
]'::jsonb as data;

-- Same stations one hour later: only A's regular price changed.
create temp table snapshot_2 as
select jsonb_set(data, '{0,price_regular}', '1869') as data from snapshot_1;

-- The test tables belong to the admin role; let the importer's role read them.
grant select on snapshot_1, snapshot_2 to service_role;

-- Who may call it ----------------------------------------------------------------

set local role anon;
select throws_ok(
  $$select * from public.import_regie_stations(now(), '[]')$$,
  '42501', null, 'a visitor cannot run an import'
);
reset role;
set local role authenticated;
select throws_ok(
  $$select * from public.import_regie_stations(now(), '[]')$$,
  '42501', null, 'a signed-in user cannot run an import'
);
reset role;

-- From here on, act as the Edge Function does.
set local role service_role;

-- First import ---------------------------------------------------------------------

select results_eq(
  $$select * from public.import_regie_stations('2026-10-28 17:00Z', (select data from snapshot_1))$$,
  $$values (2, 2)$$,
  'first import: 2 stations, each gets a first history point'
);
select is((select count(*)::int from public.stations), 2, 'stations are created');
select is(
  (select price_regular from public.stations where id = 'a'), 1859, 'prices are stored'
);
select is(
  (select prices_updated_at from public.stations where id = 'a'), '2026-10-28 17:00Z'::timestamptz,
  'prices_updated_at is the Régie publication time'
);

-- Second import: one price changed --------------------------------------------------

select results_eq(
  $$select * from public.import_regie_stations('2026-10-28 18:00Z', (select data from snapshot_2))$$,
  $$values (2, 1)$$,
  'second import: only the changed station gets a history row'
);
select is((select price_regular from public.stations where id = 'a'), 1869, 'the new price replaces the old one');
select results_eq(
  $$select published_at, price_regular from public.station_price_history where station_id = 'a' order by published_at$$,
  $$values ('2026-10-28 17:00Z'::timestamptz, 1859), ('2026-10-28 18:00Z'::timestamptz, 1869)$$,
  'history keeps both prices of station A'
);
select is(
  (select last_seen_at from public.stations where id = 'b'), '2026-10-28 18:00Z'::timestamptz,
  'an unchanged station is still marked as seen'
);

-- A sponsorship set by us survives the next import.
reset role;
update public.stations set sponsored = true where id = 'b';
set local role service_role;
select public.import_regie_stations('2026-10-28 18:30Z', (select data from snapshot_2));
select is((select sponsored from public.stations where id = 'b'), true, 'imports never reset a sponsorship');

-- Replays and late arrivals ---------------------------------------------------------

select results_eq(
  $$select * from public.import_regie_stations('2026-10-28 18:30Z', (select data from snapshot_2))$$,
  $$values (2, 0)$$,
  'importing the same snapshot twice changes nothing'
);
select results_eq(
  $$select * from public.import_regie_stations('2026-10-28 16:00Z', (select data from snapshot_1))$$,
  $$values (0, 0)$$,
  'an older snapshot arriving late is ignored'
);
select is((select price_regular from public.stations where id = 'a'), 1869, '…and does not bring back the old price');

select throws_ok(
  $$select * from public.import_regie_stations('2026-10-28 19:00Z',
      jsonb_set((select data from snapshot_2), '{0,price_regular}', '18690'))$$,
  '23514', null,
  'a snapshot with an absurd price is rejected as a whole'
);

reset role;

-- What a visitor can see -------------------------------------------------------------

set local role anon;
select is(
  (select count(*)::int from public.station_price_history), 3, 'a visitor can read the price history'
);
select throws_ok($$select * from public.import_runs$$, '42501', null, 'a visitor cannot read the import log');
reset role;

select * from finish();
rollback;
