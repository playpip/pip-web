-- Suggested friends (docs/social.md → Suggested).
--
-- Will, 2026-11-22: recommend people to add, starting with him as the creator
-- of Pip. Two sources, in this order:
--
--   featured_players  a short list kept by hand, each with a label ("Made Pip").
--                     Shown to everybody who isn't already connected to them.
--   friends of friends, by how many friends you share, and only people who
--                     appear in search.
--
-- Nobody already your friend, asked either way, blocked either way, flagged or
-- yourself. Written like the rest of 20261122180000_social.sql.

create table if not exists public.featured_players (
  user_id uuid primary key references auth.users on delete cascade,
  label text not null check (char_length(label) between 1 and 24),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

-- Kept by hand with the service role. No policies: no client reads or writes it,
-- and a featured player's label reaches a client only through the functions below.
alter table public.featured_players enable row level security;

insert into public.featured_players (user_id, label, sort)
select user_id, 'Made Pip', 0 from public.player_profiles where handle = 'willlamerton'
on conflict (user_id) do nothing;

create or replace function public.suggested_players()
returns table (handle text, display_name text, avatar jsonb, ring text, reason text)
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
  select p.handle, p.display_name, p.avatar, p.ring, (array_agg(pk.reason order by pk.tier))[1]
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

revoke all on function public.suggested_players() from public, anon;
grant execute on function public.suggested_players() to authenticated;

-- A featured player's label on their profile card.
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
  label text;
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
  select fp.label into label from public.featured_players fp where fp.user_id = p.user_id;
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
    'featured', label
  );
end;
$$;
