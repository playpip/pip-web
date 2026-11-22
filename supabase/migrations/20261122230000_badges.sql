-- Badges on profiles (Will, 2026-11-22; docs/social.md → Badges).
--
-- Given by hand, by handle, with the service role:
--   team         Team Pip
--   verified     Verified
--   high-roller  High roller
-- And one that follows the membership on its own:
--   member       Member, while the membership is live, unless the player
--                switched it off in Your profile (`show_member`).
--
-- To give one:
--   insert into player_badges (user_id, badge)
--   select user_id, 'verified' from player_profiles where handle = '…';
--
-- Shown on the profile card, and as a small mark by the name in lists and on
-- the leaderboard. Labels and icons live in src/lib/social/badges.ts.

create table if not exists public.player_badges (
  user_id uuid not null references auth.users on delete cascade,
  badge text not null check (badge in ('team', 'verified', 'high-roller')),
  granted_at timestamptz not null default now(),
  primary key (user_id, badge)
);

-- Kept by hand. No policies: badges reach a client only through the functions below.
alter table public.player_badges enable row level security;

alter table public.player_profiles add column if not exists show_member boolean not null default true;

insert into public.player_badges (user_id, badge)
select user_id, 'team' from public.player_profiles where handle = 'willlamerton'
on conflict do nothing;

-- "Made Pip" became Team Pip (Will, 2026-11-22): the Suggested label follows.
update public.featured_players set label = 'Team Pip' where label = 'Made Pip';

-- A player's badges, in the order they are shown.
create or replace function public.pip_badges(u uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(b order by o), '{}')
  from (
    select pb.badge as b,
      case pb.badge when 'team' then 0 when 'verified' then 1 else 2 end as o
    from public.player_badges pb where pb.user_id = u
    union all
    select 'member', 3
    from public.memberships m
    join public.player_profiles p on p.user_id = m.user_id
    where m.user_id = u
      and p.show_member
      and m.status in ('active', 'trialing')
      and (m.lifetime or m.current_period_end > now())
  ) x;
$$;

revoke all on function public.pip_badges(uuid) from public, anon, authenticated;

-- Your own choice: show the Member badge or not.
create or replace function public.set_member_badge(p_show boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.player_profiles set show_member = coalesce(p_show, true)
  where user_id = public.social_me();
$$;

revoke all on function public.set_member_badge(boolean) from public, anon;
grant execute on function public.set_member_badge(boolean) to authenticated;

-- The handles and badges behind leaderboard rows, so a row can open its profile.
-- Blocked either way or flagged: left out.
create or replace function public.handles_for(p_users uuid[])
returns table (user_id uuid, handle text, badges text[])
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.handle, public.pip_badges(p.user_id)
  from public.player_profiles p
  where p.user_id = any (p_users[1:200])
    and not p.flagged
    and not public.social_blocked(public.social_me(), p.user_id);
$$;

revoke all on function public.handles_for(uuid[]) from public, anon;
grant execute on function public.handles_for(uuid[]) to authenticated;

-- The lists, again, with badges. A function's columns can't change in place.
drop function if exists public.search_players(text);
create function public.search_players(p_query text)
returns table (handle text, display_name text, avatar jsonb, ring text, relation text, badges text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  q text := lower(trim(coalesce(p_query, '')));
begin
  q := ltrim(q, '@');
  if char_length(q) < 2 then
    return;
  end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select p.handle, p.display_name, p.avatar, p.ring, public.social_relation(me, p.user_id),
      public.pip_badges(p.user_id)
    from public.player_profiles p
    where p.user_id <> me
      and not p.flagged
      and (p.handle like q || '%' or lower(p.display_name) like q || '%')
      and (p.searchable or public.social_relation(me, p.user_id) = 'friends')
      and not public.social_blocked(me, p.user_id)
    order by (p.handle = q) desc, (p.handle like q || '%') desc, char_length(p.handle), p.handle
    limit 20;
end;
$$;

drop function if exists public.my_friends();
create function public.my_friends()
returns table (
  handle text, display_name text, avatar jsonb, ring text, status text, since timestamptz,
  badges text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.handle, p.display_name, p.avatar, p.ring,
    case when f.status = 'friends' then 'friends'
         when f.requested_by = public.social_me() then 'sent'
         else 'received' end,
    coalesce(f.accepted_at, f.created_at),
    public.pip_badges(p.user_id)
  from public.friendships f
  join public.player_profiles p
    on p.user_id = case when f.user_a = public.social_me() then f.user_b else f.user_a end
  where public.social_me() in (f.user_a, f.user_b)
    and not p.flagged
    and not public.social_blocked(public.social_me(), p.user_id)
  order by f.status, lower(p.display_name);
$$;

drop function if exists public.suggested_players();
create function public.suggested_players()
returns table (handle text, display_name text, avatar jsonb, ring text, reason text, badges text[])
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select public.social_me() as id),
  mine as (
    select case when f.user_a = me.id then f.user_b else f.user_a end as friend
    from public.friendships f, me
    where me.id in (f.user_a, f.user_b) and f.status = 'friends'
  ),
  linked as (
    select case when f.user_a = me.id then f.user_b else f.user_a end as other
    from public.friendships f, me
    where me.id in (f.user_a, f.user_b)
  ),
  featured as (
    select fp.user_id, fp.label as reason, 0 as tier, fp.sort as rank
    from public.featured_players fp
  ),
  mutual as (
    select
      case when f.user_a = m.friend then f.user_b else f.user_a end as user_id,
      count(*) as shared
    from public.friendships f
    join mine m on m.friend in (f.user_a, f.user_b)
    where f.status = 'friends'
    group by 1
  ),
  picks as (
    select user_id, reason, tier, rank from featured
    union all
    select user_id,
      case when shared = 1 then '1 mutual friend' else shared || ' mutual friends' end,
      1, -shared::integer
    from mutual
  )
  -- A featured player's label wins over a mutual-friends count.
  select p.handle, p.display_name, p.avatar, p.ring, (array_agg(pk.reason order by pk.tier))[1],
    public.pip_badges(p.user_id)
  from picks pk
  join public.player_profiles p on p.user_id = pk.user_id
  cross join me
  where p.user_id <> me.id
    and not p.flagged
    and (pk.tier = 0 or p.searchable)
    and p.user_id not in (select other from linked)
    and not public.social_blocked(me.id, p.user_id)
  group by p.user_id, p.handle, p.display_name, p.avatar, p.ring
  order by min(pk.tier), min(pk.rank), p.handle
  limit 12;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['search_players(text)', 'my_friends()', 'suggested_players()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;

-- The profile card, with badges. Same as before otherwise.
create or replace function public.get_player(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  p public.player_profiles;
  r public.ratings;
  rel text;
  since timestamptz;
begin
  select * into p from public.player_profiles where handle = lower(trim(ltrim(p_handle, '@')));
  if p.user_id is null or (p.user_id <> me and (p.flagged or public.social_blocked(me, p.user_id))) then
    return null;
  end if;
  rel := public.social_relation(me, p.user_id);
  select accepted_at into since from public.friendships
  where user_a = least(me, p.user_id) and user_b = greatest(me, p.user_id) and status = 'friends';
  if 'rating' = any (p.shown) then
    select * into r from public.ratings where user_id = p.user_id and not hidden and not flagged;
  end if;
  return jsonb_build_object(
    'handle', p.handle,
    'name', p.display_name,
    'avatar', p.avatar,
    'ring', p.ring,
    'bio', p.bio,
    'shown', to_jsonb(p.shown),
    'card', p.card,
    'rating', case when r.user_id is null then null
      else jsonb_build_object('rating', r.rating, 'peak', r.peak, 'decisions', r.rated_decisions) end,
    'relation', rel,
    'friendsSince', since,
    'searchable', p.searchable,
    'badges', to_jsonb(public.pip_badges(p.user_id))
  );
end;
$$;
