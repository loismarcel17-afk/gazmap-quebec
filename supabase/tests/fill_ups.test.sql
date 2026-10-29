-- pgTAP tests for public.fill_ups (after-fill-up feedback).
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');
insert into public.consents (user_id, kind, granted, document_version) values
  ('11111111-1111-1111-1111-111111111111', 'terms', true, '2026-10-28'),
  ('22222222-2222-2222-2222-222222222222', 'terms', true, '2026-10-28');
insert into public.stations (id, address, region, postal_code, lat, lng, price_regular, price_premium, prices_updated_at)
values ('station-test', '1 rue A, Québec', 'Capitale-Nationale', 'G1R 1A1', 46.81, -71.21, 1859, 2109, now());

-- Alice: a trip 1 h ago (to answer), one 13 h ago (too old), one cancelled 30 min ago.
insert into public.trips (id, user_id, station_id, fuel, mode, status, started_at, ended_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'station-test', 'regular', 'guidance', 'arrived', now() - interval '1 hour', now() - interval '50 minutes'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'station-test', 'regular', 'external', 'started', now() - interval '13 hours', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'station-test', 'premium', 'guidance', 'cancelled', now() - interval '30 minutes', now() - interval '25 minutes');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

-- The prompt at the next visit ------------------------------------------------------

select results_eq(
  $$select trip_id from public.pending_fill_up_trip()$$,
  $$values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid)$$,
  'the pending trip: < 12 h, not cancelled, not answered yet'
);

-- Answering ----------------------------------------------------------------------------

select lives_ok(
  $$insert into public.fill_ups (trip_id, filled, fuel, price_paid)
    values ('aaaaaaaa-0000-0000-0000-000000000001', true, 'regular', 1849)$$,
  'the user confirms the fuel and the price paid'
);
select results_eq(
  $$select price_paid, price_displayed from public.fill_ups$$,
  $$values (1849, 1859)$$,
  'the displayed price is recorded next to the paid one, by the database'
);
select is_empty($$select * from public.pending_fill_up_trip()$$, 'answered: no more prompt');
select throws_ok(
  $$insert into public.fill_ups (trip_id, filled) values ('aaaaaaaa-0000-0000-0000-000000000001', false)$$,
  '23505', null, 'one answer per trip'
);
select throws_ok(
  $$update public.fill_ups set price_paid = 1500$$, '42501', null, 'an answer cannot be edited afterwards'
);

-- Rules ----------------------------------------------------------------------------------

select throws_ok(
  $$insert into public.fill_ups (trip_id, filled) values ('aaaaaaaa-0000-0000-0000-000000000002', false)$$,
  '42501', null, 'too late: more than 12 h after leaving'
);
select throws_ok(
  $$insert into public.fill_ups (trip_id, filled, fuel) values ('aaaaaaaa-0000-0000-0000-000000000003', true, 'premium')$$,
  '23514', null, '"yes" needs the price paid'
);
select throws_ok(
  $$insert into public.fill_ups (trip_id, filled, fuel, price_paid) values ('aaaaaaaa-0000-0000-0000-000000000003', false, 'premium', 2000)$$,
  '23514', null, '"no" carries no fuel or price'
);
select throws_ok(
  $$insert into public.fill_ups (trip_id, filled, fuel, price_paid) values ('aaaaaaaa-0000-0000-0000-000000000003', true, 'premium', 21090)$$,
  '23514', null, 'an absurd price is rejected'
);
select throws_ok(
  $$insert into public.fill_ups (trip_id, filled, created_at) values ('aaaaaaaa-0000-0000-0000-000000000003', false, now() - interval '20 days')$$,
  '42501', null, 'an answer can''t be backdated (it would land in another month of the statistics)'
);
select lives_ok(
  $$insert into public.fill_ups (trip_id, filled) values ('aaaaaaaa-0000-0000-0000-000000000003', false)$$,
  '"no, not this time" is a valid answer'
);

-- Isolation ----------------------------------------------------------------------------

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.fill_ups), 0, 'another user sees none of the answers');
select throws_ok(
  $$insert into public.fill_ups (trip_id, filled) values ('aaaaaaaa-0000-0000-0000-000000000001', false)$$,
  '42501', null, 'nobody answers for someone else''s trip'
);

reset role;
set local role anon;
select throws_ok($$select * from public.fill_ups$$, '42501', null, 'visitors without account see nothing');
reset role;

select * from finish();
rollback;
