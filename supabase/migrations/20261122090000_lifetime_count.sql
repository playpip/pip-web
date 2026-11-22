-- The number of live lifetime members, readable with the publishable key, so
-- the CMO's weekly export can split them out (cmo#175) without a database
-- credential in CI. Built exactly like user_count(); read that file first.
--
-- Same rules: one integer, no arguments, `search_path = ''`, `stable`. Do not
-- add a parameter or a column: a `since` argument becomes a purchase-timing
-- oracle, and anything more becomes a buyer list.
--
-- A refund leaves `lifetime` true and sets status `refunded` (stripe-webhook),
-- so the count is of active rows only.
--
-- The trade-off, said plainly: anyone who has loaded the site can read how
-- many lifetime memberships are live, and so roughly what they have earned.

create or replace function public.lifetime_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from public.memberships where lifetime and status = 'active';
$$;

revoke execute on function public.lifetime_count() from public;
grant execute on function public.lifetime_count() to anon, authenticated;
