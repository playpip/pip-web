-- Opt-in email. One row per player who has touched an email switch.
--
-- Applied with `supabase db push`, never by hand in the dashboard, same as every
-- migration next to it. Idempotent, so re-running is safe. See docs/email.md.
--
-- What the row means: the two switches are the player's own choice, written by
-- the client under the policies below. Everything else on it (the
-- `last_sent_*` stamps, the snapshot the weekly summary subtracts from, the
-- unsubscribe token) belongs to the `send-emails` and `unsubscribe` Edge
-- Functions, which write with the service role. The column grants at the foot
-- of this file are what stop a player writing those columns through RLS.
--
-- No row, or a row with both switches off, means Pip sends that player nothing.

create table if not exists public.email_prefs (
  user_id            uuid primary key references auth.users on delete cascade,
  -- "Weekly summary" in Settings. Off until the player turns it on.
  weekly_digest      boolean not null default false,
  -- "Email me when my Daily streak is about to end". Off until turned on.
  daily_reminder     boolean not null default false,
  -- The secret in every unsubscribe link. Random, never derived from the user
  -- id, so a link cannot be made for somebody else's account.
  unsubscribe_token  uuid not null default gen_random_uuid() unique,
  -- When each kind last went out. The sender claims a day by setting these
  -- before it sends, which is what makes a re-run on the same day a no-op.
  last_sent_welcome  timestamptz,
  last_sent_reminder timestamptz,
  last_sent_digest   timestamptz,
  -- The profile's Roll and lifetime counters at the last summary or welcome,
  -- so the next summary can say what changed. Numbers the profile already
  -- holds, copied, nothing new.
  digest_snapshot    jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.email_prefs enable row level security;

-- Read, create and change your own row. No delete policy: turning both
-- switches off is how a player stops email, and deleting the account takes the
-- row with it (the cascade above). Same `auth.uid() = user_id` shape as
-- profiles; tests/rlsPolicy.test.ts checks every policy names the caller.
drop policy if exists "read own email prefs" on public.email_prefs;
create policy "read own email prefs" on public.email_prefs
  for select using (auth.uid() = user_id);

drop policy if exists "create own email prefs" on public.email_prefs;
create policy "create own email prefs" on public.email_prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists "change own email prefs" on public.email_prefs;
create policy "change own email prefs" on public.email_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RLS decides which row; these decide which columns. Supabase grants every
-- column of a new public table to anon and authenticated by default, and with
-- that a player could reset their own `last_sent_*` and be emailed twice, or
-- write a snapshot that makes the summary say something untrue. So writes are
-- narrowed to the switches. `user_id` is in the update list only because a
-- PostgREST upsert sets every column it was sent; the policy's `with check`
-- still pins it to the caller.
revoke all on public.email_prefs from anon;
revoke insert, update, delete on public.email_prefs from authenticated;
grant insert (user_id, weekly_digest, daily_reminder) on public.email_prefs to authenticated;
grant update (user_id, weekly_digest, daily_reminder) on public.email_prefs to authenticated;

-- `updated_at` moves on every write without the client sending it.
create or replace function public.email_prefs_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists email_prefs_touch on public.email_prefs;
create trigger email_prefs_touch
  before update on public.email_prefs
  for each row execute function public.email_prefs_touch();

-- The sender's daily scan: rows with a switch on.
create index if not exists email_prefs_opted_in
  on public.email_prefs (user_id)
  where weekly_digest or daily_reminder;

-- The schedule is not in this file. It holds a secret and needs pg_cron and
-- pg_net switched on first, so it is run by hand from supabase/cron/send-emails.sql
-- once the functions are deployed (docs/email.md).
