-- Local development seed, replayed by `npx supabase db reset` after the migrations.
-- Stations are not seeded here: run `npm run db:import` (or wait for the
-- 15-minute pg_cron job) to load them from the Régie feed.

-- Secrets for the import-regie cron job (see the schedule_regie_import migration).
-- These are the LOCAL values only: host.docker.internal is how the database
-- container reaches the API on your Mac, and the key is the well-known demo
-- service_role key that every local Supabase uses (not a real secret). A hosted
-- project gets its own values through the dashboard, never through this file.
select vault.create_secret('http://host.docker.internal:54321', 'project_url');
select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  'service_role_key'
);
