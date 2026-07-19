# Venues

The venue ladder is the progression spine of Pip: 10 **sit-and-go tournaments** from a
100-buy-in garage up to the 1,000,000 Main Event, each with tougher AI. Defined in
`src/config/venues.ts`.

## The ladder

| # | id | Name | Buy-in | Blinds | Prize | AI feel |
|---|----|------|-------:|-------:|------:|---------|
| 1 | `garage` | Friends' Garage | 100 | 1/2 | 400 | loosest, forgiving |
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

The `format` field is a display tag (`FORMAT_LABELS`); mechanics come from the
overrides (`handsPerLevel`, `startingStack`, `seats`, `bounty`). Bounties are paid
the moment you take every chip in a hand that busts an opponent (the same seam as
The Bouncer chip) and show on the handover banner. Side-table prizes are budgeted
like the ladder (≈ buy-in × seats, minus the bounty pool on bounty tables).

## The Rail (cash / ring tables)

Also off the ladder, **`RING_TABLES`** is a short ladder of **cash games** — the fast,
low-commitment mode. Unlike a sit-and-go they never end and have no prize: you sit down
with a stack (a slice of your Roll), play any number of hands, and **stand up with whatever's
in front of you** — no clock, no forfeit. Opponents rebuy so the table stays full; bust and
you can rebuy or walk. All pure venue config (`cash: true` + `escalation: false`), no engine
changes.

| id | Name | Blinds | Sit-down (100bb) | AI skill | Feel |
|----|------|-------:|------:|:--:|------|
| `ring-micro` | Micro Ring | 1/2 | 200 | 0.30 | loose-passive — beatable by value |
| `ring-low` | Low Ring | 10/20 | 2,000 | 0.55 | Friday-night regulars |
| `ring-mid` | Mid Ring | 100/200 | 20,000 | 0.80 | solid, bluff-aware |
| `ring-high` | High Ring | 1,000/2,000 | 200,000 | 0.95 | sharks |

**Difficulty is the stake.** There's no difficulty toggle: the AI sharpens as the stakes
rise (`skill` 0.30 → 0.95), and rooms unlock by affordability (`roll >= buyIn`), so a player
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
}
```

`AiProfile` scales up the ladder on two axes. **Personality** — higher
`tightness`/`aggression`/`bluff` and more equity `iterations` (sharper reads) at
higher venues. **Soundness** — `skill` climbs from 0.35 at the Garage (players who
just learned: misread hands, fold under pressure) through 0.97 at Vegas to 1.0 at
the Main Event (plays its best game, no manufactured mistakes). The Kitchen Table
freeroll sits below the ladder at 0.3. See `docs/poker-engine.md`.

## Adding / editing a venue

1. Add an entry to `VENUES` in `config/venues.ts` (keep the array ordered low→high).
   Pick a unique `id`; set `buyIn` (~50–100× the big blind reads well) and a `prize`
   (≈ `buyIn × seats`).
2. Give it an `accent` and an `AiProfile` that fits its position on the ladder.
3. Add art (below). Until an image exists it falls back to a geometric SVG scene.
4. No other code changes needed — the menu, routing, unlock logic, and economy
   are all data-driven from `VENUES`.

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
