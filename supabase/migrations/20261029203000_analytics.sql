-- Aggregated statistics, the only data that may ever be sold or shared (CLAUDE.md,
-- Loi 25). A separate schema, out of the API (supabase/config.toml exposes only
-- public), readable only by the analytics_reader role, which sees only the
-- aggregated views below: never a user id, a trip or an answer.
--
-- Rules, enforced here rather than by whoever runs an export:
-- - only users whose latest "statistics" consent is granted are counted; a
--   withdrawal or a deleted account removes their data from every figure;
-- - a cell (region × month) is shown only if it has at least 20 distinct users;
-- - only finished months: a cell can't be watched filling up one answer at a time.
--
-- Known limit: the views are computed live, so comparing two reads of a past
-- month before and after a withdrawal could isolate that user's share. Sell or
-- share a frozen copy taken once the month is closed, never repeated live reads.

create schema analytics;
comment on schema analytics is
  'Aggregated statistics only (>= 20 distinct users per region × month). No individual rows.';

revoke all on schema analytics from public;

-- The role an export or a buyer's access uses. No login: a real user or key is
-- granted this role when the time comes.
do $$
begin
  if not exists (select from pg_roles where rolname = 'analytics_reader') then
    create role analytics_reader nologin;
  end if;
end;
$$;
grant usage on schema analytics to analytics_reader;
-- The database owner may act as the reader (`set role analytics_reader`) to run
-- an export: it then sees exactly what a buyer would, nothing more.
grant analytics_reader to postgres with set true, inherit false;

-- Who may be counted: latest statistics consent is granted. Lists user ids, so
-- it's never granted to anyone; the views read it with their owner's rights.
create view analytics.contributors as
select user_id
  from (
    select distinct on (user_id) user_id, granted
      from public.consents
     where kind = 'statistics'
     order by user_id, created_at desc, id desc
  ) as latest
 where granted;

-- Month in Québec time. (Functions in a view run with the reader's rights:
-- analytics_reader gets execute on it below.)
create function analytics.month_of(p_at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('month', p_at at time zone 'America/Montreal')::date;
$$;

-- Prices paid vs prices published, per region, month and fuel ----------------------

create view analytics.fill_up_prices as
select
  s.region,
  analytics.month_of(f.created_at) as month,
  f.fuel,
  count(distinct f.user_id)::integer as contributors,
  count(*)::integer as fill_ups,
  -- Tenths of a cent / L, like everywhere else.
  round(avg(f.price_paid))::integer as avg_price_paid,
  -- Paid minus displayed: positive = the pump was dearer than the Régie said.
  round(avg(f.price_paid - f.price_displayed))::integer as avg_gap_vs_displayed,
  -- Share of answers within 1 ¢/L of the displayed price.
  round(avg((abs(f.price_paid - f.price_displayed) <= 10)::integer), 2) as share_within_1_cent
from public.fill_ups as f
join analytics.contributors as c on c.user_id = f.user_id
join public.trips as t on t.id = f.trip_id
join public.stations as s on s.id = t.station_id
where f.filled
  and analytics.month_of(f.created_at) < analytics.month_of(now())
group by s.region, analytics.month_of(f.created_at), f.fuel
having count(distinct f.user_id) >= 20;

comment on view analytics.fill_up_prices is
  'Prices confirmed by consenting users, per region × month × fuel; cells under 20 users hidden.';

-- Trips and how they end, per region and month -------------------------------------

create view analytics.trip_activity as
select
  s.region,
  analytics.month_of(t.started_at) as month,
  count(distinct t.user_id)::integer as contributors,
  count(*)::integer as trips,
  round(avg((t.mode = 'guidance')::integer), 2) as share_guidance,
  round(avg((t.status = 'cancelled')::integer), 2) as share_cancelled,
  -- Among answered trips, how many ended with a fill-up.
  round(avg(f.filled::integer), 2) as share_filled
from public.trips as t
join analytics.contributors as c on c.user_id = t.user_id
join public.stations as s on s.id = t.station_id
left join public.fill_ups as f on f.trip_id = t.id
where analytics.month_of(t.started_at) < analytics.month_of(now())
group by s.region, analytics.month_of(t.started_at)
having count(distinct t.user_id) >= 20;

comment on view analytics.trip_activity is
  'Trips of consenting users, per region × month; cells under 20 users hidden.';

-- Access: the aggregated views and nothing else ---------------------------------

revoke all on all tables in schema analytics from public, anon, authenticated, service_role;
revoke all on all functions in schema analytics from public, anon, authenticated, service_role;
grant select on analytics.fill_up_prices, analytics.trip_activity to analytics_reader;
grant execute on function analytics.month_of(timestamptz) to analytics_reader;
