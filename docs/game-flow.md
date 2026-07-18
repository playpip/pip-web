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
Key: `pip.profile`, versioned (`PERSIST_VERSION`, currently **8**) with a `migrate` hook.
- `created`, `name`, `avatar`, `roll` (bankroll), **`peakRoll`** (drives rank title),
  `stats` (hands, showdowns, tournaments, biggest pot), **`rollHistory`** (Roll
  sampled at tournament results/cash-outs, capped ring buffer — feeds the stats
  graph), **`venueRecords`** (per-venue entries/wins/best finish/fastest win),
  `cardBack`, **`awards`** (earned chip ids → epoch ms), **`cameFromFreeroll`**
  (the comeback flag — see docs/awards.md).
- Actions: `createProfile(name, avatar)`, `setName`, `setAvatar`, `setCardBack`,
  `adjustRoll`, `setRoll` (both also bump `peakRoll`), `grantAwards`,
  `setCameFromFreeroll`, `mergeStats`, `recordRollPoint`, `recordVenueEntry`,
  `recordVenueResult`, `reset`.
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
profile's `castRecords`, so reads are career-long.

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
snapshot is cleared on leave, bust, and win.

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
- **The freeroll** — there is **no free top-up**. When you can't afford the Garage
  (`freerollOpen(roll)`), **The Kitchen Table** opens: a free **heads-up** game vs the
  softest AI with a nominal 100 stack, flat blinds (`escalation: false`), and a 150
  winner's stake. You win your way back onto the ladder — it's a speed bump, not a
  wall. The stack is the house's — leaving a freeroll cashes out **zero** (no farming
  the starting stack). Entry points: the home screen (under the Roll) and the
  knocked-out overlay.

## The Daily Deal

**One seeded tournament a day — everyone in the world who plays it gets the
identical shuffle.** The open, deterministic engine makes that *provably* true:
anyone can read `lib/daily.ts` + the engine and verify the deal. The honest
claim (and the copy) is **"same cards, same opponents — your play makes the
difference"**: AI responses diverge once your actions diverge, and we say so.

- **Venue**: `THE_DAILY` in `config/venues.ts` (`daily: true`) — buy-in 500,
  5 seats, standard prize math. It costs a real buy-in: a free daily with a
  prize would be a daily top-up, which breaks the no-free-top-up rule.
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
- **Share**: the home card's Share button copies a calm one-liner
  (`dailyShareText`): `pip daily #142 · 2nd of 6 · 34 hands · playpip.io`.
  No streaks, no emoji grids, no countdowns — yesterday's daily is simply gone.

## The tutorial (`/learn`)

A skippable, animated eight-page tour of poker's grammar — **a tour, not a
course**: one idea per page, built entirely from product primitives
(`PlayingCard`, `DealtCard`, `CardBack`, `CountUp`, `VenueArt`). All
presentation layer (`components/learn/`); no engine, no stores mutated, no
profile required — the route is standalone and shareable.

- **The offer**: after `createProfile` succeeds, `/game` shows a one-time
  interstitial (`TutorialOffer`) — "Show me the basics" → `/learn?from=onboarding`
  or "Deal me in" → home. The offer is memory-only state in the create flow;
  `created` already gates onboarding, so it can only ever appear once. No
  persisted flag, no `PERSIST_VERSION` bump.
- **The quiet return path**: one line on the home screen under the shelves
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
| Persisted profile shape | `store/profile.ts` (bump `PERSIST_VERSION`, add migration) |
| How a hand looks on screen | `components/table/` |
