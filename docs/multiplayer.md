# Multiplayer

> **Status: live on playpip.io since 2026-10-11** (v1.27.0). The room server is `rooms/`, a
> Cloudflare Worker beside the Pages site at rooms.playpip.io, deployed by hand with
> `pnpm rooms:deploy` until `ROOMS_ENABLED` and `CLOUDFLARE_WORKERS_TOKEN` are set. The web app
> hides every multiplayer surface in a build without `NEXT_PUBLIC_ROOMS_URL`. The plan and the
> rulings are `cto/drafts/build-multiplayer.md`.

There are two ways to a table with people at it:

- **Private rooms.** A member opens a room at a ladder stake and gets a six-character code.
  Friends join with the code and a free account. The host can add regulars from the cast to
  any empty chair, then deals. **Camera and mic are available here only.**
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
| Who pays | **Only the host.** Friends join free with an account. Quick match is members only. | 2026-10-11 |
| Format | **Sit-and-go**, at ladder venue stakes. | 2026-10-11 |
| Chips | **The Roll**, and nobody sees anybody else's Roll or rank. | 2026-10-06 |
| Bots | **Quick match fills with AI strangers** (tagged "AI") after about 30 seconds. **A host may add the cast to a private room.** | 2026-10-11 |
| Where | **A separate Worker**, so the Pages deploy is untouched. | 2026-10-11 |
| Menu | **A fifth tile** under "Other ways to play", first in the row and full width on a phone. | 2026-10-11 |

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
  - `POST /rooms` creates a room. It needs a bearer token and membership.
  - `GET /rooms/:code` returns a peek for the join screen.
  - `GET /rooms/:code/ws` is a table's socket.
  - `GET /queue/:venueId/ws` is a stake's queue.
- **`room.ts`, the `PokerRoom` Durable Object** (one per code):
  - it holds the `RoomState` in SQLite storage and runs the reducer;
  - it sends each socket its own view;
  - it relays WebRTC signalling and camera/mic state, in private rooms only.

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

Camera and mic are for **private rooms only**, and both are **off until the player taps
them**. That tap is also what lets iOS and Android play the other seats' audio.

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

For App Store guideline 1.2, and because people deserve them. Tap any person at a private
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
| `/game/multiplayer` (`MultiplayerHub`) | Open a room, type a code, quick match. Everybody can see it; opening a room and quick match ask for the membership. |
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

## By hand: what CI cannot see

Two browsers, or a phone and a laptop. One should be a member and the other a free account.

- [ ] Home shows the **Multiplayer** tile first in "Other ways to play", full width on a phone.
- [ ] The free account sees the hub's lock note. **Open a room** and **Find a table** are
      disabled; **Got a code?** works.
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
