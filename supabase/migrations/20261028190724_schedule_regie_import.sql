-- Run the import-regie Edge Function every 15 minutes.
--
-- pg_cron schedules SQL inside Postgres; pg_net lets that SQL make HTTP requests.
-- The function URL and the service_role key are read from Vault (encrypted
-- secrets), never written in a migration:
--   - local: supabase/seed.sql creates them with the local demo values;
--   - hosted project: create them once in the dashboard (Vault) or with
--     select vault.create_secret('<value>', 'project_url' | 'service_role_key');
-- Without them the job runs but its request fails, harmlessly.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'import-regie',
  -- Every 15 minutes. The Régie republishes about once an hour, and the ETag
  -- check makes unchanged checks almost free for both sides.
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/import-regie',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
