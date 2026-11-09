-- Pushes Supabase queues for the room server to send (docs/multiplayer.md →
-- Notifications). Today one kind: `passed`, written by `submit-rating` for
-- each player a submission climbed past on the Pip Rating board.
--
-- The room server's cron drains it every two minutes with the service role
-- and hands each row to that player's index, which owns their devices, their
-- quiet hours and the twelve-hour gap. No policies: no client can read or
-- write it. Deleting an account takes its rows with it.

create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('passed')),
  -- For `passed`: { name, rank }.
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.push_outbox enable row level security;
