# Friends and profiles

> **Status: live since 2026-11-22.** `20261122180000_social.sql` is applied and the repo
> Variable `NEXT_PUBLIC_SOCIAL=1` is set. [To go live](#to-go-live) is kept as the record of
> how, and for a fresh project.

Will, 2026-11-22: players can search for each other, add friends, block and report, challenge
a friend to a game and invite friends to a table, all with notifications. Each player has a
bio and picks what their profile shows.

## The rules

- **It takes an account, and every account has a profile** (Will, 2026-11-22). Guests have no
  profile, no friends and no inbox. Accounts that existed on 2026-11-22 were given one from the
  name and face they sync (`20261122220000_default_profiles.sql`); a new account gets one the
  first time it opens the app (`ensure_player_profile`, from `src/store/social.ts`). The handle
  comes from the name (`will_l`, then `will_l_2`), or `player_<n>` when the name won't do.
  Anyone can change it in Your profile.
- **A profile shows only what its owner switched on.** A new profile shows the Pip Rating,
  which is already public on the leaderboard, and nothing else. A player hidden from the
  leaderboard starts hidden here too: out of search and showing nothing. **The Roll and its rank are
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
- **Challenges and invites are ordinary rooms.** A challenge is Multiplayer's own form
  (`/game/multiplayer?with=<handle>`, from a profile or the Friends strip), opened on two seats
  with that friend invited; any rule can be changed before it opens (Will, 2026-11-23). It
  tells the friend. It counts against the host's free allowance like any room
  they host. Joining is always free. `invite_friends` only sends the notice, and only to
  friends.
- **No messaging.** Moderating direct messages would cost more than all of this put together.

## Suggested

Friends and Find (before you type) show **Suggested** people to add (`suggested_players`,
`20261122210000_suggested_friends.sql`):

1. **Featured players**, from `featured_players`, a short list kept by hand with the
   service role, each with a label shown beside them and on their profile card. Will is on
   it as "Team Pip" (Will, 2026-11-22). To add someone:
   `insert into featured_players (user_id, label, sort) select user_id, 'Label', 1 from
   player_profiles where handle = '…';`
2. **Friends of friends**, most mutual friends first, and only people who appear in search.

Never yourself, anyone you're already friends with or have asked (either way), anyone
blocked either way, or a flagged profile. At most twelve.

## Badges

Shown on the profile card as chips, and as small marks beside the name in lists and on the
leaderboard (`20261122230000_badges.sql`, labels in `src/lib/social/badges.ts`):

| Badge | How |
|---|---|
| Team Pip | By hand. Will has it. |
| Verified | By hand. |
| High roller | By hand. |
| Member | On its own while the membership is live, unless the player switches it off in Your profile. |

To give one, with the service role (SQL editor):
`insert into player_badges (user_id, badge) select user_id, 'verified' from player_profiles
where handle = '…';` and `delete from player_badges where …` to take it away. A new kind needs
the check in `player_badges`, the order in `pip_badges`, and `BADGES` in badges.ts.

## The leaderboard

Signed in, every row opens that player's profile (`handles_for`), and shows their badges.

## Where it lives

| Part | File |
|---|---|
| Tables and every write | `supabase/migrations/20261122180000_social.sql` |
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

Friends in the sidebar, with the unread count, and the count in the bar when something is
waiting (menu screens only, never at a table). Also the Friends row on the multiplayer page,
and Invite friends in a room's lobby.

## The screens

- **Friends:** a strip of faces to challenge in one tap, then requests, friends, sent, and
  blocked (folded away). On a wide screen (1280px and up) the friend you pick stands on the
  right.
- **A profile** (`PlayerView`): the venue that matches their rank behind them, only when
  they show their rank (otherwise the multiplayer table, which says nothing). One main
  button; Remove, Block and Report wait behind "…".
- **Inbox:** games first, as cards with the room's venue (challenges and invites carry
  `venue` in their payload), then friend requests still waiting on you, then the rest.
  `my_notifications` returns where you stand with each sender now, so a request already
  answered is not asked again.

## To go live

From `pip-web/`:

1. `pnpm supabase:db:push:dry-run`. Check it lists only `20261122180000_social.sql`, then run
   `pnpm supabase:db:push`.
2. The room server deploys from CI on push. It already sends `social` pushes, and does nothing
   until the outbox has social rows.
3. `gh variable set NEXT_PUBLIC_SOCIAL --body 1 -R playpip/pip-web`, then redeploy. The build
   step in `.github/workflows/deploy-cloudflare-pages.yaml` passes it through by name.
4. Someone has to read reports. `select * from player_reports where not resolved order by
   created_at`, and clear `player_profiles.flagged` by hand. The App Store expects reports on
   user content to be dealt with within a day.

## Not yet

- Adding a friend from a table: a seat's view deliberately leaves out the account id, so the
  room server would have to hand over a handle.
- Opening a profile from the leaderboard.
- Email for friend requests and invites. Today it's push and the inbox.
