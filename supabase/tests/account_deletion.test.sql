-- pgTAP tests for account deletion and the daily purge.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Alice (will delete her account), Bob (stays), Carol (never accepted the terms,
-- 31 days ago), Dave (same, but only 2 days ago).
insert into auth.users (id, email, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', now() - interval '60 days'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', now() - interval '60 days'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com', now() - interval '31 days'),
  ('44444444-4444-4444-4444-444444444444', 'dave@example.com', now() - interval '2 days');
insert into public.consents (user_id, kind, granted, document_version) values
  ('11111111-1111-1111-1111-111111111111', 'terms', true, '2026-10-28'),
  ('11111111-1111-1111-1111-111111111111', 'statistics', true, '2026-10-28'),
  ('22222222-2222-2222-2222-222222222222', 'terms', true, '2026-10-28');
insert into public.stations (id, address, region, postal_code, lat, lng, price_regular, prices_updated_at)
values ('station-test', '1 rue A, Québec', 'Capitale-Nationale', 'G1R 1A1', 46.81, -71.21, 1859, now());
insert into public.trips (id, user_id, station_id, fuel, mode, status, ended_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'station-test', 'regular', 'guidance', 'arrived', now()),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'station-test', 'regular', 'external', 'arrived', now());
insert into public.fill_ups (user_id, trip_id, filled, fuel, price_paid) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', true, 'regular', 1849);
-- Supabase Auth's sign-in log keeps the e-mail: it must go too.
insert into auth.audit_log_entries (id, payload) values
  (gen_random_uuid(), '{"action":"login","actor_id":"11111111-1111-1111-1111-111111111111","actor_username":"alice@example.com"}'),
  (gen_random_uuid(), '{"action":"login","actor_id":"22222222-2222-2222-2222-222222222222","actor_username":"bob@example.com"}'),
  (gen_random_uuid(), '{"action":"login","actor_id":"99999999-9999-9999-9999-999999999999","actor_username":"gone@example.com"}');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- Who may call what ---------------------------------------------------------------

set local role anon;
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'visitors cannot call the deletion');
reset role;

set local role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$select public.purge_abandoned_accounts()$$, '42501', null, 'users cannot run the purge'
);

-- Alice deletes her account ---------------------------------------------------------

select lives_ok($$select public.delete_my_account()$$, 'a signed-in user deletes their account');
reset role;

select is_empty($$select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111'$$, 'the account (and e-mail) is gone');
select is_empty($$select 1 from public.consents where user_id = '11111111-1111-1111-1111-111111111111'$$, 'her consents are gone');
select is_empty($$select 1 from public.trips where user_id = '11111111-1111-1111-1111-111111111111'$$, 'her trips are gone');
select is_empty($$select 1 from public.fill_ups where user_id = '11111111-1111-1111-1111-111111111111'$$, 'her answers are gone');
select is_empty(
  $$select 1 from auth.audit_log_entries where payload ->> 'actor_id' = '11111111-1111-1111-1111-111111111111'$$,
  'her sign-in log entries are gone'
);
select results_eq(
  $$select (select count(*) from public.trips)::int, (select count(*) from public.consents)::int$$,
  $$values (1, 1)$$,
  'Bob''s data is untouched'
);

-- Without a session, nothing is deleted ---------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '', true);
select throws_ok($$select public.delete_my_account()$$, '42501', 'not signed in', 'no session: refused');
reset role;

-- The daily purge (as the scheduler) ------------------------------------------------

select results_eq(
  $$select accounts from public.purge_abandoned_accounts()$$,
  $$values (1)$$,
  'purge: Carol (31 days, terms never accepted) is erased'
);
select results_eq(
  $$select payload ->> 'actor_username' from auth.audit_log_entries$$,
  $$values ('bob@example.com')$$,
  'purge: log entries of deleted accounts are erased, those of current accounts kept'
);
select results_eq(
  $$select email::text from auth.users order by email$$,
  $$values ('bob@example.com'), ('dave@example.com')$$,
  'Bob (terms accepted) and Dave (only 2 days) are kept'
);
select isnt_empty($$select 1 from cron.job where jobname = 'purge-abandoned-accounts'$$, 'the purge runs daily');

select * from finish();
rollback;
