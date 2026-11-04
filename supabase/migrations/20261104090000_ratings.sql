-- The Pip Rating and its public leaderboard (docs/rating.md).
--
-- Public by Will's decision of 2026-11-04: anyone, signed in or not, may read
-- a rating that is not hidden or flagged. The Roll stays private and is not
-- here. Only the `submit-rating` Edge Function writes, with the service role:
-- there is no insert, update or delete policy, so no client can set its own
-- number, unhide a flagged row, or touch anybody else's.
--
-- Two tables, so the public one holds only what the board shows:
--
--   ratings       what the leaderboard reads: name, face, rating, peak, count
--   rating_state  the arithmetic behind it and the rate limits. No policies at
--                 all, so it is unreadable from any client.
--
-- Deleting an account takes both rows with it.

create table if not exists public.ratings (
  user_id uuid primary key references auth.users on delete cascade,
  -- The name and face the player already syncs in their profile, copied at
  -- each submission so the board never reads the private profile blob.
  display_name text not null default 'Player'
    check (char_length(display_name) between 1 and 24),
  avatar jsonb,
  rating integer not null check (rating between 100 and 3000),
  peak integer not null check (peak between 100 and 3000),
  rated_decisions integer not null default 0 check (rated_decisions >= 0),
  -- This week's climbers: the rating at the first submission of the UTC week.
  week_start date not null,
  week_start_rating integer not null check (week_start_rating between 100 and 3000),
  week_gain integer generated always as (rating - week_start_rating) stored,
  -- The player's own choice, from the sheet ("Hide me from the leaderboard").
  hidden boolean not null default false,
  -- Set by the function when a record looks impossible; cleared by hand.
  flagged boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.ratings enable row level security;

create policy "ratings are public unless hidden or flagged, and always your own"
  on public.ratings for select
  using ((not hidden and not flagged) or auth.uid() = user_id);

create index if not exists ratings_board
  on public.ratings (rating desc)
  where not hidden and not flagged;

create index if not exists ratings_climbers
  on public.ratings (week_start, week_gain desc)
  where not hidden and not flagged;

create table if not exists public.rating_state (
  user_id uuid primary key references auth.users on delete cascade,
  -- `RatingCore` in supabase/functions/_shared/rating.ts.
  core jsonb not null,
  -- The finish time (ms) of the last hand counted, so no hand counts twice.
  last_hand_at bigint not null default 0,
  last_submit_at timestamptz,
  hour_start timestamptz,
  hour_decisions integer not null default 0,
  -- Submissions refused for shape or timing, for whoever reviews a flag.
  rejected integer not null default 0
);

alter table public.rating_state enable row level security;

-- The board updates live: Realtime only sends a client the rows its select
-- policy above lets it read.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.ratings;
  end if;
end
$$;
