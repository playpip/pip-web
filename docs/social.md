# Friends and profiles

> **Status: built 2026-11-22, behind `NEXT_PUBLIC_SOCIAL`.** The screens stay hidden until
> the migration is applied and the repo Variable is set ([To go live](#to-go-live)).

Will, 2026-11-22: players can search for each other, add friends, block and report, challenge
a friend to a game and invite friends to a table, all with notifications. Each player has a
bio and picks what their profile shows.

## The rules

- **It takes an account.** Guests have no profile, no friends and no inbox. Signing up stays
  optional, and "add friends" gives people one more reason to do it.
- **A profile shows only what its owner switched on.** A new profile shows the Pip Rating,
  which is already public on the leaderboard, and nothing else. **The Roll and its rank are
  private unless the player chooses to show them here** (this overrides the old rule, for
  profiles only; nobody at a table sees them). Only the shown values leave the device
  (`cardOf` in `src/lib/social/card.ts`). The rating is read from `ratings`, so it is the one
  number nobody can make up. The others come from the player's own device, like the rest of
  their profile.
- **Friends works both ways.** One side asks, the other says yes. If both ask, that's a yes.
- **Search** is by handle or name prefix. Players who switch off "Appear in search" are still
  visible to their friends.
- **Blocking** is the same block the tables use (`player_blocks`). It ends any friendship,
  clears notifications in both directions, and stops each side from finding or seeing the
  other's profile. The table effects still apply: no camera or voice, and no entry to rooms the
  blocker hosts. The blocked person is not told.
- **Reports** go to `player_reports` with `room_code` null and an optional note. If three
  different people report a profile in a week, it is `flagged`: hidden from search, profile
  pages and inboxes until someone clears it by hand.
- **Names, handles and bios** go through one word filter: `pip_text_ok` in the migration, with
  an exact copy in `src/lib/social/clean.ts` for the form. Bios can't hold links.
  `tests/social.test.ts` fails if the two copies drift apart.
- **Challenges and invites are ordinary rooms.** A challenge opens a two-seat private room or
  slow game and tells the friend. It counts against the host's free allowance like any room
  they host. Joining is always free. `invite_friends` only sends the notice, and only to
  friends.
- **No messaging.** Moderating direct messages would cost more than all of this put together.

## Where it lives

| Part | File |
|---|---|
| Tables and every write | `supabase/migrations/20261122090000_social.sql` |
| Client calls | `src/lib/social/api.ts` |
| What a profile can show | `src/lib/social/card.ts` |
| Word filter, handles | `src/lib/social/clean.ts` |
| Your profile and inbox state | `src/store/social.ts` (started from `AppBoot`) |
| Screens | `src/components/social/`, `/game/friends`, `/game/player?h=handle` |
| Pushes | `push_outbox` kind `social` → `rooms/src/index.ts` → `rooms/src/player.ts` (docs/multiplayer.md) |

Every table has RLS on, and clients get read access only. All writes go through
`security definer` functions that take the caller from `auth.uid()`.
`tests/rlsPolicy.test.ts` lists each function that takes arguments, with the reason it can't
reach anyone else's rows.

## Ways in

The Friends button in the bar on menu screens (not at a table), with the unread count. Also
the Friends row on the multiplayer page, and Invite friends in a room's lobby.

## To go live

From `pip-web/`:

1. `pnpm supabase:db:push:dry-run`. Check it lists only `20261122090000_social.sql`, then run
   `pnpm supabase:db:push`.
2. The room server deploys from CI on push. It already sends `social` pushes, and does nothing
   until the outbox has social rows.
3. `gh variable set NEXT_PUBLIC_SOCIAL --body 1 -R playpip/pip-web`, then redeploy.
4. Someone has to read reports. `select * from player_reports where not resolved order by
   created_at`, and clear `player_profiles.flagged` by hand. The App Store expects reports on
   user content to be dealt with within a day.

## Not yet

- Adding a friend from a table: a seat's view deliberately leaves out the account id, so the
  room server would have to hand over a handle.
- Opening a profile from the leaderboard.
- Email for friend requests and invites. Today it's push and the inbox.
