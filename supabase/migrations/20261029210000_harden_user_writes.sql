-- Security review: what a signed-in user writes through the API.
--
-- Until now the browser could send any column of its own rows, including the
-- dates. Someone calling the API by hand could:
--   - date a "statistics: yes" in 2030, so their later withdrawal is never the
--     latest decision (and the consent log, our Loi 25 proof, says what they want);
--   - record trips and fill-ups at any date, already "arrived", as many as they
--     like, and move the averages in the analytics views on their own.
--
-- Now:
--   1. users may send only the columns the app sends; ids, owners, dates and
--      statuses come from the database (column privileges);
--   2. at most 30 trips per user per 24 h (nobody fills up 30 times a day);
--   3. in the analytics views each person weighs the same, however many rows
--      they add: one person can't move a cell by more than 1/20.

-- 1. Columns the browser may write --------------------------------------------------

revoke insert on public.consents from authenticated;
grant insert (kind, granted, document_version) on public.consents to authenticated;

revoke insert on public.trips from authenticated;
grant insert (station_id, fuel, mode) on public.trips to authenticated;

-- Ending a trip: only the status; the end time is the database's clock.
revoke update on public.trips from authenticated;
grant update (status) on public.trips to authenticated;

create function public.set_trip_ended_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.ended_at := case when new.status = 'started' then null else now() end;
  end if;
  return new;
end;
$$;

create trigger trips_set_ended_at
  before update on public.trips
  for each row execute function public.set_trip_ended_at();

revoke insert on public.fill_ups from authenticated;
grant insert (trip_id, filled, fuel, price_paid) on public.fill_ups to authenticated;

-- 2. At most 30 trips a day per user ------------------------------------------------

create function public.can_start_trip()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*) < 30
    from public.trips
   where user_id = (select auth.uid())
     and started_at > now() - interval '24 hours';
$$;

grant execute on function public.can_start_trip() to authenticated;
revoke execute on function public.can_start_trip() from public, anon;

drop policy "Users record their own trips" on public.trips;
create policy "Users record their own trips"
  on public.trips for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.has_granted_terms())
    and (select public.can_start_trip())
  );

-- 3. One person, one weight in the analytics ----------------------------------------
-- Each user's rows are first summed up per cell, then averaged across users.
-- Same columns as before (fill_ups and trips still count rows).

create or replace view analytics.fill_up_prices as
with per_user as (
  select
    s.region,
    analytics.month_of(f.created_at) as month,
    f.fuel,
    f.user_id,
    count(*) as fill_ups,
    avg(f.price_paid) as price_paid,
    avg(f.price_paid - f.price_displayed) as gap,
    avg((abs(f.price_paid - f.price_displayed) <= 10)::integer) as within_1_cent
  from public.fill_ups as f
  join analytics.contributors as c on c.user_id = f.user_id
  join public.trips as t on t.id = f.trip_id
  join public.stations as s on s.id = t.station_id
  where f.filled
    and analytics.month_of(f.created_at) < analytics.month_of(now())
  group by s.region, analytics.month_of(f.created_at), f.fuel, f.user_id
)
select
  region,
  month,
  fuel,
  count(*)::integer as contributors,
  sum(fill_ups)::integer as fill_ups,
  round(avg(price_paid))::integer as avg_price_paid,
  round(avg(gap))::integer as avg_gap_vs_displayed,
  round(avg(within_1_cent), 2) as share_within_1_cent
from per_user
group by region, month, fuel
having count(*) >= 20;

create or replace view analytics.trip_activity as
with per_user as (
  select
    s.region,
    analytics.month_of(t.started_at) as month,
    t.user_id,
    count(*) as trips,
    avg((t.mode = 'guidance')::integer) as guidance,
    avg((t.status = 'cancelled')::integer) as cancelled,
    avg(f.filled::integer) as filled
  from public.trips as t
  join analytics.contributors as c on c.user_id = t.user_id
  join public.stations as s on s.id = t.station_id
  left join public.fill_ups as f on f.trip_id = t.id
  where analytics.month_of(t.started_at) < analytics.month_of(now())
  group by s.region, analytics.month_of(t.started_at), t.user_id
)
select
  region,
  month,
  count(*)::integer as contributors,
  sum(trips)::integer as trips,
  round(avg(guidance), 2) as share_guidance,
  round(avg(cancelled), 2) as share_cancelled,
  -- Among users with answered trips; avg skips users who never answered.
  round(avg(filled), 2) as share_filled
from per_user
group by region, month
having count(*) >= 20;

-- Housekeeping: my_consents is read-only (DISTINCT ON makes it non-updatable
-- anyway), so it shouldn't carry the default write privileges either.
revoke insert, update, delete, truncate on public.my_consents from authenticated;
