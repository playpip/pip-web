# Game Flow & Economy

The pure engine plays a single hand. The **game store** (`src/store/game.ts`) runs a
**sit-and-go tournament** over time, and the **profile store** (`src/store/profile.ts`)
holds the persistent economy. This doc covers how they choreograph a session.

## The model: sit-and-go tournaments

Venues are **winner-take-all sit-and-go tournaments**. To enter you need the **buy-in** in
your Roll; the buy-in is deducted and becomes your **starting stack** (everyone — human and
AI — sits with the same buy-in). Play continues until one player is left: **bust and you're
out**; win the table and the **prize** is added to your Roll. You climb by growing your Roll
enough to afford higher buy-ins.

## Stores

### `profile` (persisted — localStorage)
Key: `pip.profile`, versioned (`PERSIST_VERSION`, currently **18**) with a `migrate` hook.
- `created`, `name`, `avatar`, `roll` (bankroll), **`peakRoll`** (drives rank title),
  `stats` (hands, showdowns, tournaments, biggest pot), **`rollHistory`** (Roll
  sampled at tournament results/cash-outs, capped ring buffer — feeds the stats
  graph), **`venueRecords`** (per-venue entries/wins/best finish/fastest win),
  `cardBack`, **`awards`** (earned chip ids → epoch ms), **`cameFromFreeroll`**
  (the comeback flag, see docs/awards.md), **`challengeWins`** (cast ids beaten in a
  challenge) and **`challengesPlayed`** (completed challenges, win or lose: the two
  fields the standing challenger is derived from, see docs/venues.md), and
  **`drills`** (per drill kind: `answered`, `correct`, `rating`, `bestRun` — a
  mirror of what you did, never a meter and never a streak; the arithmetic and
  the reasoning are in `src/lib/drills/rating.ts`).
- Actions: `createProfile(name, avatar)`, `setName`, `setAvatar`, `setCardBack`,
  `adjustRoll`, `setRoll` (both also bump `peakRoll`), `grantAwards`,
  `setCameFromFreeroll`, `mergeStats`, `recordRollPoint`, `recordVenueEntry`,
  `recordVenueResult`, `recordChallenge`, `recordDrill`, `reset`.
- `STARTING_ROLL` (in `config/venues.ts`) = 200 (two Garage buy-ins — one bad run doesn’t force the freeroll).
- **Backup**: Settings offers export/restore of the whole profile as
  `pip-profile.json` (`src/lib/backup.ts`) — validated, never partially applied,
  restores run through the same `migrate` path.
- **Durability**: the app is an installable PWA (`src/app/manifest.ts`, offline
  service worker in `public/sw.js`, registered by `AppBoot`), and
  `navigator.storage.persist()` is requested on boot. Installing exempts iOS
  users from Safari's 7-day script-storage eviction.

### `game` (transient — not persisted)
Holds the live `HandState`, `seats` (human + AI meta), `venue`, `status`
(`idle | playing | handover | busted | won`), `heroEquity`, `aiThinkingId`, handover
`message`, the human's finishing `place`, the current `smallBlind`/`bigBlind` +
`blindLevel`/`handIndex` (escalation), `lastHand` (the previous hand's timeline
for the history dialog), `lastBounty`, `talk` (a rare one-line character moment —
see docs/cast.md), and `seatStats` — observed per-opponent tendencies (VPIP,
aggression, folds to pressure) that become the plain-English **reads** in the
player dialog after ~8 hands (`src/lib/reads.ts`, unit-tested). Opponents are
cast characters (`config/cast.ts`); their tendencies also flush into the
profile's `castRecords`, so reads are career-long. `recap` holds the summary of
the run that just ended (tournaments only) and is null at every other moment.

## The turn loop

```
sitDown(venue, human)
  ├─ profile.adjustRoll(-venue.buyIn)              // pay the buy-in
  ├─ every seat (human + AI) stacks = venue.buyIn  // equal stacks
  └─ dealHand(button) → startHand(engine) → progress()

progress()
  ├─ hand complete → finishHand()
  ├─ human to act  → set heroEquity, wait for act()
  └─ AI to act     → setTimeout(delay) → decideAction() → applyAction() → progress()

finishHand()
  ├─ sync stacks; players at 0 chips are eliminated (dropped from live seats)
  ├─ profile.mergeStats(...)
  ├─ human busted?        → status 'busted', place = survivors + 1  (freeroll / leave)
  ├─ one survivor (human) → status 'won', profile.adjustRoll(+venue.prize)
  └─ else → status 'handover' (show result; wait for nextHand())

nextHand()  // "Next hand" button during handover → deal next, button rotates
```

Pacing: `AI_DELAY_IN_HAND` (~1050ms) while the human is live, `AI_DELAY_FOLDED` (~450ms)
once folded. Between hands the game **pauses on the result** and waits for **"Next hand"** —
no auto-advance.

**Blind escalation** (`config/blinds.ts`, unit-tested): blinds rise every
`HANDS_PER_LEVEL` (6) hands through `LEVEL_MULTIPLIERS` (×1, ×2, ×3, ×4, ×6, ×8, …
×55, then capped), scaling each venue's base blinds — so tournaments always end.
The curve climbs in gentle ~1.3–1.4× steps (no ×3→×5→×8 cliff) so tables ease into
the shallow zone rather than lurching into shove-or-fold. Venues override the pace
with `handsPerLevel`: the low ladder rungs escalate gently (Garage 12 → Card Room 9,
so new players play poker rather than shove-or-fold), turbo/hyper side tables
escalate fast (3/2), and the freeroll never escalates. The top bar shows the level
(`· L2`) once blinds have risen.

**Hand history**: every action (and dealt street) is recorded into `lastHand`
(`HandRecord`) when a hand completes; the History button on the table opens
`HandHistoryDialog` with the timeline, showdown reveals, and the result.

**Hand permalinks**: the history dialog's "Share this hand" copies a URL with
the whole `HandRecord` encoded in the **fragment** (`/hand#<token>`, codec in
`lib/handLink.ts`, round-trip tested) — no server, no account; the fragment
never even reaches one. The `/hand` route replays it step-by-step
(`components/HandTimeline.tsx` is shared with the dialog). Malformed links
decode to null and get a friendly empty state.

**Refresh-proofing**: the live table is snapshotted to localStorage (`pip.table`)
at every deal and hand end; the play page resumes an interrupted table instead of
buying in again (a mid-hand refresh re-deals that hand from its start). The
snapshot is cleared on leave, bust, and win. It also carries the run's recap
tally (`RunTally`), so a reload does not produce a recap of half a run.

## The end-of-run recap

A tournament that ends (win or bust) shows a **recap card** on the end overlay:
the finish, hands lasted and Roll change, the run's one highlight, one read on
how it was played, and any career number it moved. Built by `buildRecap` in
`src/lib/recap.ts` (pure, unit-tested) from a `RunSummary` the store assembles in
`finishHand`; `RunRecap` renders it. Cash tables get none: there is no finish to
report. Standing up mid-tournament gets none either, on purpose, because a
player who has said they are done does not want a card in the way.

Three rules hold it in shape:

- **Nothing new is persisted.** Every figure is derived at tournament end from
  the game store and the existing profile, so the recap adds no `PERSIST_VERSION`
  traffic. The lifetime figures it compares a run against are the current totals
  minus the run itself, which is exact.
- **Noise floors, or silence.** The style read needs `STYLE_MIN_HANDS` hands (the
  floor `/stats` uses) and a comparison needs that much history behind it too. A
  three-hand run says less rather than saying something confident and wrong.
- **One run, reported once.** No streaks, no history, nothing asking for
  tomorrow. Coaching *across* runs is the membership's surface, so widening this
  into a trend is a monetisation decision rather than a copy change.

## The economy & progression

- **Roll** = bankroll (play money). Always displayed as **chips** — never a fiat
  symbol (see docs/brand.md). Use the `useMoney()` hook (`src/lib/useMoney.ts`) to
  format any amount for display; never hardcode `.toLocaleString()` for money.
- **Venues** unlock by affordability: playable when `roll >= venue.buyIn`. The Garage
  (buy-in 100) is the entry rung. Higher venues = higher buy-ins, blinds and prizes.
- **Ranks** (`RANKS` in `config/ranks.ts`) are a title derived from `peakRoll`:
  Amateur → Regular → Shark → Pro → Legend (shown under your name).
- **Award chips** — collectible "special chips" earned at milestones (venue wins,
  showdown hand highs, comebacks, ranks). Detection runs in `finishHand()` via the
  pure `detectAwards` helper; see [awards.md](./awards.md).
- **Leaving early:** the buy-in left the Roll at sit-down, so the stack comes back at
  cash-out, converted at the rate you bought in (`cashOutValue` in `config/venues.ts`). At
  almost every table that is the stack itself; the two venues whose `startingStack` isn't
  the buy-in deal chips that are not Roll chips, and paying them back at face value made
  sitting down and standing up worth +1,000 at The Study and -600 at the All-Nighter
  (technology#89). Winning a tournament pays the **prize** and nothing else, so no
  conversion is involved there.
- **The freeroll** — there is **no free top-up**. When you can't afford the Garage
  (`freerollOpen(roll)`), **The Kitchen Table** opens: a free **heads-up** game vs the
  softest AI with a nominal 50-chip stack, flat blinds (`escalation: false`), and a 150
  winner's stake. You win your way back onto the ladder — it's a speed bump, not a
  wall. The stack is the house's — leaving a freeroll cashes out **zero** (no farming
  the starting stack). Entry points: the home screen (under the Roll) and the
  knocked-out overlay.

## Cash tables (The Rail)

Ring tables (`RING_TABLES`, `cash: true`) reuse the same loop with three flips in
`finishHand`, branched via `finishCashHand`:

- **No elimination.** Opponents who bust rebuy to the table stack (`startingStack ?? buyIn`)
  the moment the hand resolves, so the table stays full — a persistent place, not a bracket
  that drains to heads-up.
- **No prize, no win.** The `tournamentWon` / `status: 'won'` path never runs; the hand goes
  to a normal `handover`. Your chips *are* the payout, always — standing up
  (`cashOutAndLeave`, `adjustRoll(+cashOutValue(venue, stack))`, which is the stack itself
  here because a ring table's stack is its buy-in) is the intended, endorsed exit, so the
  `LeaveDialog` drops the "forfeit the prize" framing.
- **Bust = rebuy or stand up.** When the human's stack hits 0 it's `status: 'busted'` but with
  a cash-specific overlay: **Rebuy** (`rebuy()` — spends another buy-in, deals on) if you can
  afford it, the **freeroll** if `freerollOpen(roll)`, or just walk. No "you finished Nth".

Blinds are fixed (`escalation: false`) so hand 1 plays like hand 500, and cash tables skip the
tournament bookkeeping (`recordVenueEntry`, `recordVenueResult`, `tournamentsEntered`). Hand
stats, tendencies and reads still accrue normally. See [venues.md](./venues.md) for the stakes
ladder and why difficulty tracks the stake.

## The welcome flow

A new player's way in (Will, 2026-10-07), `/welcome`, four steps with a progress bar
(`components/onboarding/WelcomeFlow`):

1. **Make your player**: a face and a name. "Already have an account? Sign in" restores one.
2. **Do you know how to play?** "Yes, deal me in" goes to the Welcome Table; "No, teach me
   first" goes to Webb's tour, whose "Take a seat" goes to the same table (`firstSeatHref`).
3. **The Welcome Table**: heads-up against one soft regular, 8 big blinds, blinds up every 3
   hands, on the house's chips (`WELCOME_TABLE` in `config/venues`). Played once. Its end card
   has one button, Continue.
4. **Save your player**: the account, as a whole screen ("Not now" moves on), then **the
   membership**: what is free, what it adds, and the account again if still not made, above
   "Go to the lobby".

Anything that needs a player and has none (`/game`, `/play/*`, the lobby's sub-pages) goes to
`/welcome`; a scanned transfer QR is the one exception. In the lobby, a **Getting started**
checklist (`menu/GettingStarted`) ticks off player, first game, account, today's Daily and a
Friends' Garage win, until done or put away (`gettingStartedDismissed`, profile v25; players
from before v25 have it put away).

## The Daily Deal

**One seeded tournament a day — everyone in the world who plays it gets the
identical shuffle.** The open, deterministic engine makes that *provably* true:
anyone can read `lib/daily.ts` + the engine and verify the deal. The honest
claim (and the copy) is **"same cards, same opponents — your play makes the
difference"**: AI responses diverge once your actions diverge, and we say so.

**Tiers** (Will, 2026-10-07): the regulars' skill and the prizes are set by the
player's rank (`dailyFor(peakRoll)` in `config/venues.ts`, one tier per rank,
Amateur to Legend). Everyone at a tier plays the identical Daily; the tier is
stored on the day's record and printed in the share line.

- **Venue**: `THE_DAILY` in `config/venues.ts` (`daily: true`) — **free to
  enter** (2026-10-07): `buyIn: 0`, a fixed 500 `startingStack`, 5 seats. 1st
  pays 2,000 and 2nd pays 500 (`runnerUpPrize`, read through `prizeFor`). The
  stack is the house's (`houseStack`), so leaving cashes out nothing. The
  Daily used to cost 500 and lock when you were short; it was made free
  because it is the return ritual and a lock shut out the players it is for.
  The prize is capped at one a day, which is what keeps it from being a farm.
- **Seeding** (`lib/daily.ts`, unit-tested): the UTC day key hashes to a base
  seed; hand *n* is dealt from `mulberry32(handSeed(base, n))`, so a mid-run
  refresh re-deals hand *n* identically. The cast draw and AI decision stream
  are seeded from the same base. Zero engine changes — it's a seed convention
  in the game store (`armDaily`).
- **Once a day**: `profile.daily` records `{date, dayNo, place, hands}`.
  Sitting down marks it played immediately — **abandoning counts as played**,
  because the shuffle is knowable and a re-deal would be an exploit. The play
  route redirects if today's daily is already recorded; a snapshot resume is
  allowed (and keeps its original day's seed via `TableSnapshot.dailyDate`).
- **Streak**: `profile.streak` (`{current, best, lastDate}`, v23) counts
  consecutive UTC days with a hand finished at any table (`mergeStats` in
  `store/profile`), plus sitting down at the Daily. Pure logic in
  `lib/streak.ts` (`recordPlay`, `liveStreak`, `streakAtRisk`, `mergeStreaks`),
  unit-tested. The flame in the app bar (`StreakBadge`) shows the live count,
  and the lobby shows "Play a hand today to keep your N-day streak" under the
  Roll when yesterday was played and today is not. Sync joins runs that
  touch across devices (docs/sync.md).
- **Share**: once played, tapping the Daily tile on the menu copies a calm
  one-liner (`dailyShareText`):
  `pip daily #142 · 2nd of 5 · 34 hands · 3-day streak · playpip.io/daily`. The
  streak appears from two days up. No emoji grids.

## The tutorial (`/learn`)

A skippable, animated eight-page tour of poker's grammar — **a tour, not a
course**: one idea per page, built entirely from product primitives
(`PlayingCard`, `DealtCard`, `CardBack`, `CountUp`, `VenueArt`). All
presentation layer (`components/learn/`); no engine, no stores mutated, no
profile required — the route is standalone and shareable.

- **No offer on the way in** (2026-10-07). There used to be a one-time "New to poker?"
  interstitial after the make-your-player screen. Both are gone: a first visit is dealt
  straight in at Friends' Garage (`onboarding/firstSeat`), and the tour is reached from the
  landing page, Learn, and the "Learn with Webb" tile that leads a new player's lobby.
- **The quiet return path**: one line on the home screen under the menu
  ("New to poker? Take the tour.") — no badge, no pulse, never re-offered.
- **No-nag rules**: skippable from every page (the corner Skip), no quiz, no
  gating, no completion tracking. Strategy stays out; the tutorial teaches the
  grammar, the ladder and the reads system teach the game.

## Where to make changes

| Want to change… | Edit |
|-----------------|------|
| The rules of poker | `lib/poker/` (+ tests) |
| AI difficulty / behaviour | `lib/poker/ai/policy.ts` and per-venue `AiProfile` in `config/venues.ts` — validate with `pnpm sim <venue>` (`scripts/sim.ts`) |
| Pacing (AI think time) | constants in `store/game.ts` |
| Venue buy-ins / blinds / prizes / AI | `config/venues.ts` |
| Blind escalation speed / curve | `config/blinds.ts` (+ tests) |
| Ranks | `config/ranks.ts` |
| What the end-of-run recap says | `lib/recap.ts` (+ tests) |
| Persisted profile shape | `store/profile.ts` (bump `PERSIST_VERSION`, add migration) |
| How a hand looks on screen | `components/table/` |
