-- pgTAP tests for public.trips.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com');

insert into public.stations (id, address, region, postal_code, lat, lng, price_regular, price_premium, prices_updated_at)
values ('station-test', '1 rue A, Québec', 'Capitale-Nationale', 'G1R 1A1', 46.81, -71.21, 1859, 2109, now());

-- Alice and Bob accepted the terms; Carol never did.
insert into public.consents (user_id, kind, granted, document_version) values
  ('11111111-1111-1111-1111-111111111111', 'terms', true, '2026-10-28'),
  ('22222222-2222-2222-2222-222222222222', 'terms', true, '2026-10-28');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

-- Starting a trip -----------------------------------------------------------------

select throws_ok(
  $$insert into public.trips (station_id, fuel, mode, price_at_start) values ('station-test', 'premium', 'guidance', 999)$$,
  '42501', null, 'the client can''t even send a price at departure'
);
create temp table started (id uuid);
with t as (
  insert into public.trips (station_id, fuel, mode) values ('station-test', 'premium', 'guidance') returning id
) insert into started select id from t;
select is(
  (select price_at_start from public.trips where id = (select id from started)), 2109,
  'the price at departure comes from the station'
);
select is(
  (select user_id from public.trips where id = (select id from started)),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the trip belongs to the signed-in user'
);
select throws_ok(
  $$insert into public.trips (station_id, fuel, mode) values ('station-test', 'e85', 'guidance')$$,
  '23514', null, 'unknown fuels are rejected'
);
select throws_ok(
  $$insert into public.trips (user_id, station_id, fuel, mode)
    values ('22222222-2222-2222-2222-222222222222', 'station-test', 'regular', 'guidance')$$,
  '42501', null, 'nobody records a trip for someone else'
);

-- Ending it ---------------------------------------------------------------------------

select lives_ok(
  $$update public.trips set status = 'arrived' where id = (select id from started)$$,
  'the user marks the trip as arrived'
);
select ok(
  (select ended_at between now() - interval '1 second' and now() from public.trips where id = (select id from started)),
  'the end time is the database''s clock'
);
select is(
  (select status from public.trips where id = (select id from started)), 'arrived', 'status saved'
);
select is_empty(
  $$update public.trips set status = 'cancelled' where id = (select id from started) returning id$$,
  'a finished trip cannot be changed again'
);
select throws_ok(
  $$update public.trips set station_id = 'other' where id = (select id from started)$$,
  '42501', null, 'the station of a trip cannot be changed'
);
select throws_ok(
  $$update public.trips set price_at_start = 1000$$,
  '42501', null, 'nor its price'
);
select throws_ok(
  $$insert into public.trips (station_id, fuel, mode, status) values ('station-test', 'regular', 'external', 'arrived')$$,
  '42501', null, 'a trip can''t be recorded as already finished'
);
select throws_ok(
  $$insert into public.trips (station_id, fuel, mode, started_at) values ('station-test', 'regular', 'external', now() - interval '20 days')$$,
  '42501', null, 'nor backdated'
);
select throws_ok(
  $$update public.trips set ended_at = now() - interval '20 days'$$,
  '42501', null, 'nor its end time rewritten'
);

-- At most 30 trips a day.
insert into public.trips (station_id, fuel, mode) select 'station-test', 'regular', 'external' from generate_series(1, 29);
select throws_ok(
  $$insert into public.trips (station_id, fuel, mode) values ('station-test', 'regular', 'external')$$,
  '42501', null, 'the 31st trip of the day is refused'
);

-- Isolation, terms, erasure -----------------------------------------------------------

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.trips), 0, 'another user sees none of them');

select pg_temp.act_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$insert into public.trips (station_id, fuel, mode) values ('station-test', 'regular', 'guidance')$$,
  '42501', null, 'no trip is recorded without accepting the terms'
);

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
delete from public.trips;
select is((select count(*)::int from public.trips), 0, 'a user can clear their history');

reset role;
set local role anon;
select throws_ok($$select * from public.trips$$, '42501', null, 'visitors without account see nothing');
reset role;

select * from finish();
rollback;
