-- Friends, public profiles and the inbox (docs/social.md).
--
-- Will, 2026-11-22: search for players, add them as friends, block and report
-- them, challenge them and invite them to tables, all with notifications; a bio
-- and a choice of what a profile shows. The Roll is private unless the player
-- chooses to show it here.
--
-- The shape of it:
--
--   player_profiles  a handle, a name, a face, a bio, and only the things the
--                    player chose to show. Readable by its owner only; everybody
--                    else goes through `get_player` and `search_players`, which
--                    leave out anybody either side has blocked.
--   friendships      one row a pair, pending until the other says yes.
--   notifications    the inbox. Each one also queues a push (`push_outbox`).
--
-- Every write is a `security definer` function below, written like
-- `delete_own_account`: `search_path = ''`, every name qualified, the caller
-- taken from `auth.uid()` and never from an argument, and execute granted to
-- `authenticated` only. No table here has an insert, update or delete policy.
-- A refusal raises an exception whose message is a short code the client
-- turns into words (`src/lib/social/api.ts`).
--
-- Deleting an account takes every row with it.

-- What a name, a handle or a bio may not say. `src/lib/social/clean.ts` is an
-- exact copy for the form, and tests/social.test.ts fails if the two differ.
-- Words are matched whole; stems anywhere, with spaces and punctuation ignored.
-- Names are kept off the list (Dick, Coon) so real people can use theirs.
create or replace function public.pip_text_ok(t text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  words constant text[] := array[
    'fucker', 'fucking', 'fucked', 'shit', 'shite', 'cunt', 'cunts', 'cock', 'cocks', 'twat',
    'wank', 'wanker', 'slut', 'whore', 'fag', 'fags', 'dyke', 'tits', 'cum', 'porn', 'rape',
    'raped', 'rapist', 'nazi', 'kike', 'spic', 'chink', 'gook', 'paki', 'tranny', 'retard',
    'retards', 'nonce', 'bitch', 'pussy'
  ];
  -- Innocent words that hold a stem, taken out before the stems are looked for.
  innocent constant text[] := array['snigger'];
  stems constant text[] := array[
    'fuck', 'nigger', 'nigga', 'faggot', 'cocksuck', 'hitler', 'paedo', 'pedophil', 'childporn',
    'motherfuck', 'whitepower', 'siegheil'
  ];
  plain text;
  squash text;
  w text;
begin
  if t is null then
    return true;
  end if;
  plain := translate(lower(t), '0134578@$!|', 'oieastbasil');
  squash := regexp_replace(plain, '[^a-z]', '', 'g');
  foreach w in array innocent loop
    squash := replace(squash, w, '');
  end loop;
  foreach w in array stems loop
    if position(w in squash) > 0 then
      return false;
    end if;
  end loop;
  foreach w in array regexp_split_to_array(plain, '[^a-z]+') loop
    if w = any (words) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  -- Lower case, so "@Will" and "@will" are one person.
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar jsonb,
  ring text check (ring is null or char_length(ring) <= 40),
  bio text not null default '' check (char_length(bio) <= 160),
  -- What the player chose to show, from `SHOWABLE` in src/lib/social/card.ts.
  -- The Pip Rating comes from `ratings`; the rest is in `card`.
  shown text[] not null default '{rating}',
  -- Only the shown values, copied from the player's own profile as they play.
  card jsonb not null default '{}'::jsonb check (pg_column_size(card) <= 2048),
  -- Off: nobody finds you in search. Friends still see you.
  searchable boolean not null default true,
  -- Set when enough different people report a profile; cleared by hand.
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

create policy "your own public profile"
  on public.player_profiles for select
  using (auth.uid() = user_id);

create table if not exists public.friendships (
  user_a uuid not null references auth.users on delete cascade,
  user_b uuid not null references auth.users on delete cascade,
  requested_by uuid not null references auth.users on delete cascade,
  status text not null check (status in ('pending', 'friends')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);

alter table public.friendships enable row level security;

create policy "your own friendships"
  on public.friendships for select
  using (auth.uid() in (user_a, user_b));

create index if not exists friendships_b on public.friendships (user_b);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  actor uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('friend-request', 'friend-accepted', 'challenge', 'invite')),
  -- For a challenge or an invite: { code, slow }.
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.notifications enable row level security;

create policy "your own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create index if not exists notifications_inbox on public.notifications (user_id, id desc);
create index if not exists notifications_sent on public.notifications (actor, created_at);

-- Reads only, and RLS above decides which rows. Said outright rather than left
-- to the project's default privileges, which newer projects no longer grant.
grant select on public.player_profiles, public.friendships, public.notifications to authenticated;
revoke all on public.player_profiles, public.friendships, public.notifications from anon;

-- The badge updates live: Realtime sends a client only its own rows.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- The push for each notification goes through the room server, which owns the
-- devices, the switches and the quiet hours (rooms/src/player.ts).
alter table public.push_outbox drop constraint if exists push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('passed', 'social'));

-- A report about a profile, from outside any room.
alter table public.player_reports alter column room_code drop not null;
alter table public.player_reports drop constraint if exists player_reports_reason_check;
alter table public.player_reports add constraint player_reports_reason_check
  check (reason in ('abuse', 'camera', 'cheating', 'other', 'profile'));
alter table public.player_reports add column if not exists note text
  check (note is null or char_length(note) <= 500);

-- --- helpers: not callable from a client ------------------------------------

create or replace function public.social_me()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'auth';
  end if;
  return uid;
end;
$$;

create or replace function public.social_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.player_blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

-- The other person, by handle, if the caller may deal with them at all.
create or replace function public.social_target(me uuid, h text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  them uuid;
begin
  select user_id into them from public.player_profiles
  where handle = lower(trim(h)) and (not flagged);
  if them is null or them = me or public.social_blocked(me, them) then
    raise exception 'not-found';
  end if;
  return them;
end;
$$;

create or replace function public.social_notify(target uuid, me uuid, k text, extra jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
begin
  insert into public.notifications (user_id, actor, kind, payload)
  values (target, me, k, coalesce(extra, '{}'::jsonb));
  select display_name into who from public.player_profiles where user_id = me;
  insert into public.push_outbox (user_id, kind, payload)
  values (target, 'social', jsonb_build_object('kind', k, 'name', coalesce(who, 'Someone'))
    || coalesce(extra, '{}'::jsonb)
    || jsonb_build_object('handle', (select handle from public.player_profiles where user_id = me)));
end;
$$;

revoke all on function public.social_me() from public, anon, authenticated;
revoke all on function public.social_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.social_target(uuid, text) from public, anon, authenticated;
revoke all on function public.social_notify(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- --- your profile -----------------------------------------------------------

create or replace function public.save_player_profile(
  p_handle text,
  p_name text,
  p_avatar jsonb,
  p_ring text,
  p_bio text,
  p_shown text[],
  p_card jsonb,
  p_searchable boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  h text := lower(trim(coalesce(p_handle, '')));
  n text := trim(coalesce(p_name, ''));
  b text := trim(coalesce(p_bio, ''));
begin
  if h !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'handle-shape';
  end if;
  if h in ('pip', 'playpip', 'admin', 'support', 'help', 'staff', 'mod', 'moderator', 'official',
           'system', 'team', 'webb', 'maud', 'root', 'null', 'undefined', 'everyone') then
    raise exception 'handle-taken';
  end if;
  if not public.pip_text_ok(h) then
    raise exception 'handle-word';
  end if;
  if char_length(n) < 1 or char_length(n) > 24 then
    raise exception 'name-shape';
  end if;
  if not public.pip_text_ok(n) then
    raise exception 'name-word';
  end if;
  if char_length(b) > 160 then
    raise exception 'bio-long';
  end if;
  if not public.pip_text_ok(b) then
    raise exception 'bio-word';
  end if;
  if b ~* '(https?:|www\.|[a-z0-9]\.(com|net|org|io|gg|co|uk|xyz|ru|me|ly|tv|app|link)\M)' then
    raise exception 'bio-link';
  end if;
  if p_avatar is not null and (jsonb_typeof(p_avatar) <> 'object' or pg_column_size(p_avatar) > 2048) then
    raise exception 'avatar-shape';
  end if;
  if exists (select 1 from public.player_profiles where handle = h and user_id <> me) then
    raise exception 'handle-taken';
  end if;

  insert into public.player_profiles
    (user_id, handle, display_name, avatar, ring, bio, shown, card, searchable)
  values (
    me, h, n, p_avatar, left(p_ring, 40), b,
    coalesce(p_shown, '{}'), coalesce(p_card, '{}'::jsonb), coalesce(p_searchable, true)
  )
  on conflict (user_id) do update set
    handle = excluded.handle,
    display_name = excluded.display_name,
    avatar = excluded.avatar,
    ring = excluded.ring,
    bio = excluded.bio,
    shown = excluded.shown,
    card = excluded.card,
    searchable = excluded.searchable,
    updated_at = now();
exception
  when unique_violation then
    raise exception 'handle-taken';
end;
$$;

-- The shown values again, as the player plays. Leaves the handle and bio alone.
create or replace function public.refresh_player_card(
  p_name text,
  p_avatar jsonb,
  p_ring text,
  p_card jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  n text := trim(coalesce(p_name, ''));
begin
  if p_avatar is not null and (jsonb_typeof(p_avatar) <> 'object' or pg_column_size(p_avatar) > 2048) then
    raise exception 'avatar-shape';
  end if;
  update public.player_profiles set
    display_name = case
      when char_length(n) between 1 and 24 and public.pip_text_ok(n) then n
      else display_name
    end,
    avatar = coalesce(p_avatar, avatar),
    ring = left(p_ring, 40),
    card = coalesce(p_card, '{}'::jsonb),
    updated_at = now()
  where user_id = me;
end;
$$;

-- --- finding people ---------------------------------------------------------

create or replace function public.social_relation(me uuid, them uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when me = them then 'self'
    when f.status = 'friends' then 'friends'
    when f.status = 'pending' and f.requested_by = me then 'sent'
    when f.status = 'pending' then 'received'
    else 'none'
  end
  from (select 1) one
  left join public.friendships f
    on f.user_a = least(me, them) and f.user_b = greatest(me, them);
$$;

revoke all on function public.social_relation(uuid, uuid) from public, anon, authenticated;

create or replace function public.search_players(p_query text)
returns table (handle text, display_name text, avatar jsonb, ring text, relation text)
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
    select p.handle, p.display_name, p.avatar, p.ring, public.social_relation(me, p.user_id)
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

-- One profile, with what its owner chose to show. Null when there is nobody to
-- show: no such handle, flagged, or a block either way.
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
    'searchable', p.searchable
  );
end;
$$;

-- --- friends ----------------------------------------------------------------

create or replace function public.request_friend(p_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  them uuid := public.social_target(me, p_handle);
  lo uuid := least(me, them);
  hi uuid := greatest(me, them);
  f public.friendships;
begin
  if not exists (select 1 from public.player_profiles where user_id = me) then
    raise exception 'no-profile';
  end if;
  select * into f from public.friendships where user_a = lo and user_b = hi;
  if f.status = 'friends' then
    return 'friends';
  end if;
  if f.status = 'pending' and f.requested_by = me then
    return 'sent';
  end if;
  if f.status = 'pending' then
    -- They asked first: this is a yes.
    update public.friendships set status = 'friends', accepted_at = now()
    where user_a = lo and user_b = hi;
    update public.notifications set read_at = coalesce(read_at, now())
    where user_id = me and actor = them and kind = 'friend-request';
    perform public.social_notify(them, me, 'friend-accepted', null);
    return 'friends';
  end if;
  if (select count(*) from public.friendships
      where requested_by = me and created_at > now() - interval '1 day') >= 40 then
    raise exception 'slow-down';
  end if;
  if (select count(*) from public.friendships where me in (user_a, user_b)) >= 500 then
    raise exception 'too-many';
  end if;
  insert into public.friendships (user_a, user_b, requested_by, status)
  values (lo, hi, me, 'pending');
  perform public.social_notify(them, me, 'friend-request', null);
  return 'sent';
end;
$$;

create or replace function public.answer_friend(p_handle text, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  them uuid := public.social_target(me, p_handle);
  lo uuid := least(me, them);
  hi uuid := greatest(me, them);
begin
  update public.notifications set read_at = coalesce(read_at, now())
  where user_id = me and actor = them and kind = 'friend-request';
  if p_accept then
    update public.friendships set status = 'friends', accepted_at = now()
    where user_a = lo and user_b = hi and status = 'pending' and requested_by = them;
    if found then
      perform public.social_notify(them, me, 'friend-accepted', null);
      return 'friends';
    end if;
    return public.social_relation(me, them);
  end if;
  delete from public.friendships
  where user_a = lo and user_b = hi and status = 'pending' and requested_by = them;
  return 'none';
end;
$$;

-- Unfriend, or take back a request you sent. Works on a handle you have since
-- blocked or been blocked by, so a friendship never outlives either.
create or replace function public.remove_friend(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  them uuid;
begin
  select user_id into them from public.player_profiles where handle = lower(trim(p_handle));
  if them is null then
    return;
  end if;
  delete from public.friendships where user_a = least(me, them) and user_b = greatest(me, them);
  delete from public.notifications
  where user_id = them and actor = me and kind = 'friend-request' and read_at is null;
end;
$$;

create or replace function public.my_friends()
returns table (handle text, display_name text, avatar jsonb, ring text, status text, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.handle, p.display_name, p.avatar, p.ring,
    case when f.status = 'friends' then 'friends'
         when f.requested_by = public.social_me() then 'sent'
         else 'received' end,
    coalesce(f.accepted_at, f.created_at)
  from public.friendships f
  join public.player_profiles p
    on p.user_id = case when f.user_a = public.social_me() then f.user_b else f.user_a end
  where public.social_me() in (f.user_a, f.user_b)
    and not p.flagged
    and not public.social_blocked(public.social_me(), p.user_id)
  order by f.status, lower(p.display_name);
$$;

-- --- block and report -------------------------------------------------------

-- The same block the tables use (rooms/src/safety.ts): no camera or voice, kept
-- out of rooms you host, and here also no friendship, no search, no profile and
-- nothing in either inbox from the other.
create or replace function public.block_player(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  them uuid;
begin
  select user_id into them from public.player_profiles where handle = lower(trim(ltrim(p_handle, '@')));
  if them is null or them = me then
    raise exception 'not-found';
  end if;
  insert into public.player_blocks (blocker, blocked) values (me, them) on conflict do nothing;
  delete from public.friendships where user_a = least(me, them) and user_b = greatest(me, them);
  delete from public.notifications
  where (user_id = me and actor = them) or (user_id = them and actor = me);
end;
$$;

create or replace function public.unblock_player(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.player_blocks where blocker = public.social_me() and blocked = p_user;
$$;

-- Who you have blocked, at a table or here. Somebody without a profile has no
-- handle or name to show.
create or replace function public.my_blocks()
returns table (user_id uuid, handle text, display_name text, avatar jsonb, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked, p.handle, p.display_name, p.avatar, b.created_at
  from public.player_blocks b
  left join public.player_profiles p on p.user_id = b.blocked
  where b.blocker = public.social_me()
  order by b.created_at desc;
$$;

-- Three different people reporting a profile in a week hide it until somebody
-- looks (`flagged`): out of search, off every profile page and inbox.
create or replace function public.report_player(p_handle text, p_reason text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  them uuid;
begin
  select user_id into them from public.player_profiles where handle = lower(trim(ltrim(p_handle, '@')));
  if them is null or them = me then
    raise exception 'not-found';
  end if;
  if p_reason not in ('profile', 'abuse', 'cheating', 'other') then
    raise exception 'reason';
  end if;
  if (select count(*) from public.player_reports
      where reporter = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'slow-down';
  end if;
  insert into public.player_reports (reporter, reported, room_code, reason, note)
  values (me, them, null, p_reason, nullif(left(trim(coalesce(p_note, '')), 500), ''));
  if (select count(distinct reporter) from public.player_reports
      where reported = them and room_code is null and not resolved
        and created_at > now() - interval '7 days') >= 3 then
    update public.player_profiles set flagged = true where user_id = them;
  end if;
end;
$$;

-- --- challenges and invites -------------------------------------------------

-- Tell friends about a room you have opened: a challenge (heads-up, made for
-- them) or an invite to your table. The room server already decided you could
-- open it; this only sends the word, and only to friends.
create or replace function public.invite_friends(
  p_handles text[],
  p_kind text,
  p_code text,
  p_slow boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_me();
  h text;
  them uuid;
  sent integer := 0;
begin
  if p_kind not in ('challenge', 'invite') then
    raise exception 'kind';
  end if;
  if p_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'code';
  end if;
  if coalesce(array_length(p_handles, 1), 0) = 0 then
    return 0;
  end if;
  if array_length(p_handles, 1) > 8 then
    raise exception 'too-many';
  end if;
  if (select count(*) from public.notifications
      where actor = me and kind in ('challenge', 'invite')
        and created_at > now() - interval '1 hour') + array_length(p_handles, 1) > 40 then
    raise exception 'slow-down';
  end if;
  foreach h in array p_handles loop
    select p.user_id into them from public.player_profiles p
    where p.handle = lower(trim(h)) and not p.flagged;
    if them is not null
      and them <> me
      and public.social_relation(me, them) = 'friends'
      and not public.social_blocked(me, them)
      and not exists (
        select 1 from public.notifications
        where user_id = them and actor = me and payload ->> 'code' = p_code
      ) then
      perform public.social_notify(them, me, p_kind,
        jsonb_build_object('code', p_code, 'slow', coalesce(p_slow, false)));
      sent := sent + 1;
    end if;
  end loop;
  return sent;
end;
$$;

-- --- the inbox --------------------------------------------------------------

create or replace function public.my_notifications()
returns table (
  id bigint, kind text, payload jsonb, created_at timestamptz, read_at timestamptz,
  handle text, display_name text, avatar jsonb, ring text
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.kind, n.payload, n.created_at, n.read_at,
    p.handle, p.display_name, p.avatar, p.ring
  from public.notifications n
  join public.player_profiles p on p.user_id = n.actor
  where n.user_id = public.social_me()
    and n.created_at > now() - interval '30 days'
    and not p.flagged
  order by n.id desc
  limit 60;
$$;

-- Null marks everything read.
create or replace function public.read_notifications(p_ids bigint[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where user_id = public.social_me()
    and read_at is null
    and (p_ids is null or id = any (p_ids));
$$;

-- --- who may call what ------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'save_player_profile(text, text, jsonb, text, text, text[], jsonb, boolean)',
    'refresh_player_card(text, jsonb, text, jsonb)',
    'search_players(text)',
    'get_player(text)',
    'request_friend(text)',
    'answer_friend(text, boolean)',
    'remove_friend(text)',
    'my_friends()',
    'block_player(text)',
    'unblock_player(uuid)',
    'my_blocks()',
    'report_player(text, text, text)',
    'invite_friends(text[], text, text, boolean)',
    'my_notifications()',
    'read_notifications(bigint[])'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
