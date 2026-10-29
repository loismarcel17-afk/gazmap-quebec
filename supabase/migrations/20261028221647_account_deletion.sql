-- Self-service account deletion (Loi 25) and the daily purge.
--
-- Deleting the auth.users row is enough for our own tables: consents, trips and
-- fill_ups all reference it "on delete cascade" (and fill_ups also cascade from
-- trips). Supabase's own auth tables (sessions, refresh tokens, identities,
-- one-time codes) cascade the same way.
--
-- One thing does NOT cascade: auth.audit_log_entries, Supabase Auth's log of
-- sign-ins, which keeps the e-mail address in its payload. We erase it too.
--
-- Positions: none are stored (see the trips migration), so the "30-day purge of
-- raw positions" from PLAN.md has nothing to purge. The daily job below purges
-- what does linger instead: accounts that never accepted the terms (an e-mail
-- typed, a code received, then nothing) and log entries of deleted accounts.

-- Delete my account, right now --------------------------------------------------

-- security definer: runs with the owner's rights (postgres), because users can't
-- touch auth.users themselves. It only ever deletes the caller (auth.uid()).
create function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.audit_log_entries where payload ->> 'actor_id' = me::text;
  delete from auth.users where id = me; -- cascades to consents, trips, fill_ups
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the signed-in user and all their personal data (cascade), including auth log entries.';

grant execute on function public.delete_my_account() to authenticated;
revoke execute on function public.delete_my_account() from public, anon;

-- Daily purge -------------------------------------------------------------------

-- How long an account may stay without the terms accepted before it is erased.
-- Same 30 days as the retention promise in the privacy policy.
create function public.purge_abandoned_accounts(p_older_than interval default interval '30 days')
returns table (accounts integer, log_entries integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from auth.users u
   where u.created_at < now() - p_older_than
     and not exists (
       select 1 from public.consents c
        where c.user_id = u.id and c.kind = 'terms' and c.granted
     );
  get diagnostics accounts = row_count;

  -- Log entries whose account no longer exists (deleted here, by the user, or
  -- from the dashboard).
  delete from auth.audit_log_entries a
   where not exists (select 1 from auth.users u where u.id::text = a.payload ->> 'actor_id');
  get diagnostics log_entries = row_count;

  return next;
end;
$$;

comment on function public.purge_abandoned_accounts(interval) is
  'Erases accounts that never accepted the terms (older than p_older_than) and auth log entries of deleted accounts. Run daily by pg_cron.';

-- Only the scheduler (postgres) runs it: no one from the API.
revoke execute on function public.purge_abandoned_accounts(interval) from public, anon, authenticated;

select cron.schedule(
  'purge-abandoned-accounts',
  -- Every day at 07:30 UTC (03:30 in Québec), when hardly anyone is signing in.
  '30 7 * * *',
  $$ select public.purge_abandoned_accounts(); $$
);
