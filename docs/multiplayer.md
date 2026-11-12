# Multiplayer

> **Status: live on playpip.io since 2026-10-11** (v1.27.0). The room server is `rooms/`, a
> Cloudflare Worker beside the Pages site at rooms.playpip.io, deployed by hand with
> `pnpm rooms:deploy` until `ROOMS_ENABLED` and `CLOUDFLARE_WORKERS_TOKEN` are set. The web app
> hides every multiplayer surface in a build without `NEXT_PUBLIC_ROOMS_URL`. The plan and the
> rulings are `cto/drafts/build-multiplayer.md`.

There are two ways to a table with people at it:

- **Private rooms.** A member opens a room at a ladder stake and gets a six-character code.
  Friends join with the code and a free account. The host can add regulars from the cast to
  any empty chair, then deals. **Camera and mic are available here and in slow games, when the
  host is a member.** A room opened without the membership has 2–4 seats and no camera or mic.
- **Quick match.** A member picks a ladder stake and joins that stake's queue. A table
  starts the moment it is full. If it hasn't filled once the first person in line has waited
  30 seconds, AI players take the empty chairs. There is no camera or mic.
  - **The AI players are strangers, not the cast** (`src/lib/multiplayer/players.ts`):
    ordinary names ("Sam", "Priya K", "nate_92"), random faces, the stake's own AI with a small
    nudge each, and a 1–3 s think that slows facing a bet.
  - **They wear an "AI" tag on their name plate, and the hub explains nothing** (Will,
    2026-10-11). They look like anybody and never claim to be somebody. The membership page
    says "AI players fill any empty seat", because a member is paying for it.

Both are the same sit-and-go as the ladder:

- everyone buys in for the same stack;
- the blinds rise on the venue's schedule;
- the last player with chips wins buy-in × seats, bots included.

The buy-in comes out of the Roll and the prize goes into it (ruled 2026-10-06). Nobody at a
table ever sees another player's Roll or rank.

## Rulings (Will)

| | | |
|---|---|---|
| Who pays | **Only the host.** Friends join free with an account. | 2026-10-11 |
| Free room | **One live private room a day for any account**, counted on the room server (`freeRoom.ts`). | 2026-10-23 |
| Free quick match and slow game | **One quick match a day, and one hosted slow game open at a time**, for any account. | 2026-10-25 |
| Free tables | **A room or slow game hosted without the membership has at most 4 seats and no camera or voice.** Members host up to 8, with both. Decided when the room opens (`freeHost`); rooms opened before the rule keep what they had. | 2026-11-02 |
| Empty tables | **A live table nobody has open stops dealing** at the next hand and closes after ten minutes (`EMPTY_HOLD_MS`) unless somebody comes back. Slow games are exempt. | 2026-10-25 |
| Format | **Sit-and-go**, at ladder venue stakes. | 2026-10-11 |
| Chips | **The Roll**, and nobody sees anybody else's Roll or rank. | 2026-10-06 |
| Bots | **Quick match fills with AI strangers** (tagged "AI") after about 30 seconds. **A host may add the cast to a private room.** | 2026-10-11 |
| Where | **A separate Worker**, so the Pages deploy is untouched. | 2026-10-11 |
| Menu | **A fifth tile** under "Other ways to play", first in the row and full width on a phone. | 2026-10-11 |

## Slow games (2026-10-22)

A slow game is a private room for friends who can't sit down together, like chess.com's daily
games. The plan and Will's rulings are `cto/drafts/build-slow-play.md`.

- **Opening one:** the hub's **Create a room** has a **Pace** row, Live or Slow. A slow game has
  2–4 seats (heads-up by default) and no bots. Its rules are **Time per move** (1h, 4h, 12h or 24h)
  and **Ends**: last standing, after 20, 50 or 100 hands, or on a date. Only the host needs the
  membership, as with any room. Ten open slow games at most per player.
- **The clock** (`src/lib/multiplayer/slow.ts`, `slowDeadline`) counts only time outside the
  mover's **quiet hours**, in their own timezone, with DST handled. Being offline changes
  nothing. Running out checks or folds; two in a row sit you out (moved for at once) until you
  next open the game.
- **Pre-actions** (`setPre`): Check/Fold, Check or Call *n*, set while somebody else is to act and
  made 350 ms after the turn reaches you, if they still stand. A call lapses when the bet
  changes; all of them lapse at the end of the street. Live rooms have them too. Nobody else is
  ever sent yours.
- **Endings on the chips** place by stack; level stacks share a place and split the prize
  (`ledger.ts`). A finished slow game shows on Home for a week.
- **The catch-up** (`catchUp.ts`): a slow room keeps its last 10 hands, and each seat how far it
  has watched (`seen`). Opening the game deals what you missed again with the engine and plays it
  on the felt before handing you the table, with a Skip. A rebuilt hand that doesn't land where
  the real one did is not shown. Every frame is redacted like a view.
- **Your games** (`YourGames`, `MiniTable`): mini tables at the top of Home and on the hub, your
  move first. They come from **`Player`**, a third Durable Object, one per account
  (`rooms/src/player.ts`). After every change a slow room sends each player their own `SlowCard`,
  built from `viewFor`, so it only holds what they may see. `GET /slow` reads it.
- **Leaving:** Back keeps your seat. **Leave this game** (in Table rules) stands you up.

### Notifications

The rules are `src/lib/multiplayer/notices.ts`; `Player` keeps the prefs, devices and the alarm.

- **Push** as soon as it's your move, to every device you allowed: browsers through the service
  worker (VAPID web push, `public/sw.js`), the iOS app through Expo's push service.
- **Email** (Resend), off until the player turns it on, if the move is still waiting a quarter of the way through the clock, or after
  5 minutes with no device. One email lists every game waiting on you, at most one every 12 hours,
  with a signed one-click off link (`/notify/off`).
- **Nothing in quiet hours** (it waits for them to end), and nothing while the table is open.
- A finished game is a push, never an email.
- **Settings → Notifications:** Push notifications (the main switch; turning it on asks this
  device and registers it), and under it Slow games, Leaderboard and Streak; then Slow game
  emails and Quiet hours (default 23:00–08:00). The main switch and the three under it are the
  account's, so they apply to every device.
- **Asked once, on the first visit to the lobby** (`menu/LobbyPush`, Will 2026-11-09): the app puts
  up the system's question straight away; a browser gets Pip's card (`PushPrompt`) because it may
  only ask from a tap, and only when signed in. A slow game's table still asks anyone who skipped
  it. A device already allowed registers again once a session. On an iPhone, web push needs Pip on
  the Home Screen; the app needs a build with `expo-notifications` (`mobile/README.md`).

- **Deleting the account** clears it all first: `POST /notify/forget` empties the player's index
  (devices, switches, quiet hours, slow games list) while the session still works there
  (`lib/sync/deleteAccount.ts`). If the delete then fails, the switches are put back. `/privacy`
  says so under Notifications.

### Pushes that are not about a game

The rules are `src/lib/multiplayer/nudges.ts`; `Player` sends them, through the same devices,
switch and quiet hours.

- **Passed on the Pip Rating board.** `submit-rating` writes a `push_outbox` row (migration
  `20261109180433_push_outbox.sql`) for each of up to 10 players a climb passed, with the place it
  leaves them. The Worker's cron (`*/2 * * * *`, `scheduled` in `index.ts`) drains it into each
  player's index. At most one every 12 hours; rows older than 6 hours are dropped. Opens
  `/game/leaderboard`.
- **Streak.** Once a day per account with a device, at the latest of 20:00, 18:00, 16:00 or 13:00
  UTC outside their quiet hours (the streak's day is a UTC day), the index reads the synced
  profile's `state.streak` with the service role. Played yesterday and not today: "Your 6-day
  streak ends in 4 hours". Missed yesterday after 2 or more days: "Your streak ended at 6 days",
  once. Opens `/game`. Accounts with a device from before this start on their next lobby visit.

Secrets on the Worker: `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (`node scripts/vapid-keys.mjs`;
rotating them unsubscribes every browser), `RESEND_API_KEY`, and optionally `NOTIFY_SECRET`.
Without them pushes are skipped and emails logged.

| Slow timings | |
|---|---|
| A move | 1, 4, 12 or 24 hours, outside your quiet hours |
| A move set ahead | made 350 ms after the turn reaches you |
| Sat out (two timeouts running) | moved for at once until you open the game |
| An unstarted slow game is cleared | 3 days |
| A finished one is cleared | 7 days |

## The authority model

**The server deals and keeps every hole card. No client is ever sent a card it may not see.**
A client that receives everybody's cards can read them in devtools, whatever the UI draws.

- **`src/lib/multiplayer/room.ts`** is the whole game, as a pure reducer over one serialisable
  `RoomState`:
  - seating, bots, starting the game;
  - each move, checked: the sender must own the seat whose turn it is, and the move must pass
    `legalActions`;
  - the turn clock, settling a hand, places.

  Time comes in as `now` and goes out as `dueAt`/`dueKind`, so the server keeps one alarm for
  whatever is due next. `tick()` does the due thing: a timeout (check if free, else fold), a
  bot's move (`decideAction`), the next deal, a quick table's start, or expiry. An alarm that
  fires early changes nothing.
- **`view.ts`**, `viewFor(state, userId)`, is what one socket is sent:
  - the deck is emptied;
  - everyone else's cards are removed until a showdown turns them over;
  - the count of cards each player holds is kept, so card backs can be drawn;
  - account ids are never included.

  `tests/multiplayerView.test.ts` checks every state of hundreds of seeded hands, for every
  seat and for a spectator.
- **`protocol.ts`** holds the message types and the parser every client message goes through
  before the server reads it. Untrusted text is either one of the shapes, bounded, or dropped.
- **`matchmaking.ts`** is the queue as a pure value: `takeTable(queue, now)`.
- **`ledger.ts`** is the Roll's books on this device:
  - the buy-in is taken the first time a game is seen dealt;
  - the prize is paid the first time it is seen won;
  - entries are keyed by `code:startedAt`, so a refresh never charges or pays twice.

  The Roll stays client-side by design ("you're only cheating yourself").

The engine is imported unchanged. What runs on the server is what is in the public repo.

## The room server (`rooms/`)

- **`index.ts`**, the front door. Every socket and every room creation must come from an origin
  in `ALLOWED_ORIGINS`.
  - `POST /rooms` creates a room. It needs a bearer token and membership, or the free one of
    that kind (`free-room-used` / `free-slow-used` once spent; the `Player` object keeps them).
  - `GET /free` says what is left of the free hosting (`{ room, quick, slow }`), for the hub.
    `GET /free-room` is the old form, kept for a cached page.
  - `GET /rooms/:code` returns a peek for the join screen.
  - `GET /rooms/:code/ws` is a table's socket.
  - `GET /queue/:venueId/ws` is a stake's queue.
  - `GET /hands` is the hands-played count the landing page shows (its function reads it
    server-side and caches it for five minutes). `POST /hands` is the game reporting its hands
    against the cast, ten at a time, anonymously: capped at 20 a report, one report a minute
    per address.
- **`room.ts`, the `PokerRoom` Durable Object** (one per code):
  - it holds the `RoomState` in SQLite storage and runs the reducer;
  - it sends each socket its own view;
  - it relays WebRTC signalling and camera/mic state, in private rooms and slow games a member
    opened (`mediaAllowed()`: `hosted()` and not `freeHost`), never at quick match.
  - `index.ts` tells `/init` whether the host is a member (`freeHost: !member`, from the same
    `isMember` the free-room-a-day check uses); the reducer caps a free host's seats at
    `FREE_ROOM_SEATS` in `createRoom` and `configure`.

  It uses the Hibernation API. Memory is lost when the object sleeps, so the state is read back
  from storage and each socket carries who it is in its attachment.
  - **One socket per person:** a second tab takes the seat over.
  - **Rate limit:** messages are limited per socket.
  - **No interleaving:** after awaiting Supabase, the hello re-reads state, so a join that
    happened meanwhile isn't written away.
- **`matchmaker.ts`, the `Matchmaker` Durable Object** (one per stake):
  - it holds the queue;
  - it opens a `PokerRoom` with the matched accounts reserved, and sends them its code;
  - its changes run inside `blockConcurrencyWhile`, because opening a room is a request to
    another object.
- **`tally.ts`, the `Tally` Durable Object** (one, named `all`): the hands-played count, as
  `ai` and `people`, on top of `BACKFILL` in `src/lib/handCount.ts` (what was played before it
  existed, partly estimated; the comment says how). A room adds each hand it deals, by how many
  people were really playing it: a person who has left, or has run out of time twice in a row,
  does not count, so a table everybody walked away from (it deals on by itself) adds nothing.
- **`auth.ts`:**
  - `identify(token)` asks Supabase `/auth/v1/user`, once per socket;
  - `isMember` reads `memberships` with the service role and decides with the same
    `readEntitlement` the client uses.

  **The server's membership check is the gate. The browser's `useEntitlement()` is only for
  the UI.**

Timings live in `room.ts`:

| What | Time |
|---|---|
| Your turn | 30 s |
| Away (disconnected, or timed out twice in a row) | 8 s |
| Coming back mid-turn | the turn's own deadline, counted from when it began, never a fresh clock |
| A bot thinks | 0.6–1.9 s, longer facing a bet and on later streets; 0.45 s once no person is in the hand |
| Pause between hands | 2.8 s (5 s after a showdown) |
| A quick table waits for its players | 15 s |
| A finished room is cleared | 30 min |
| An unstarted room is cleared | 2 h |

## Camera and microphone

Camera and mic are for **private rooms and slow games a member opened** (the rooms friends share
by code, `mediaAllowed()`), never quick match or a room opened without the membership, and both
are **off until the player taps them**. At a free host's room the view says `media: false`: the
host sees the camera and mic locked (a tap goes to the membership), everybody else sees none, and
the server refuses `media` and `signal`. At a slow game
they connect whoever has the table open at the same moment, so a stretch played live can be
played face to face (added 2026-10-24). That tap is also what lets iOS and Android play the other seats' audio.

- **How they connect** (`store/media.ts`):
  - every pair of players gets a direct peer-to-peer connection, using the "perfect
    negotiation" pattern, with the higher seat as the polite side;
  - each connection is set up once with an audio slot and a video slot;
  - turning the camera on or off swaps the track (`replaceTrack`) rather than renegotiating;
  - turning the camera off stops the track, so the camera light goes out.
- **Bandwidth:** 320×240 at 15 fps, roughly 150 kbps per stream.
- **Signalling** goes over the room's socket. **ICE:** Cloudflare STUN always, and Cloudflare
  TURN when `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` are set. The room mints one set of
  credentials an hour.
- **Drawing it:** the video takes the avatar's place, at the same size:
  - `FeltSeat` and `HeroPanel` take a `face` prop;
  - `LiveFace` draws the video, mirrored for your own seat;
  - `PeerAudio` plays the voices.
- **In the store apps:** `mobile/` declares the camera and microphone permissions, and the
  WebView grants capture to playpip.io (`mediaCapturePermissionGrantType`). The app reports
  the `media` capability; an app without it hides the buttons. It ships in the first store build (1.0.0);
  see `mobile/README.md`.

## Reporting, blocking and muting (2026-10-11)

For App Store guideline 1.2, and because people deserve them. Tap any person at a private or slow
table, or their face in the lobby, for `PlayerSheet`:

- **Mute** and **Hide their camera**: for you only, in `store/media.ts`; nothing is sent.
- **Report**: four reasons. The room server stores the reporter, the reported account, the room
  code and the reason in `player_reports` (`rooms/src/safety.ts`), once per pair per room, and
  logs it as well, so a failed insert is never a lost report.
- **Block**: stored in `player_blocks`. At the table the server stops relaying camera and voice
  between the two (`blockedBetween`), and leaves each out of the other's media list. When the
  blocker opens a room their blocks are loaded, and a blocked account is refused at the door.
  The blocked person is never told.

Both tables are RLS-on with no policies (`supabase/migrations/20261011090000_player_safety.sql`):
only the service role reads or writes them. Read reports in the Supabase table editor.

## The client

| Path | What it is |
|---|---|
| `/game/multiplayer` (`MultiplayerHub`) | Open a room, type a code, quick match. Everybody can see it; quick match, slow games and a second room in a day ask for the membership. |
| `/game/room?code=…` (`RoomScreen`) | The code is in the query string because the site is a static export. Sitting down is a tap (`JoinGate`). A host or a matched player is seated straight from the hub. |
| `RoomLobby` | The felt with the chairs filling, and the code on the cloth. |
| `RoomTable` | The live table's own parts, turned so you sit at the near rail. |
| `store/room.ts`, `store/queue.ts` | Sockets, reconnect with backoff, and the ledger. |

## Local development

```bash
cp rooms/.dev.vars.example rooms/.dev.vars   # DEV_AUTH=1 for local tokens
pnpm rooms:dev                               # http://localhost:8787
NEXT_PUBLIC_ROOMS_URL=http://localhost:8787 pnpm dev
```

With `DEV_AUTH=1`, the server accepts `dev:<name>:member` (or `:free`) as a token. To be two
players without accounts, run this in each browser's console, then reload:

```js
localStorage.setItem('pip.roomsDevToken', 'dev:alice:member')
```

The client reads that key only in a development build.

## Runbook: switching it on

**Use the right Cloudflare account.** The Worker has to live on the account that holds the
`pip-web` Pages project and the `playpip.io` zone, or the custom domain cannot be created.
Check `npx wrangler whoami` before anything else, and `npx wrangler pages project list` should
show `pip-web`. The Supabase project uses the newer API keys: the anon key is the
`sb_publishable_…` key and the service key is an `sb_secret_…` key, which `rooms/src/auth.ts`
sends in `apikey` only. CI deploys with its own secret, `CLOUDFLARE_WORKERS_TOKEN` (an
"Edit Cloudflare Workers" token scoped to that account and the playpip.io zone), not the Pages
token.

1. **Cloudflare:** upgrade the account to **Workers Paid** ($5 a month). The free plan runs
   SQLite Durable Objects, but without much headroom.
2. **Secrets** on the Worker. They are never in the repo:
   ```bash
   npx wrangler secret put SUPABASE_URL -c rooms/wrangler.jsonc
   npx wrangler secret put SUPABASE_ANON_KEY -c rooms/wrangler.jsonc
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c rooms/wrangler.jsonc
   # camera and mic across strict networks (Cloudflare dashboard → Realtime → TURN)
   npx wrangler secret put TURN_KEY_ID -c rooms/wrangler.jsonc
   npx wrangler secret put TURN_KEY_API_TOKEN -c rooms/wrangler.jsonc
   ```
3. **Deploy:** `pnpm rooms:deploy`. The first deploy creates `rooms.playpip.io` (a custom
   domain on the playpip.io zone). Check `https://rooms.playpip.io/health`: `uploaded` is when
   the running version went up, so a room fix merged after it has not reached the tables.
4. **Repo variables and secret:**
   - secret `CLOUDFLARE_WORKERS_TOKEN`, for the rooms workflow;
   - `ROOMS_ENABLED=true`, so `.github/workflows/deploy-rooms.yaml` redeploys on changes;
   - `NEXT_PUBLIC_ROOMS_URL=https://rooms.playpip.io`.
5. **Push the site.** The next Pages build turns on:
   - the tile;
   - the hub;
   - the membership page's spotlight;
   - the privacy section.
6. **The apps:** the first store build (1.0.0) already carries the camera and mic permissions.

## Costs

The estimate is **about $5–8 a month at 100 rooms a day**, an hour each, four players. That is
mostly the Workers Paid base. Hibernation removes most of the duration charge.

TURN is $0.05/GB after the first 1,000 GB a month free, shared with the SFU. Only sessions that
cannot connect directly use it.

**Camera and voice, per free room (estimate, 2026-10-23, nothing measured; free rooms have had
no camera or voice since 2026-11-02, so this now applies to members' rooms only).** Media is a
peer-to-peer mesh at 320x240, 15 fps (`store/media.ts`), roughly 0.5 Mbps a stream with voice.
Only relayed streams cost anything. Worst case, all four seats relayed: about 2.7 GB a room-hour.
At 50 free rooms a day of an hour each that is about 4,000 GB a month, about $150 past the free
1,000 GB. At a typical 15-20% relayed it is 600-800 GB, inside the free allowance. Watch the
Realtime TURN usage page; a free-room time cap is the first fix if it climbs.

## By hand: what CI cannot see

Two browsers, or a phone and a laptop. One should be a member and the other a free account.

- [ ] Home shows the **Multiplayer** tile first in "Other ways to play", full width on a phone.
- [ ] The free account sees the hub's lock note. **Open a room** and **Find a table** are
      disabled once today's free ones are used; **Got a code?** works.
- [ ] The free account's seat picker shows 5–8 locked, and opening their free room gives a
      table of 4 with the camera and mic locked for them and absent for their friends.
- [ ] The member opens a room. The code sits on the felt, and **Invite friends** opens the share
      sheet on a phone or copies the link on a desktop.
- [ ] The friend opens the link and sees the host's name, the stake and the buy-in. Tapping
      **Join** puts them in a chair on the host's screen.
- [ ] The host adds a regular, removes it, adds it again, then deals. The buy-in leaves both
      Rolls once.
- [ ] Each player sees only their own cards until a showdown.
- [ ] Wait out a turn: the bar runs down, and the server checks or folds.
- [ ] Lock the phone mid-hand. The seat shows **Away** and gets the short clock. Unlock: the
      seat comes back with its cards.
- [ ] Camera on, then mic on, on both. Each face takes its seat at its usual size, your own
      mirrored. Voices play and talking rings the seat. Turning the camera off brings the
      avatar back and the camera light goes out.
- [ ] Repeat on iOS Safari, and in the iOS app (TestFlight) (one system prompt per
      permission, no second web prompt).
- [ ] Play to the end. The winner's Roll gains the prize once; a refresh on the end card does
      not pay twice.
- [ ] Two members queue at the same stake: matched together, the cast in the remaining chairs.
      One member alone: dealt in with the cast after about 30 s.
