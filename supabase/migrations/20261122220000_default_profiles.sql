-- Everyone with an account has a public profile (Will, 2026-11-22).
--
-- Until now a profile waited for the player to choose a handle. Now every
-- account gets one: existing accounts here, from the name and face they already
-- sync, and new ones the first time they open the app signed in
-- (`ensure_player_profile`, called by src/store/social.ts). Anybody can change
-- the handle, bio and what they show in Your profile.
--
-- What a profile made this way shows: the Pip Rating, which is public on the
-- leaderboard already, and nothing else. A player who hid themselves from the
-- leaderboard starts hidden here too: out of search, showing nothing.

-- A free handle from a name: "Will L." -> will_l, then will_l_2, will_l_3...
-- Falls back to player_<n> for a name with no letters, or one the filter or
-- the reserved list refuses.
create or replace function public.pip_free_handle(p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  base := lower(coalesce(p_name, ''));
  base := translate(base, 'àáâãäåèéêëìíîïòóôõöùúûüýÿñç', 'aaaaaaeeeeiiiiooooouuuuyync');
  base := regexp_replace(base, '[^a-z0-9]+', '_', 'g');
  base := trim(both '_' from base);
  base := left(base, 16);
  base := trim(both '_' from base);
  if char_length(base) < 3
     or not public.pip_text_ok(base)
     or base in ('pip', 'playpip', 'admin', 'support', 'help', 'staff', 'mod', 'moderator',
                 'official', 'system', 'team', 'webb', 'maud', 'root', 'null', 'undefined',
                 'everyone', 'player') then
    base := 'player';
    n := 2;
  end if;
  candidate := case when base = 'player' then 'player_' || n else base end;
  while exists (select 1 from public.player_profiles where handle = candidate) loop
    n := n + 1;
    candidate := base || '_' || n;
  end loop;
  return candidate;
end;
$$;

revoke all on function public.pip_free_handle(text) from public, anon, authenticated;

-- A name the profile can hold: 1 to 24 characters the filter passes, or "Player".
create or replace function public.pip_clean_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when char_length(trim(coalesce(p_name, ''))) between 1 and 24
      and public.pip_text_ok(trim(p_name))
    then trim(p_name)
    else 'Player'
  end;
$$;

-- The caller's profile, made now if they have none. Leaves an existing one alone.
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
    case when coalesce(hidden, false) then '{}'::text[] else '{rating}'::text[] end,
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

-- Everyone who has an account now, one at a time so each handle is free.
do $$
declare
  u record;
  n text;
  avatar jsonb;
  ring text;
begin
  for u in
    select au.id, pr.state, r.hidden
    from auth.users au
    left join public.profiles pr on pr.user_id = au.id
    left join public.ratings r on r.user_id = au.id
    where not exists (select 1 from public.player_profiles pp where pp.user_id = au.id)
    order by au.created_at
  loop
    n := public.pip_clean_name(u.state ->> 'name');
    avatar := case
      when jsonb_typeof(u.state -> 'avatar') = 'object' and pg_column_size(u.state -> 'avatar') <= 2048
      then u.state -> 'avatar'
    end;
    ring := case when jsonb_typeof(u.state -> 'avatarRing') = 'string' then left(u.state ->> 'avatarRing', 40) end;
    insert into public.player_profiles (user_id, handle, display_name, avatar, ring, shown, searchable)
    values (
      u.id,
      public.pip_free_handle(n),
      n,
      avatar,
      ring,
      case when coalesce(u.hidden, false) then '{}'::text[] else '{rating}'::text[] end,
      not coalesce(u.hidden, false)
    )
    on conflict (user_id) do nothing;
  end loop;
end
$$;
