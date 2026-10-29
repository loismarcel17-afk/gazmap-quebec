-- Trips ("J'y vais") of signed-in users: which station, which fuel, the price at
-- departure, when, and how it ended. Used for the user's history and, later, the
-- after-fill-up feedback (PLAN.md task 12).
--
-- No GPS position is stored, ever: the start point and the drive stay on the phone.

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  station_id text not null references public.stations (id),
  fuel text not null check (fuel in ('regular', 'premium', 'diesel')),
  -- Station price for that fuel when the trip started, tenths of a cent / L.
  -- Set by the database (trigger below), never trusted from the browser.
  price_at_start integer check (price_at_start between 500 and 5000),
  -- guidance: in-site turn-by-turn; external: opened in Waze / Google Maps / Plans.
  mode text not null check (mode in ('guidance', 'external')),
  status text not null default 'started' check (status in ('started', 'arrived', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint ended_when_finished check ((status = 'started') = (ended_at is null))
);

comment on table public.trips is
  'Trips started by signed-in users. No position is stored. Deleted with the account.';

create index trips_user_started_idx on public.trips (user_id, started_at desc);

-- Price at departure: read from the station, whatever the client sends ---------

create function public.set_trip_price()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select case new.fuel
           when 'regular' then s.price_regular
           when 'premium' then s.price_premium
           else s.price_diesel
         end
    into new.price_at_start
    from public.stations as s
   where s.id = new.station_id;
  return new;
end;
$$;

create trigger trips_set_price
  before insert on public.trips
  for each row execute function public.set_trip_price();

-- Has the signed-in user accepted the terms (latest decision = granted)? -------
-- Any version: re-accepting a new version is enforced by the app before use.

create function public.has_granted_terms()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select granted from public.consents
      where user_id = (select auth.uid()) and kind = 'terms'
      order by created_at desc, id desc
      limit 1),
    false
  );
$$;

grant execute on function public.has_granted_terms() to authenticated;
revoke execute on function public.has_granted_terms() from public, anon;

-- Access ---------------------------------------------------------------------------

alter table public.trips enable row level security;

create policy "Users read their own trips"
  on public.trips for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Recording trips requires an account that accepted the terms.
create policy "Users record their own trips"
  on public.trips for insert
  to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_granted_terms()));

-- Only ending a trip in progress: arrived or cancelled.
create policy "Users end their own trips"
  on public.trips for update
  to authenticated
  using (user_id = (select auth.uid()) and status = 'started')
  with check (user_id = (select auth.uid()) and status in ('arrived', 'cancelled'));

-- Right to erasure (Loi 25): a user can clear their history.
create policy "Users delete their own trips"
  on public.trips for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.trips from anon;
revoke truncate on public.trips from authenticated;
-- Column-level: an update may only touch status and ended_at (not the station,
-- the price or the dates of the trip).
revoke update on public.trips from authenticated;
grant update (status, ended_at) on public.trips to authenticated;
