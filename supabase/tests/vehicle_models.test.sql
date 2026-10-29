-- pgTAP tests for public.vehicle_models and its import / menu functions.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

delete from public.vehicle_models;

create temp table batch as select '[
  {"model_year": 2026, "make": "Honda", "model": "Civic Sedan", "vehicle_class": "Compacte", "engine_l": 2.0,
   "cylinders": 4, "transmission": "AV7", "fuel_type": "X",
   "city_l_per_100km": 7.4, "highway_l_per_100km": 5.8, "combined_l_per_100km": 6.7},
  {"model_year": 2026, "make": "Acura", "model": "Integra", "vehicle_class": "Grande berline", "engine_l": 1.5,
   "cylinders": 4, "transmission": "AV7", "fuel_type": "Z",
   "city_l_per_100km": 8.0, "highway_l_per_100km": 6.3, "combined_l_per_100km": 7.3},
  {"model_year": 2025, "make": "Ford", "model": "F-150", "vehicle_class": "Camionnette : standard", "engine_l": 3.5,
   "cylinders": 6, "transmission": "AS10", "fuel_type": "X",
   "city_l_per_100km": 14.0, "highway_l_per_100km": 10.6, "combined_l_per_100km": 12.5}
]'::jsonb as data;
grant select on batch to service_role;

-- Import -----------------------------------------------------------------------------

set local role anon;
select throws_ok($$select public.import_nrcan_models('[]')$$, '42501', null, 'a visitor cannot import');
reset role;

set local role service_role;
select is(public.import_nrcan_models((select data from batch)), 3, 'imports 3 models');

create temp table first_ids as select id, model from public.vehicle_models;
select is(
  public.import_nrcan_models(jsonb_set((select data from batch), '{0,combined_l_per_100km}', '6.8')),
  3,
  're-import upserts'
);
reset role;

select is((select count(*)::int from public.vehicle_models), 3, 're-import adds no duplicates');
select is(
  (select combined_l_per_100km from public.vehicle_models where model = 'Civic Sedan'), 6.8,
  'a corrected rating replaces the old one'
);
select is(
  (select id from public.vehicle_models where model = 'Civic Sedan'),
  (select id from first_ids where model = 'Civic Sedan'),
  'ids are kept on re-import (profiles may point to them)'
);

select throws_ok(
  $$insert into public.vehicle_models (model_year, make, model, vehicle_class, engine_l, cylinders, transmission,
      fuel_type, city_l_per_100km, highway_l_per_100km, combined_l_per_100km)
    values (2026, 'X', 'Y', 'Z', 1, 4, 'A', 'E', 9, 7, 8)$$,
  '23514', null, 'E85 is not a stored fuel type'
);

-- Menus and access -----------------------------------------------------------------

set local role anon;
select results_eq(
  $$select * from public.vehicle_model_years()$$,
  $$values (2026::smallint), (2025::smallint)$$,
  'years, newest first'
);
select results_eq(
  $$select * from public.vehicle_makes(2026::smallint)$$,
  $$values ('Acura'), ('Honda')$$,
  'makes of a year, alphabetical'
);
select is((select count(*)::int from public.vehicle_models), 3, 'a visitor can read models');
select throws_ok(
  $$update public.vehicle_models set combined_l_per_100km = 1$$, '42501', null, 'a visitor cannot edit models'
);
reset role;

select has_index('public', 'vehicle_models', 'vehicle_models_year_make_idx', 'index for year → make lookups');

select * from finish();
rollback;
