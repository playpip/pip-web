-- A lifetime membership (cmo#252, 2026-11-19): one payment on the web, a
-- member for as long as Pip runs.
--
-- The row is an ordinary live one — status `active`, a paid-until date far in
-- the future, no subscription — so every reader of this table (the site, the
-- app, the rooms server, the emails) already treats it as a member. This flag
-- is what says *why*: the webhooks read it so a late event about an old
-- subscription or a store purchase never overwrites it, and the site reads it
-- to say "Lifetime" where a monthly member sees a renewal date.
--
-- Written only by `stripe-webhook`, with the service role, like every other
-- column here. No policy changes (see 20260817090000_memberships.sql).

alter table public.memberships
  add column if not exists lifetime boolean not null default false;
