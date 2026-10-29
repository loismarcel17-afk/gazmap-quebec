-- After-fill-up feedback: did the user fill up on this trip, which fuel, what price.
-- One answer per trip, within 12 hours of leaving (CLAUDE.md). Confirmed prices
-- feed aggregated statistics later (PLAN.md task 17), only for users who consented.

create table public.fill_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null unique references public.trips (id) on delete cascade,
  filled boolean not null,
  fuel text check (fuel in ('regular', 'premium', 'diesel')),
  -- What the user says they paid, tenths of a cent / L.
  price_paid integer check (price_paid between 500 and 5000),
  -- What the Régie showed for that fuel when they answered (trigger below):
  -- comparing both tells how reliable the published prices are.
  price_displayed integer,
  created_at timestamptz not null default now(),
  -- "Yes" needs the fuel and the price; "no" must not carry them.
  constraint answer_is_complete check (
    (filled and fuel is not null and price_paid is not null)
    or (not filled and fuel is null and price_paid is null)
  )
);

comment on table public.fill_ups is
  'After-fill-up answers, one per trip. Deleted with the trip or the account.';

-- Station price at answer time, read by the database (never from the browser).
create function public.set_fill_up_displayed_price()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.fuel is not null then
    select case new.fuel
             when 'regular' then s.price_regular
             when 'premium' then s.price_premium
             else s.price_diesel
           end
      into new.price_displayed
      from public.trips as t
      join public.stations as s on s.id = t.station_id
     where t.id = new.trip_id;
  else
    new.price_displayed := null;
  end if;
  return new;
end;
$$;

create trigger fill_ups_set_displayed_price
  before insert on public.fill_ups
  for each row execute function public.set_fill_up_displayed_price();

-- Can the signed-in user still answer for this trip? Theirs, < 12 h old.
create function public.can_answer_trip(p_trip_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.trips
     where id = p_trip_id
       and user_id = (select auth.uid())
       and started_at > now() - interval '12 hours'
  );
$$;

grant execute on function public.can_answer_trip(uuid) to authenticated;
revoke execute on function public.can_answer_trip(uuid) from public, anon;

alter table public.fill_ups enable row level security;

create policy "Users read their own answers"
  on public.fill_ups for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users answer for their own recent trips"
  on public.fill_ups for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.has_granted_terms())
    and public.can_answer_trip(trip_id)
  );

-- Answers are final (no update); they go away with the trip or the account.
revoke all on public.fill_ups from anon;
revoke update, delete, truncate on public.fill_ups from authenticated;

-- The trip waiting for an answer, for the "Avez-vous fait le plein chez X ?" prompt
-- at the next visit: the latest trip of the last 12 hours without an answer
-- (cancelled ones excluded: the user stopped on purpose).
create function public.pending_fill_up_trip()
returns table (trip_id uuid, station_id text, fuel text, started_at timestamptz, brand text, name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.station_id, t.fuel, t.started_at, s.brand, s.name
    from public.trips as t
    join public.stations as s on s.id = t.station_id
   where t.user_id = (select auth.uid())
     and t.started_at > now() - interval '12 hours'
     and t.status <> 'cancelled'
     and not exists (select 1 from public.fill_ups as f where f.trip_id = t.id)
   order by t.started_at desc
   limit 1;
$$;

grant execute on function public.pending_fill_up_trip() to authenticated;
revoke execute on function public.pending_fill_up_trip() from public, anon;
