-- The schedule for `send-emails`. Run by hand, once, in the Supabase SQL editor,
-- AFTER the function is deployed and its secrets are set (docs/email.md).
--
-- Not a migration, on purpose: it needs pg_cron and pg_net switched on, which a
-- migration must not assume, and it needs the cron secret, which must never be
-- committed. The secret goes into Supabase Vault (step 1) and the job reads it
-- from there each time it runs, so it never appears in cron.job either.
--
-- Hourly is deliberate. The function decides what is due from the hour it
-- runs in (reminders from 18:00 UTC, the summary from 09:00 UTC on Mondays,
-- welcomes whenever), and it claims each player's day before sending, so a
-- missed or doubled run neither skips anybody for good nor emails anybody twice.

-- 0. Switch on the two extensions (Dashboard → Database → Extensions does the
--    same). Harmless if they are already on.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Store the secret. Use the same value you gave `supabase secrets set
--    CRON_SECRET=...`. Run this line once, with the real value, and do not save
--    the edited file.
-- select vault.create_secret('<the CRON_SECRET value>', 'pip_cron_secret');

-- 2. Schedule it. Replace <project-ref> with the project's ref (the subdomain
--    of NEXT_PUBLIC_SUPABASE_URL). Guarded so it does nothing, loudly, if either
--    extension is missing rather than failing half-way.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_cron and pg_net must both be enabled first; nothing scheduled.';
    return;
  end if;

  -- Re-running replaces the job rather than adding a second one.
  perform cron.unschedule(jobid) from cron.job where jobname = 'pip-send-emails';

  perform cron.schedule(
    'pip-send-emails',
    '5 * * * *',
    $job$
      select net.http_post(
        url     := 'https://<project-ref>.supabase.co/functions/v1/send-emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pip_cron_secret')
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $job$
  );
end;
$$;

-- To check it ran:   select * from cron.job_run_details order by start_time desc limit 10;
-- What it answered:  select * from net._http_response order by created desc limit 10;
-- To stop it:        select cron.unschedule('pip-send-emails');
