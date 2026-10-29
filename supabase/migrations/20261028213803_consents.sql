-- Consents (Loi 25): two separate consents, each timestamped and withdrawable.
--   terms       — terms of use; required to have an account.
--   statistics  — "contribute anonymously to statistics"; OFF by default, can be
--                 withdrawn anytime in the settings.
--
-- An append-only log: every grant or withdrawal is a NEW row, never an update.
-- The current state is the latest row per kind; the history is the proof of who
-- agreed to what, when, and to which version of the terms. Rows go away only with
-- the account itself (on delete cascade, PLAN.md task 13).

create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('terms', 'statistics')),
  granted boolean not null,
  -- Version of the document agreed to (terms); null for statistics.
  document_version text,
  created_at timestamptz not null default now(),
  -- Terms can only be accepted with a version: we must know which text was accepted.
  constraint terms_need_a_version check (kind <> 'terms' or document_version is not null)
);

comment on table public.consents is
  'Append-only consent log (Loi 25). Current state = latest row per (user_id, kind).';

create index consents_user_kind_idx on public.consents (user_id, kind, created_at desc);

alter table public.consents enable row level security;

-- Each user reads and adds their own rows; `(select auth.uid())` is evaluated once
-- per query instead of once per row (Supabase's recommended RLS pattern).
create policy "Users read their own consents"
  on public.consents for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users record their own consents"
  on public.consents for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- No update or delete policy, and no privilege either: history can't be rewritten.
revoke update, delete, truncate on public.consents from anon, authenticated;
revoke all on public.consents from anon;

-- Current state ------------------------------------------------------------------

-- Latest row per kind for the signed-in user (RLS applies: security invoker).
create view public.my_consents
with (security_invoker = true)
as
select distinct on (kind) kind, granted, document_version, created_at
from public.consents
where user_id = (select auth.uid())
order by kind, created_at desc, id desc;

grant select on public.my_consents to authenticated;
revoke all on public.my_consents from anon;

-- For other tables' RLS later (trips, feedback): has the user accepted these terms?
create function public.has_accepted_terms(p_version text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select granted and document_version = p_version
       from public.consents
      where user_id = (select auth.uid()) and kind = 'terms'
      order by created_at desc, id desc
      limit 1),
    false
  );
$$;

grant execute on function public.has_accepted_terms(text) to authenticated;
revoke execute on function public.has_accepted_terms(text) from public, anon;
