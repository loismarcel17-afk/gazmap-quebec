-- pgTAP tests for the analytics schema: only aggregates, only consenting users,
-- only cells of 20 distinct users or more, only finished months.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- Last month (finished) and this month (in progress), in Québec time.
create temp table months as
select (date_trunc('month', now() at time zone 'America/Montreal') - interval '1 month') at time zone 'America/Montreal' + interval '10 days' as last_month,
       now() as this_month;
grant select on months to analytics_reader;
-- pgTAP itself lives in `extensions` (rolled back with the rest).
grant usage on schema extensions to analytics_reader;

insert into public.stations (id, address, region, postal_code, lat, lng, price_regular, prices_updated_at) values
  ('st-estrie', '1 rue A, Sherbrooke', 'Estrie', 'J1H 1A1', 45.40, -71.89, 1800, now()),
  ('st-outaouais', '1 rue B, Gatineau', 'Outaouais', 'J8X 1A1', 45.48, -75.70, 1800, now());

-- 30 users: 1–20 consent to statistics, 21–25 only accepted the terms,
-- 26–30 consented then withdrew.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'user' || n || '@example.com'
  from generate_series(1, 30) as n;
insert into public.consents (user_id, kind, granted, document_version, created_at)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, kind, true,
       case kind when 'terms' then '2026-10-28' end, now() - interval '90 days'
  from generate_series(1, 30) as n, unnest(array['terms', 'statistics']) as kind
 where kind = 'terms' or n <= 20 or n > 25;
insert into public.consents (user_id, kind, granted, created_at)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'statistics', false, now() - interval '1 day'
  from generate_series(26, 30) as n;

-- Estrie, last month: one trip + fill-up per user (all 30). Paid 1810 vs 1800 shown,
-- except the non-consenting ones who "paid" 3000 (must not move the average).
insert into public.trips (id, user_id, station_id, fuel, mode, status, started_at, ended_at)
select ('aaaaaaaa-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'st-estrie', 'regular', case when n <= 5 then 'guidance' else 'external' end, 'arrived',
       (select last_month from months), (select last_month from months)
  from generate_series(1, 30) as n;
insert into public.fill_ups (user_id, trip_id, filled, fuel, price_paid, created_at)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       ('aaaaaaaa-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       true, 'regular', case when n <= 20 then 1810 else 3000 end, (select last_month from months)
  from generate_series(1, 30) as n;

-- Outaouais, last month: 19 consenting users only (one short of the threshold).
insert into public.trips (user_id, station_id, fuel, mode, status, started_at, ended_at)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'st-outaouais', 'regular', 'external', 'arrived', (select last_month from months), (select last_month from months)
  from generate_series(1, 19) as n;

-- Estrie, this month: 20 consenting users, but the month isn't over.
insert into public.trips (user_id, station_id, fuel, mode, status, started_at, ended_at)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'st-estrie', 'regular', 'external', 'arrived', (select this_month from months), (select this_month from months)
  from generate_series(1, 20) as n;

-- Who can see what ------------------------------------------------------------------

select ok(
  not has_schema_privilege('anon', 'analytics', 'usage')
  and not has_schema_privilege('authenticated', 'analytics', 'usage'),
  'visitors and signed-in users can''t even enter the analytics schema'
);
select ok(
  not has_schema_privilege('service_role', 'analytics', 'usage'),
  'nor can the service_role key used by server code'
);
select ok(
  not has_table_privilege('analytics_reader', 'analytics.contributors', 'select')
  and not has_table_privilege('analytics_reader', 'public.fill_ups', 'select')
  and not has_table_privilege('analytics_reader', 'public.trips', 'select'),
  'the reader can''t list contributors nor read user tables'
);

set local role analytics_reader;

select throws_ok(
  $$select user_id from analytics.contributors$$, '42501', null,
  'reading the list of contributors is refused'
);

-- Figures -------------------------------------------------------------------------

select results_eq(
  $$select region, contributors, fill_ups, avg_price_paid, avg_gap_vs_displayed, share_within_1_cent
      from analytics.fill_up_prices$$,
  $$values ('Estrie'::text, 20, 20, 1810, 10, 1.00::numeric)$$,
  'only the 20 consenting users count: no terms-only user, no withdrawn consent'
);
select is(
  (select month from analytics.fill_up_prices),
  (select (date_trunc('month', last_month at time zone 'America/Montreal'))::date from months),
  'cells are labelled with their month (Québec time)'
);
select results_eq(
  $$select region, contributors, trips, share_guidance, share_filled from analytics.trip_activity$$,
  $$values ('Estrie'::text, 20, 20, 0.25::numeric, 1.00::numeric)$$,
  'trip activity: Outaouais (19 users) and the current month are hidden'
);
select ok(
  not exists (select 1 from analytics.trip_activity where region = 'Outaouais'),
  '19 distinct users is not enough'
);

-- The threshold counts people, not rows: 40 trips by 19 users stay hidden.
reset role;
insert into public.trips (user_id, station_id, fuel, mode, status, started_at, ended_at)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'st-outaouais', 'regular', 'external', 'arrived', (select last_month from months), (select last_month from months)
  from generate_series(1, 19) as n, generate_series(1, 2);
set local role analytics_reader;
select ok(
  not exists (select 1 from analytics.trip_activity where region = 'Outaouais'),
  'many trips by few users stay hidden: the threshold is distinct users'
);

-- One person, one weight: user 3 adds 50 fill-ups at 50 $/L in Estrie.
reset role;
insert into public.trips (id, user_id, station_id, fuel, mode, status, started_at, ended_at)
select ('bbbbbbbb-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, '00000000-0000-0000-0000-000000000003',
       'st-estrie', 'regular', 'external', 'arrived', (select last_month from months), (select last_month from months)
  from generate_series(1, 50) as n;
insert into public.fill_ups (user_id, trip_id, filled, fuel, price_paid, created_at)
select '00000000-0000-0000-0000-000000000003', ('bbbbbbbb-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       true, 'regular', 5000, (select last_month from months)
  from generate_series(1, 50) as n;
set local role analytics_reader;
select results_eq(
  $$select contributors, fill_ups, avg_price_paid from analytics.fill_up_prices$$,
  -- User 3 averages (1810 + 50 × 5000) / 51 ≈ 4937; the cell: (19 × 1810 + 4937) / 20 ≈ 1966.
  $$values (20, 70, 1966)$$,
  'one person adding rows moves the average by their share only (1/20), not by their row count'
);

-- A withdrawal takes effect immediately -----------------------------------------------

reset role;
insert into public.consents (user_id, kind, granted)
values ('00000000-0000-0000-0000-000000000001', 'statistics', false);
set local role analytics_reader;
select is_empty(
  $$select 1 from analytics.fill_up_prices$$,
  'one withdrawal brings Estrie under 20: the cell disappears'
);

-- So does a deleted account.
reset role;
insert into public.consents (user_id, kind, granted)
values ('00000000-0000-0000-0000-000000000001', 'statistics', true);
delete from auth.users where id = '00000000-0000-0000-0000-000000000002';
set local role analytics_reader;
select is_empty(
  $$select 1 from analytics.trip_activity$$,
  'a deleted account leaves the figures too'
);

select * from finish();
rollback;
