# Game history

Every game you play is kept on your account and can go back on the felt: yours
from your profile and the stats page, and anybody's from their profile, as on
chess.com (Will, 2026-11-27). It replaces "one session, and the next one
replaces it" (docs/review.md → Storage), which now describes only what a
guest's device keeps.

## What counts as a game

| Kind | One game is | Written by |
|---|---|---|
| `cash` | a solo cash table, sit-down to stand-up | the device (`lib/games/upload.ts`) |
| `tournament` | a solo run: the ladder, the Rail, the Daily, the freeroll | the device |
| `private` · `open` · `slow` | one multiplayer game | the room server (`rooms/src/games.ts`) |

Solo tables are the ones the review already keeps (`reviewableVenue`). A
guest's session stays on the device; it reaches the account only once there is
one.

**Multiplayer is written by the room server**, not the device, so a slow game
keeps every hand whatever device you opened it on, or if you never opened it
at all. Each person at the table gets their own copy, built from the hand as
`redactHand` gives it to their seat (`lib/multiplayer/games.ts`): their cards
and the ones a showdown turned over, never anyone's mucked hand.

## Storage

`supabase/migrations/20261127120000_games.sql`:

- `games`: one row per game, with what the list shows (kind, table, when,
  hands, net chips, outcome). Keyed by `(user_id, key)`: `solo:<startedAt>` or
  `room:<code>:<startedAt>`, so a resend is one row.
- `game_hands`: one row per hand, holding the review's own `ReviewHand`
  (`{ record, decisions }`). At most 400 hands a game; a player keeps their
  newest 300 games.
- Writes go through `save_game` (the device, solo kinds only) and
  `record_room_hands` (service role only). The device sends a session's new
  hands about 20 seconds after each hand, and right away when it ends or before
  the next sit-down. What went up is remembered in `localStorage` `pip.gameSent`.

## Who sees what

Your own games: always, directly (RLS). Anybody else's go through
`player_games(handle)` and `get_game(id)`, and only if their profile shows
**Games** (on by default, and switched on when this shipped for every existing
profile that appears in search), they are not flagged, and neither of you has blocked the other.

**Going through a game is free; the review is the membership's** (Will,
2026-11-27: "list is free and they can go through the games but there's no
session review like members have"):

| | Free | Member |
|---|---|---|
| The list, yours or anybody's | yes | yes |
| Stepping through the hands on the felt | yes | yes |
| Each seat's odds, every move rated, the price's second opinion | no | yes |
| The session's numbers, highlights, the Mistakes filter, Share hand | no | yes |

The free view is `ReviewTable` with `plain`. Somebody else's game is told
apart by `session.owner`: the commentary names them instead of saying "you",
and the price's second opinion, which talks to "you", is left out.

## Where it is

- `/game/games`: your game history. `/game/games?h=handle`: a player's.
- The profile card: a **Games** section with the latest five and *All games*.
- The stats page: *Game history* under *Review your last session*.
- `/game/review?game=ID`: one game on the felt.

## Where to make changes

| Want to change… | Edit |
|---|---|
| What a room writes per person | `lib/multiplayer/games.ts` (+ `tests/games.test.ts`) |
| How a solo session is sent | `lib/games/upload.ts` |
| The list, its filters and rows | `components/games/GameList.tsx` |
| Who may read what, and the caps | the migration's `games_visible`, `games_put` |
