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
Key: `pip.profile`, versioned (`PERSIST_VERSION`, currently **7**) with a `migrate` hook.
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
- `STARTING_ROLL` (in `config/venues.ts`) = 100 (one Garage buy-in).
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
`blindLevel`/`handIndex` (escalation), and `lastHand` (the previous hand's timeline
for the history dialog).

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
`HANDS_PER_LEVEL` (6) hands through `LEVEL_MULTIPLIERS` (×1, ×2, ×3, ×5, ×8, … ×60,
then capped), scaling each venue's base blinds — so tournaments always end. The top
bar shows the level (`· L2`) once blinds have risen.

**Hand history**: every action (and dealt street) is recorded into `lastHand`
(`HandRecord`) when a hand completes; the History button on the table opens
`HandHistoryDialog` with the timeline, showdown reveals, and the result.

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

## Where to make changes

| Want to change… | Edit |
|-----------------|------|
| The rules of poker | `lib/poker/` (+ tests) |
| AI difficulty / behaviour | `lib/poker/ai/policy.ts` and per-venue `AiProfile` in `config/venues.ts` |
| Pacing (AI think time) | constants in `store/game.ts` |
| Venue buy-ins / blinds / prizes / AI | `config/venues.ts` |
| Blind escalation speed / curve | `config/blinds.ts` (+ tests) |
| Ranks | `config/ranks.ts` |
| Persisted profile shape | `store/profile.ts` (bump `PERSIST_VERSION`, add migration) |
| How a hand looks on screen | `components/table/` |
