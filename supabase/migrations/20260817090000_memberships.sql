-- Entitlement. One row per member, written by nothing the client can reach.
--
-- Applied with `supabase db push`, never by hand in the dashboard, same as the
-- profiles migration next to it: a schema change that only exists in a
-- dashboard is a change nobody reviewed. Idempotent, so re-running is safe.
--
-- **This table is the whole reason a membership can exist at all.** `profiles`
-- is written by the client under an `own row only` policy, so anything stored
-- in `profiles.state` can be set by editing localStorage and syncing it. A
-- `member: true` in the profile blob is not a weak lock, it is no lock. Read
-- that as the design point rather than a preference: got wrong, it cannot be
-- fixed without a migration and a support incident.

create table if not exists public.memberships (
  user_id                uuid primary key references auth.users on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  -- Stripe's own subscription.status, stored raw. Deliberately not mapped to a
  -- boolean here: `past_due` and `unpaid` are different problems and the app
  -- wants to be able to tell them apart. What counts as entitled is decided in
  -- one place on the client, src/lib/membership/entitlement.ts.
  status                 text not null,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  price_id               text,
  updated_at             timestamptz not null default now()
);

alter table public.memberships enable row level security;

-- Read your own row. That is the ONLY policy on this table, on purpose.
--
-- There is deliberately no insert, update or delete policy for `anon` or
-- `authenticated`: the Stripe webhook writes this table with the service role,
-- which bypasses RLS, and nothing else ever writes it. If a later migration
-- "fixes" the missing policies, entitlement becomes client-writable and the
-- membership is free. tests/entitlement.test.ts fails the build on that.
drop policy if exists "read own membership" on public.memberships;
create policy "read own membership" on public.memberships
  for select using (auth.uid() = user_id);

-- `on delete cascade` keeps the existing delete path honest: delete_own_account()
-- deletes from auth.users, so the membership row goes with it.
--
-- **Deleting the account does not cancel the Stripe subscription**, and that is
-- a live gap rather than an accepted one. It cannot be closed here because
-- there is no Stripe account yet; it is closed in the same edge function that
-- receives the webhook, and nothing may take a payment until it is. See
-- technology#52 item B.
