-- Is the price import alive? Read by /api/sante, which an uptime monitor polls
-- to e-mail the team when prices stop updating.
--
-- import_runs stays closed to the public (it holds error messages); this
-- function exposes only times and the last status, nothing else.

create function public.import_health()
returns table (
  last_run_at timestamptz,
  last_status text,
  -- Last run that did its job: new prices, unchanged feed (304) or an older feed skipped.
  last_ok_at timestamptz,
  -- Time of the newest Régie publication among the stations.
  prices_published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select started_at from public.import_runs order by id desc limit 1),
    (select status from public.import_runs order by id desc limit 1),
    (select max(started_at) from public.import_runs where status <> 'failed'),
    (select max(prices_updated_at) from public.stations);
$$;

comment on function public.import_health() is
  'Liveness of the Régie import, for monitoring: times and last status only.';

grant execute on function public.import_health() to anon, authenticated;
