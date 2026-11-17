-- Statistics consent, version 2026-11-16: the text now says the aggregated
-- statistics may be sold or shared with third parties.
--
-- Under Loi 25 a consent only covers the purposes announced when it was given.
-- A "yes" to the earlier text (no version recorded, no mention of a sale) must
-- not count for a sale. From now on:
--   - the app records the text version with every statistics decision
--     (STATISTICS_VERSION in src/features/account/consents.ts);
--   - only users whose LATEST statistics decision is a "yes" to a text that
--     announces the sale are counted in the analytics views.
-- Users who said yes before are asked again (new terms version, then the
-- settings switch shows the new text); until they say yes again, they're out.
--
-- A later text that still announces the sale: add its version to the list
-- below in a new migration, and to STATISTICS_VERSION in the app.

create or replace view analytics.contributors as
select user_id
  from (
    select distinct on (user_id) user_id, granted, document_version
      from public.consents
     where kind = 'statistics'
     order by user_id, created_at desc, id desc
  ) as latest
 where granted
   and document_version in ('2026-11-16');

-- Same rights as before: never granted to anyone (it lists user ids); the
-- aggregated views read it with their owner's rights.
revoke all on analytics.contributors from public, anon, authenticated, service_role, analytics_reader;
