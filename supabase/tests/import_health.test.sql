-- pgTAP tests for public.import_health() (monitoring of the Régie import).
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

delete from public.import_runs;
insert into public.import_runs (started_at, status, error) values
  (now() - interval '30 minutes', 'imported', null),
  (now() - interval '15 minutes', 'not_modified', null),
  (now(), 'failed', 'secret detail: HTTP 500 from the Régie');

set local role anon;
select results_eq(
  $$select last_status, last_ok_at between now() - interval '16 minutes' and now() - interval '14 minutes'
      from public.import_health()$$,
  $$values ('failed'::text, true)$$,
  'visitors see the last status and the last good run (a 304 counts as good)'
);
select throws_ok(
  $$select error from public.import_runs$$, '42501', null,
  'visitors still cannot read import_runs itself: error messages stay private'
);
reset role;

delete from public.import_runs;
set local role anon;
select results_eq(
  $$select last_run_at, last_ok_at from public.import_health()$$,
  $$values (null::timestamptz, null::timestamptz)$$,
  'no run yet: no times (the monitor treats it as down)'
);
reset role;

select * from finish();
rollback;
