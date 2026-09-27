# Venues

The venue ladder is the progression spine of Pip: 10 **sit-and-go tournaments** from a
100-buy-in garage up to the 1,000,000 Main Event, each with tougher AI. Defined in
`src/config/venues.ts`.

Several arrays live there, and `ALL_VENUES` is the union every route and lookup reads:
`VENUES` (the ladder), `SIDE_TABLES`, `RING_TABLES` (the Rail), `CHALLENGE_TABLES`,
**`DEEP_STACK_TABLES`** and **`BIG_POT`** (the membership's), plus the Kitchen Table, the
Daily, and the custom-table route placeholder.

## The ladder

| # | id | Name | Buy-in | Blinds | Prize | AI feel |
|---|----|------|-------:|-------:|------:|---------|
| 1 | `garage` | Friends' Garage | 100 | 1/2 | 300 | loosest, forgiving |
| 2 | `pub` | The Pub | 300 | 3/6 | 1,500 | Friday-night amateurs |
| 3 | `poolhall` | The Pool Hall | 750 | 5/10 | 3,750 | hustlers, semi-loose |
| 4 | `cardroom` | The Card Room | 2,000 | 15/30 | 12,000 | tight, positional |
| 5 | `casino` | Downtown Casino | 5,000 | 25/50 | 30,000 | aggressive, bluff-aware |
| 6 | `riverboat` | The Riverboat | 15,000 | 75/150 | 90,000 | float & barrel |
| 7 | `penthouse` | The Penthouse | 40,000 | 200/400 | 240,000 | patient killers |
| 8 | `montecarlo` | Monte Carlo | 100,000 | 500/1000 | 600,000 | balanced pros |
| 9 | `vegas` | Vegas Championship | 300,000 | 1500/3000 | 1,800,000 | elite |
| 10 | `mainevent` | The Main Event | 1,000,000 | 5000/10000 | 6,000,000 | near-optimal |

The **buy-in is your starting stack** (everyone sits equal); it's deducted from your Roll
and a venue is playable when `roll >= buyIn`. Prizes are winner-take-all (≈ buy-in × seats).

## Side tables (formats)

Off the ladder, **`SIDE_TABLES`** offers the same game under different pressure —
all pure venue config, no engine changes:

| id | Name | Format | Buy-in | Twist |
|----|------|--------|-------:|-------|
| `redeye` | The Red-Eye | Turbo | 500 | `handsPerLevel: 3` — blinds up every 3 hands |
| `study` | The Study | Deep | 1,000 | `startingStack: 2000` + `handsPerLevel: 9` |
| `duel` | The Duel | Heads-up | 750 | `seats: 2`, winner-take-all |
| `docks` | The Docks | Bounty | 2,000 | `bounty: 500` paid instantly per knockout |
| `allnighter` | The All-Nighter | Hyper | 1,500 | shallow `startingStack: 900` + `handsPerLevel: 2` |
| `chopshop` | The Chop Shop | Bounty | 5,000 | `bounty: 1500` + `handsPerLevel: 3` — turbo bounty |
| `vault` | The Vault | Heads-up | 25,000 | `seats: 2`, sharp AI (skill 0.82) — the side-table boss |

**A `startingStack` that isn't the buy-in is an exchange rate.** The Study sells a 2,000
stack for 1,000, the All-Nighter a 900 stack for 1,500, so those chips are not Roll chips
and leaving converts them back (`cashOutValue`). Paying a stack back at face value printed
1,000 chips for sitting down and standing up at one table and ate 600 at the other, whether
or not a hand was played (technology#89). Any new venue that overrides `startingStack`
inherits the conversion; `tests/cashOut.test.ts` holds every venue to it.

The `format` field is a display tag (`FORMAT_LABELS`); mechanics come from the
overrides (`handsPerLevel`, `startingStack`, `seats`, `bounty`). Bounties are paid
the moment you take every chip in a hand that busts an opponent (the same seam as
The Bouncer chip) and show on the handover banner. Side-table prizes are budgeted
like the ladder (≈ buy-in × seats, minus the bounty pool on bounty tables).

## What the membership adds

Two cards on the side tables, not a category of their own. This started as five member
rooms with their own lobby tile and browser page, and that made the home screen six 16:10
tiles wide — which shrank every table on the row, the opposite of what that row is for
(Will, 2026-09-19). The rooms were mostly variations on stack depth, so they collapsed into
one card that asks how deep you want to play for. **The lobby does not grow a tile per
feature.**

Both are ordinary tables in every way that touches a hand: same engine, same shuffle, same
AI policy, `prize = buyIn × seats` exactly as on the ladder. They are **ranked**, and that
is not pay-to-win — see [membership.md](./membership.md).

### Deep Stack

`DEEP_STACK_TABLES` — **five registered venues wearing one card.** The side-tables page
shows `DEEP_STACK_DEFAULT` (2,000) and the info dialog swaps between the rest with a stake
picker.

| id | Buy-in | Stack | Blinds | Opposition |
|----|-------:|------:|-------:|------------|
| `deepstack-750` | 750 | 2,250 | 5/10 | The Pool Hall's |
| `deepstack-2000` | 2,000 | 6,000 | 15/30 | The Card Room's |
| `deepstack-5000` | 5,000 | 15,000 | 25/50 | Downtown Casino's |
| `deepstack-15000` | 15,000 | 45,000 | 75/150 | The Riverboat's |
| `deepstack-40000` | 40,000 | 120,000 | 200/400 | The Penthouse's |

Six seats, three times the buy-in in chips, and a twelve-hand level at every stake: deep is
the point, so it is the thing that does not vary.

**Why five venues rather than one with a dynamic buy-in.** Every route is generated at build
time under the static export, nothing new has to persist, `venueById` resolves a deep link
on its own, and `tests/ai.test.ts` bands each profile the day it lands. A dynamic buy-in
would have bought a persisted field, a migration and a resolution step in `PlayClient` to
save four declarative config entries.

**The stake picks the opposition**, taken whole from the ladder rung at the same price —
the same rule a built table follows. There is no difficulty setting, and the dialog says so.

### The Big Pot

`BIG_POT` — 5,000 buy-in, 10,000 stack, six seats, and the only table in the app that deals
a different game: **`variant: 'omaha'`**. Deep on purpose, because Omaha is a drawing game
and short stacks turn it into a coin flip. See
[poker-engine.md → Variants](./poker-engine.md#variants) for the rules and for the known
approximation in its opponents' personalities.

### The regulars

Bev, Dez and Winnie are pinned to these tables, so `rosterFor` returns them instead of the
band's and `draftCast` tops up from the wider cast. Being pinned is also what keeps them out
of the challenge pool, so no free player's scalp shelf grows because they exist — see
[cast.md](./cast.md).

## The Rail (cash / ring tables)

Also off the ladder, **`RING_TABLES`** is a short ladder of **cash games** — the fast,
low-commitment mode. Unlike a sit-and-go they never end and have no prize: you sit down
with a stack (a slice of your Roll), play any number of hands, and **stand up with whatever's
in front of you** — no clock, no forfeit. Opponents rebuy so the table stays full; bust and
you can rebuy or walk. All pure venue config (`cash: true` + `escalation: false`), no engine
changes.

| id | Name | Blinds | Sit-down (100bb) | AI skill | Feel |
|----|------|-------:|------:|:--:|------|
| `ring-micro` | Micro Ring | 1/2 | 200 | 0.24 | loose-passive: calls too much, rarely bluffs |
| `ring-small` | Small Ring | 3/6 | 600 | 0.36 | loose, with a bit more bite |
| `ring-low` | Low Ring | 10/20 | 2,000 | 0.49 | Friday-night regulars |
| `ring-club` | Club Ring | 30/60 | 6,000 | 0.61 | thinking players, still exploitable |
| `ring-mid` | Mid Ring | 100/200 | 20,000 | 0.74 | solid, bluff-aware |
| `ring-big` | Big Ring | 300/600 | 60,000 | 0.82 | sharp, patient, hard to bluff |
| `ring-high` | High Ring | 1,000/2,000 | 200,000 | 0.89 | sharks |

Every step is ~3x. The canon four (Micro / Low / Mid / High) each sat 10x apart, which left a
player who had ground a Micro roll up to 800 with nowhere honest to sit. Small, Club and Big
fill the geometric midpoints and interpolate their AI profiles from their neighbours.

**The "Feel" column describes how these bots play, not how well you will do against them.**
Style is guarded: `tests/ai.test.ts` bands every table in `ALL_VENUES` on VPIP and PFR, ring
rooms included, so "loose-passive" fails the build if the profile drifts. **Beatability is
not, and has never been simulated for any room on the Rail.** `scripts/sim.ts` plays every
venue as a freezeout and reads EV off `prize`, and a cash table has no elimination and a
`prize` of 0, so both of its outcome columns are meaningless here; it now blanks them and
says so (technology#81). Until a cash measurement exists, no row above should be given a verb
about the player.

**Difficulty is the stake.** There's no difficulty toggle: the AI sharpens as the stakes
rise (`skill` 0.24 → 0.89), and rooms unlock by affordability (`roll >= buyIn`), so a player
of any level self-sorts into an honest game just by picking a stake they can afford. Every
room is 100 big blinds deep and blinds never escalate. Cash tables aren't tournaments — they
don't record venue results or count as entries, and there are no cash-table souvenirs.

Reached from the main menu via the **The Rail** card, which opens its own page
(`/game/rail` → `RailBrowser`) — framed as a place you sit rather than an event you enter.
See [game-flow.md](./game-flow.md) for the cash-mode orchestration.

Off the ladder also sits **The Kitchen Table** (`kitchen`) — a **freeroll** that opens only
while you can't afford the Garage (`freerollOpen(roll)`): no buy-in, **heads-up** vs the
softest AI, a nominal 100 stack (`startingStack`), **no blind escalation**
(`escalation: false`), and a 150 prize so the winner buys back into the ladder. It's
deliberately a speed bump, not a wall — a decent player wins it more often than not.
There is no free top-up, and the table stack is the house's — **leaving a freeroll
cashes out nothing**; only the winner's prize pays.

See [game-flow.md](./game-flow.md) for the economy, ranks, and blind escalation.

## Challenge tables

**`CHALLENGE_TABLES`** is where a cast member's standing challenge gets played out:
one heads-up table per band, `seats: 2`, paying **~2.5x** where a ladder duel pays 2x.

| id | Buy-in | Blinds | Prize | AI skill |
|----|-------:|-------:|------:|:--:|
| `challenge-low` | 500 | 5/10 | 1,250 | 0.40 |
| `challenge-mid` | 8,000 | 60/120 | 20,000 | 0.62 |
| `challenge-high` | 50,000 | 350/700 | 125,000 | 0.80 |

Buy-ins deliberately sit **between** the ladder rungs. On a rung, a table paying 2.5x
would leave that rung with nothing to offer. Putting `challenge-low` at 750 would
retire The Duel.

**The character is not in the venue config.** `lib/challenge.ts` derives who is waiting
from two persisted fields (`challengeWins`, `challengesPlayed`, `PERSIST_VERSION` 12)
and nothing stores the current challenger, so two devices compute the same one with no
coordination and there is no pending-challenge object for sync to reconcile. The band
comes from the highest ladder venue you have actually **won**, stepped down if your Roll
can't cover the buy-in.

**The way in is the card, not the URL.** These tables are in `ALL_VENUES`, so they
resolve and they prerender, because the card's link would 404 under static export
otherwise. Reaching one any other way is turned around: `PlayClient` sends you back to
`/game` unless the table matches the challenge you actually have standing. Without that
guard, `/play/challenge-high` is a repeatable 2.5x heads-up game two bands above your
play, found by anyone who guesses a URL once.

`sitDown` fills the one opposite chair from `challengerFor(venue, profile)` rather than
from `draftCast`, so a reload, a deep link and the card all seat the same face. The
result is recorded by `recordChallenge` at both terminal branches of `finishHand`:
**any completed challenge rotates the challenger, only a win records the scalp.**
Standing up mid-tournament is not a completed challenge, so the same face is still
waiting, the same way an abandoned ladder run leaves that rung unbeaten.

## The `Venue` shape

```ts
interface Venue {
  id: string            // stable; used for routes and image mapping
  name: string
  tagline: string
  buyIn: number         // entry cost (from Roll) AND your starting stack
  smallBlind, bigBlind: number
  seats: number         // total incl. the human
  prize: number         // winner-take-all, added to Roll on a win
  ai: AiProfile         // { tightness, aggression, bluff, iterations, skill? }
  accent: string        // hex; the tier chip colour
  membersOnly?: boolean // comes with the membership; absent means free forever
  variant?: Variant     // 'omaha' deals four and plays pot-limit; absent means Hold'em
  guests?: string[]     // named characters who sit here and bring their own rung (built tables only)
}
```

**`guests` is the one thing that can move a seat off this venue's `ai`,** and it can only
move it *up*. A character named here is seated before the draw and plays their home rung's
profile whenever that is harder than this table's (`profileFor`, `homeRungFor` — both in
`config/cast.ts`). Only `customVenue` sets it: a built table's price still buys its own
opposition, and inviting the Penthouse's regulars to a 100-chip table makes a harder game
for the same prize rather than a cheaper one. See [membership.md](./membership.md) and
`tests/customTable.test.ts`, which fails the build if a guest ever softens a table.

**`membersOnly` absent is not a default anyone may change later.** Rule 1 is that we never
charge for something that shipped free, so a venue registered without the flag has given
itself away. A new paid table must carry it in the same commit that registers it, and
`tests/sitDown.test.ts` pins the exact set of paid venue ids so that neither adding nor
removing one can land quietly.

`AiProfile` scales up the ladder on two axes. **Personality** — higher
`tightness`/`aggression`/`bluff` and more equity `iterations` (sharper reads) at
higher venues. **Soundness** — `skill` climbs from 0.35 at the Garage (players who
just learned: misread hands, fold under pressure) through 0.97 at Vegas to 1.0 at
the Main Event (plays its best game, no manufactured mistakes). The Kitchen Table
freeroll sits below the ladder at 0.3. See `docs/poker-engine.md`.

## Adding / editing a venue

1. Add an entry to the right array in `config/venues.ts` — `VENUES` for a ladder rung
   (keep it ordered low→high), `SIDE_TABLES` / `RING_TABLES` otherwise.
   Pick a unique `id`; set `buyIn` (~50–100× the big blind reads well) and a `prize`
   (`buyIn × seats`, minus `bounty × (seats − 1)` on a bounty table).
2. Give it an `accent` and an `AiProfile` that fits its position on the ladder.
3. **If it is paid, set `membersOnly: true` in the same commit**, and add its id to the
   pinned list in `tests/sitDown.test.ts`. If it is free, do neither.
4. Add art (below). Until an image exists it falls back to a geometric SVG scene.
5. No other code changes needed — the menu, routing, unlock logic, and economy
   are all data-driven from `ALL_VENUES`.

**`tests/ai.test.ts` will measure it the moment it lands in `ALL_VENUES`** — every table is
held to a VPIP/PFR band, and a profile that plays like a calling station fails the build
without anybody editing a test. It costs about a second a table.

> Changing an existing `id` orphans its image mapping — prefer adding over renaming.

## Venue art

Art is **flat, geometric, dark-background** illustration, one per venue, tinted to fit.
We use **AI-generated square images** with a hand-coded SVG scene as automatic fallback.

- **Files:** `public/venues/<id>.jpg` (e.g. `garage.jpg`).
- **Registration:** add `"<id>": "/venues/<id>.jpg"` to `VENUE_IMAGES` in
  `components/menu/VenueArt.tsx`. Missing/failed images fall back to the SVG scene in
  the same file (`SCENES[id]`).
- **Rendering:** `VenueArt` renders the SVG underneath and the image on top
  (`object-cover`), inside a `#0A0A0A` frame. Tier chip + champion/lock badges are
  overlaid by the tile, not by `VenueArt`.

### Generating new art

Prompts live in the repo root [`VENUE_PROMPTS.md`](../VENUE_PROMPTS.md) — one ready-to-paste
block per venue with the subject + accent filled in, plus a shared negative prompt.

Guidelines that keep the set coherent:
- **Square (1:1)**, ≥1024px. Same negative prompt + a fixed seed/style reference for all.
- Flat minimalist vector, dark near-black background, one dominant accent colour.
- No text, no logos, no people. Keep the subject centred (the desktop banner crops to
  the centre; the mobile thumb shows the whole square).
- Recraft (exports SVG, consistent style) or Midjourney (`--style raw` + shared `--sref`)
  work well.

Don't universally add poker imagery to the prompts — the venues should read as *places*;
the app already supplies the poker context.
