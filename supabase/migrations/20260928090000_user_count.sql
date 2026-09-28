-- The number of accounts, readable with the publishable key, so the CMO's
-- weekly export can pull it without a database credential in CI.
--
-- Why this exists: the Supabase user count was the last manual read in
-- cmo/data/exports.md. cto#101 kept it out of the runner because the only
-- routes to it (a service-role key, a management token, a Postgres password)
-- are credentials that can do far more than count, and one integer was not
-- worth that. This function is the narrow route: the anon client can learn how
-- many rows `auth.users` has and nothing else.
--
-- Treat this as security-sensitive, same as delete_own_account. The properties
-- that make it safe are deliberate:
--
--   * **It returns one integer and takes no arguments.** No email, no id, no
--     timestamp, no filter. Do not add a parameter or a column to it: a
--     `user_count(since timestamptz)` becomes a signup-timing oracle, and
--     anything more becomes a user list.
--   * **`search_path = ''`** so nothing in the body can be shadowed. Every
--     reference is qualified.
--   * **`stable`**, so it can never be used to write.
--
-- The trade-off, said plainly: anyone holding the publishable key (which is
-- anyone who has loaded the site) can read the total. That is the price of not
-- putting a real credential in CI, and it was judged worth paying for a number
-- this coarse.

create or replace function public.user_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from auth.users;
$$;

revoke execute on function public.user_count() from public;
grant execute on function public.user_count() to anon, authenticated;
