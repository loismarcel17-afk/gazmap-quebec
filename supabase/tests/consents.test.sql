-- pgTAP tests for public.consents (Loi 25).
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- Two users. Supabase's RLS reads the user id from the request's JWT claims,
-- which we fake with set_config('request.jwt.claims', …).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

-- Recording -------------------------------------------------------------------------

select lives_ok(
  $$insert into public.consents (kind, granted, document_version) values ('terms', true, '2026-10-28')$$,
  'a user records accepting the terms'
);
select is(
  (select user_id from public.consents limit 1), '11111111-1111-1111-1111-111111111111'::uuid,
  'user_id defaults to the signed-in user'
);
select throws_ok(
  $$insert into public.consents (kind, granted) values ('terms', true)$$,
  '23514', null, 'accepting terms requires the version accepted'
);
select throws_ok(
  $$insert into public.consents (kind, granted) values ('marketing', true)$$,
  '23514', null, 'only the two known consents exist'
);
select throws_ok(
  $$insert into public.consents (user_id, kind, granted) values ('22222222-2222-2222-2222-222222222222', 'statistics', true)$$,
  '42501', null, 'a user cannot record consent for someone else'
);

-- Statistics: granted, then withdrawn → current state is "withdrawn", history keeps both.
insert into public.consents (kind, granted) values ('statistics', true);
insert into public.consents (kind, granted) values ('statistics', false);

select results_eq(
  $$select kind, granted from public.my_consents order by kind$$,
  $$values ('statistics', false), ('terms', true)$$,
  'my_consents shows the latest state of each consent'
);
select is((select count(*)::int from public.consents where kind = 'statistics'), 2, 'the history is kept');

select ok(public.has_accepted_terms('2026-10-28'), 'has accepted the current terms');
select ok(not public.has_accepted_terms('2027-01-01'), 'has not accepted a newer version');

-- History can't be rewritten -------------------------------------------------------

select throws_ok($$update public.consents set granted = true$$, '42501', null, 'consents cannot be edited');
select throws_ok($$delete from public.consents$$, '42501', null, 'consents cannot be deleted by the user');
select throws_ok(
  $$insert into public.consents (kind, granted, created_at) values ('statistics', true, '2030-01-01')$$,
  '42501', null, 'a consent can''t be dated by the user (a "yes" in 2030 would outlive any withdrawal)'
);

-- Isolation between users ------------------------------------------------------------

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.consents), 0, 'another user sees none of them');
select ok(not public.has_accepted_terms('2026-10-28'), 'and has accepted nothing');

reset role;
set local role anon;
select throws_ok($$select * from public.consents$$, '42501', null, 'a visitor without account sees nothing');
reset role;

select * from finish();
rollback;
