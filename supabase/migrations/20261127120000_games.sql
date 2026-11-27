-- Your games: every session you play, kept on the account so it can go back on
-- the felt from your profile, and from anybody else's (Will, 2026-11-27,
-- docs/games.md). Replaces "one session, and the next one replaces it".
--
--   games        one row per session: a solo table from sit-down to stand-up,
--                or one multiplayer game. What the list shows.
--   game_hands   the hands, one row each, as the review's `ReviewHand`
--                ({ record, decisions }, src/lib/review/session.ts).
--   rating_inbox rated decisions from hands the room server dealt, waiting for
--                `submit-rating` to count them (docs/rating.md).
--
-- Solo sessions are sent by the player's own device (`save_game`); the AI
-- seats' cards are face up in them, as in the review. Multiplayer games are
-- written by the room server with the service role (`record_room_hands`), one
-- copy per person at the table, each holding only the cards that person saw.
--
-- Reading: your own rows directly (RLS); anybody else's only through
-- `player_games` and `get_game`, and only when their profile shows "games",
-- they are not flagged, and nobody has blocked anybody.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- The device's or the room's own name for the session, so a resend is one row.
  key text not null check (char_length(key) between 1 and 80),
  kind text not null check (kind in ('cash', 'tournament', 'private', 'open', 'slow')),
  venue_id text not null check (char_length(venue_id) between 1 and 40),
  title text not null check (char_length(title) between 1 and 80),
  accent text not null check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  started_at timestamptz not null,
  -- Null while it is still being played.
  ended_at timestamptz,
  -- `SessionOutcome` in src/lib/review/session.ts.
  outcome jsonb check (outcome is null or pg_column_size(outcome) <= 256),
  hands integer not null default 0,
  -- Chips across the hands kept, from each hand's `heroDelta`.
  net bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create index if not exists games_by_player on public.games (user_id, started_at desc);

create table if not exists public.game_hands (
  game_id uuid not null references public.games on delete cascade,
  hand_no integer not null check (hand_no >= 0),
  hand jsonb not null check (pg_column_size(hand) <= 32768),
  primary key (game_id, hand_no)
);

create table if not exists public.rating_inbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  -- When the hand finished, ms since the epoch, as `SubmittedHand.at`.
  at bigint not null,
  decisions jsonb not null check (pg_column_size(decisions) <= 2048),
  created_at timestamptz not null default now()
);

create index if not exists rating_inbox_by_player on public.rating_inbox (user_id, at);

alter table public.games enable row level security;
alter table public.game_hands enable row level security;
-- No policies: only the room server and `submit-rating` touch it.
alter table public.rating_inbox enable row level security;

create policy "your own games"
  on public.games for select
  using (auth.uid() = user_id);

create policy "your own games' hands"
  on public.game_hands for select
  using (exists (select 1 from public.games g where g.id = game_id and g.user_id = auth.uid()));

grant select on public.games, public.game_hands to authenticated;
revoke all on public.games, public.game_hands, public.rating_inbox from anon;
revoke all on public.rating_inbox from authenticated;

-- Profiles show games unless the player turns it off (Will, 2026-11-27).
-- Not switched on for anybody who keeps out of search: they chose to be hard to find.
alter table public.player_profiles alter column shown set default '{rating,games}';
update public.player_profiles set shown = array_append(shown, 'games')
where searchable and not ('games' = any (shown));

-- And a profile made for a new account shows them too (as 20261122220000_default_profiles.sql,
-- with games added). A player hidden from the leaderboard still starts showing nothing.
create or replace function public.ensure_player_profile(p_name text, p_avatar jsonb, p_ring text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  hidden boolean;
  n text := public.pip_clean_name(p_name);
begin
  if exists (select 1 from public.player_profiles where user_id = me) then
    return;
  end if;
  if p_avatar is not null and (jsonb_typeof(p_avatar) <> 'object' or pg_column_size(p_avatar) > 2048) then
    p_avatar := null;
  end if;
  select r.hidden into hidden from public.ratings r where r.user_id = me;
  insert into public.player_profiles (user_id, handle, display_name, avatar, ring, shown, searchable)
  values (
    me,
    public.pip_free_handle(n),
    n,
    p_avatar,
    left(p_ring, 40),
    case when coalesce(hidden, false) then '{}'::text[] else '{rating,games}'::text[] end,
    not coalesce(hidden, false)
  )
  on conflict (user_id) do nothing;
exception
  -- Two tabs claiming the same handle at once: the second just tries again later.
  when unique_violation then
    return;
end;
$$;

revoke all on function public.ensure_player_profile(text, jsonb, text) from public, anon;
grant execute on function public.ensure_player_profile(text, jsonb, text) to authenticated;

-- Write one session and any new hands for player `u`. Keeps 400 hands a game
-- and the newest 300 games a player; the oldest go.
create or replace function public.games_put(u uuid, p_game jsonb, p_hands jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
  h jsonb;
  kept integer;
begin
  if jsonb_typeof(p_hands) is distinct from 'array' or jsonb_array_length(p_hands) > 100 then
    raise exception 'bad-hands';
  end if;
  insert into public.games as g
    (user_id, key, kind, venue_id, title, accent, started_at, ended_at, outcome)
  values (
    u,
    p_game->>'key',
    p_game->>'kind',
    p_game->>'venueId',
    p_game->>'title',
    p_game->>'accent',
    to_timestamp((p_game->>'startedAt')::double precision / 1000),
    case when p_game ? 'endedAt' and p_game->>'endedAt' is not null
      then to_timestamp((p_game->>'endedAt')::double precision / 1000) end,
    case when jsonb_typeof(p_game->'outcome') = 'object' then p_game->'outcome' end
  )
  on conflict (user_id, key) do update set
    -- The first ending counts, as `endReviewSession` has it.
    ended_at = coalesce(g.ended_at, excluded.ended_at),
    outcome = coalesce(g.outcome, excluded.outcome),
    updated_at = now()
  returning id into gid;

  select count(*) into kept from public.game_hands where game_id = gid;
  for h in select * from jsonb_array_elements(p_hands) loop
    exit when kept >= 400;
    if jsonb_typeof(h->'record') = 'object' and jsonb_typeof(h->'decisions') = 'array'
      and (h->'record'->>'handNo') ~ '^\d{1,9}$' then
      insert into public.game_hands (game_id, hand_no, hand)
      values (gid, (h->'record'->>'handNo')::integer, h)
      on conflict do nothing;
      if found then kept := kept + 1; end if;
    end if;
  end loop;

  update public.games set
    hands = kept,
    net = coalesce((
      select sum(case when (gh.hand->'record'->>'heroDelta') ~ '^-?\d{1,15}$'
        then (gh.hand->'record'->>'heroDelta')::bigint else 0 end)
      from public.game_hands gh where gh.game_id = gid
    ), 0)
  where id = gid;

  -- Keep the newest 300 games.
  delete from public.games
  where user_id = u and id in (
    select id from public.games where user_id = u order by started_at desc offset 300
  );
  return gid;
end;
$$;

revoke all on function public.games_put(uuid, jsonb, jsonb) from public, anon, authenticated;

-- A solo session from the player's own device: the session's details and up
-- to 100 new hands. Sent again with more hands as it is played.
create or replace function public.save_game(p_game jsonb, p_hands jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
begin
  if p_game->>'kind' not in ('cash', 'tournament') then
    raise exception 'bad-kind';
  end if;
  return public.games_put(me, p_game, p_hands);
end;
$$;

-- One finished multiplayer hand, written by the room server: one entry per
-- person at the table, `{ user, game, hand, rated }`, `rated` being the
-- hand's `SubmittedHand` or null.
create or replace function public.record_room_hands(p_seats jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s jsonb;
  u uuid;
begin
  for s in select * from jsonb_array_elements(p_seats) loop
    u := (s->>'user')::uuid;
    if s->'game'->>'kind' not in ('private', 'open', 'slow') then
      continue;
    end if;
    perform public.games_put(
      u,
      s->'game',
      case when jsonb_typeof(s->'hand') = 'object' then jsonb_build_array(s->'hand')
        else '[]'::jsonb end
    );
    if jsonb_typeof(s->'rated') = 'object' and jsonb_typeof(s->'rated'->'decisions') = 'array' then
      insert into public.rating_inbox (user_id, at, decisions)
      values (u, (s->'rated'->>'at')::bigint, s->'rated'->'decisions');
    end if;
  end loop;
end;
$$;

revoke all on function public.record_room_hands(jsonb) from public, anon, authenticated;
grant execute on function public.record_room_hands(jsonb) to service_role;

-- Whether `viewer` may see `owner`'s games.
create or replace function public.games_visible(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer = owner or exists (
    select 1 from public.player_profiles p
    where p.user_id = owner
      and not p.flagged
      and 'games' = any (p.shown)
      and not public.social_blocked(viewer, owner)
  );
$$;

revoke all on function public.games_visible(uuid, uuid) from public, anon, authenticated;

-- A player's games, newest first, 30 at a time before `p_before`. Null when
-- there is nobody to show or they do not show their games.
create or replace function public.player_games(p_handle text, p_before timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  owner uuid;
begin
  select user_id into owner from public.player_profiles
  where handle = lower(trim(ltrim(p_handle, '@')));
  if owner is null or not public.games_visible(me, owner) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.started_at desc)
    from (
      select g.id, g.kind, g.venue_id, g.title, g.accent, g.started_at, g.ended_at,
        g.outcome, g.hands, g.net
      from public.games g
      where g.user_id = owner and g.hands > 0
        and (p_before is null or g.started_at < p_before)
      order by g.started_at desc
      limit 30
    ) x
  ), '[]'::jsonb);
end;
$$;

-- One game with its hands, yours or a player's who shows their games.
create or replace function public.get_game(p_game uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  g public.games;
  p public.player_profiles;
begin
  select * into g from public.games where id = p_game;
  if g.id is null or not public.games_visible(me, g.user_id) then
    return null;
  end if;
  select * into p from public.player_profiles where user_id = g.user_id;
  return jsonb_build_object(
    'id', g.id,
    'kind', g.kind,
    'venueId', g.venue_id,
    'title', g.title,
    'accent', g.accent,
    'startedAt', g.started_at,
    'endedAt', g.ended_at,
    'outcome', g.outcome,
    'mine', g.user_id = me,
    'owner', case when p.user_id is null then null
      else jsonb_build_object('handle', p.handle, 'name', p.display_name) end,
    'hands', coalesce((
      select jsonb_agg(gh.hand order by gh.hand_no)
      from public.game_hands gh where gh.game_id = g.id
    ), '[]'::jsonb)
  );
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'save_game(jsonb, jsonb)',
    'player_games(text, timestamptz)',
    'get_game(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
