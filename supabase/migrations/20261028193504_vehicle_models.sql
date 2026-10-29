-- Vehicle models and their fuel consumption, from NRCan's "Fuel consumption ratings".
-- Source: Natural Resources Canada, Open Government Licence – Canada (attribution required).
-- Loaded by the import-nrcan Edge Function. Reference data: readable by everyone.

create table public.vehicle_models (
  id bigint generated always as identity primary key,
  model_year smallint not null check (model_year between 1990 and 2100),
  make text not null,
  model text not null,
  vehicle_class text not null,
  engine_l numeric(3, 1) not null,
  cylinders smallint not null,
  transmission text not null,
  -- NRCan codes kept as-is: X regular, Z premium, D diesel (E85 / natural gas not imported).
  fuel_type char(1) not null check (fuel_type in ('X', 'Z', 'D')),
  city_l_per_100km numeric(4, 1) not null check (city_l_per_100km > 0),
  highway_l_per_100km numeric(4, 1) not null check (highway_l_per_100km > 0),
  combined_l_per_100km numeric(4, 1) not null check (combined_l_per_100km > 0),
  -- What identifies a variant in NRCan's files (checked unique on 11 374 rows).
  unique (model_year, make, model, engine_l, cylinders, transmission, fuel_type)
);

comment on table public.vehicle_models is
  'NRCan fuel consumption ratings. Source: Natural Resources Canada, Open Government Licence – Canada.';

-- Picking a car goes year → make → model: index that path.
create index vehicle_models_year_make_idx on public.vehicle_models (model_year, make);

alter table public.vehicle_models enable row level security;

create policy "Vehicle models are readable by everyone"
  on public.vehicle_models for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.vehicle_models from anon, authenticated;

-- Menus: the API (PostgREST) has no SELECT DISTINCT, so two tiny functions. -------

create function public.vehicle_model_years()
returns setof smallint
language sql stable security invoker set search_path = ''
as $$
  select distinct model_year from public.vehicle_models order by model_year desc;
$$;

create function public.vehicle_makes(p_year smallint)
returns setof text
language sql stable security invoker set search_path = ''
as $$
  select distinct make from public.vehicle_models where model_year = p_year order by make;
$$;

grant execute on function public.vehicle_model_years() to anon, authenticated;
grant execute on function public.vehicle_makes(smallint) to anon, authenticated;

-- Import ------------------------------------------------------------------------
-- Upsert on the natural key: re-importing updates ratings in place and keeps ids.
-- Rows that disappear from NRCan's files are kept: someone may have picked them.

create function public.import_nrcan_models(p_models jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.vehicle_models (
    model_year, make, model, vehicle_class, engine_l, cylinders, transmission, fuel_type,
    city_l_per_100km, highway_l_per_100km, combined_l_per_100km
  )
  select m.model_year, m.make, m.model, m.vehicle_class, m.engine_l, m.cylinders, m.transmission,
         m.fuel_type, m.city_l_per_100km, m.highway_l_per_100km, m.combined_l_per_100km
  from jsonb_to_recordset(p_models) as m(
    model_year smallint, make text, model text, vehicle_class text, engine_l numeric, cylinders smallint,
    transmission text, fuel_type char(1), city_l_per_100km numeric, highway_l_per_100km numeric,
    combined_l_per_100km numeric
  )
  on conflict (model_year, make, model, engine_l, cylinders, transmission, fuel_type) do update set
    vehicle_class = excluded.vehicle_class,
    city_l_per_100km = excluded.city_l_per_100km,
    highway_l_per_100km = excluded.highway_l_per_100km,
    combined_l_per_100km = excluded.combined_l_per_100km;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.import_nrcan_models(jsonb) from public, anon, authenticated;
grant execute on function public.import_nrcan_models(jsonb) to service_role;
