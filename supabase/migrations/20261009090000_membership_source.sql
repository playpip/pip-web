-- Where a membership was bought: on the web through Stripe, or in the iOS or
-- Android app through the store (EXPO-PLAN.md, phase 2).
--
-- One row per member still, and still written only with the service role:
-- `stripe-webhook` for Stripe, `revenuecat-webhook` for the stores. No policy
-- changes here, on purpose (see 20260817090000_memberships.sql): the client may
-- read its own row and nothing more.
--
-- The app reads `source` to send a member to the right place to manage it: the
-- Stripe portal for a web membership, the App Store or Google Play for one
-- bought in the app. Refunds and cancellations for store memberships happen in
-- the store, never in Stripe.

alter table public.memberships
  add column if not exists source text not null default 'stripe';

alter table public.memberships
  drop constraint if exists memberships_source_check;
alter table public.memberships
  add constraint memberships_source_check
  check (source in ('stripe', 'app_store', 'play_store'));
