<img src="docs/assets/pip-logo.png" width="72" alt="pip logo" />

# pip

**Casual poker, redesigned.** Pip is a clean, single-player Texas Hold'em web app —
play money, no accounts, no pop-ups, no fake felt. Open source and local-first.
Live at **[playpip.io](https://playpip.io)**.

Free poker apps tend to look and feel like a scam: neon, leather textures, coin
jingles, and more time spent closing offers than playing cards. Pip is the opposite —
a flat, calm, black-first table where the poker is the whole product.

## How it plays

- **The venue ladder** — ten winner-take-all sit-and-go tournaments, from the
  100-chip *Friends' Garage* to the 1,000,000-chip *Main Event*. The buy-in is your
  starting stack; win the table, take the prize, climb. Blinds escalate, so
  tournaments always end. Side tables (turbo, deep, heads-up, bounty) twist the
  format without gating the climb.
- **The cast** — opponents are a fixed troupe of regulars with faces, bios, and
  personalities, not random bots. Doris plays every hand; Frank bluffs constantly;
  the Vault has a boss. Your reads on them build **across sessions**, and they
  occasionally say something dry.
- **The Daily Deal** — one date-seeded tournament a day: everyone in the world
  plays the identical shuffle, provably (the engine is open and deterministic).
  Once a day, no streaks, a calm copyable result line.
- **Hand permalinks** — share any hand as a URL; the whole hand is encoded in the
  link (no server, no account) and replays step-by-step for whoever opens it.
- **The Chip Shop** — spend winnings on card backs, a four-colour deck, table
  finishes, and souvenir chips of venues you've conquered. **Style, never edge**:
  nothing for sale affects gameplay, and award chips can't be bought.
- **Broke? Win your way back** — there's no free top-up. *The Kitchen Table* freeroll
  opens when you can't afford the Garage: beat one soft opponent heads-up and the
  winner's stake buys you back onto the ladder.
- **Ambient help** — live win-% equity, hand strength, plain-English reads on
  opponents, and a reviewable last-hand history. Informative, never nagging.
- **Yours, locally** — your profile, Roll (bankroll), rank, collection, and style
  live in localStorage (versioned, exportable). No login, no server, no tracking.
- Light and dark themes, quiet tactile sound, desktop and mobile layouts.

Play money only: balances are **chips**, never a currency. The only shop takes
chips you won at the table — nothing costs real money, ever.

## Quick start

Requires [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev        # → http://localhost:3000
```

## Commands

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Dev server at `localhost:3000` |
| `pnpm test` | AVA suite (engine + game logic) |
| `pnpm test:all` | The full gate: format, types, lint (Biome), AVA, knip, audit |
| `pnpm format` | Biome — format + safe fixes |
| `pnpm build` | Production build |

A change is done when **`pnpm test:all` passes** (and `build` for structural
work). The UI isn't unit-tested — verify it by running the app.

## Architecture

Three layers with hard boundaries (Next.js App Router, React 19, Tailwind v4,
Zustand, Framer Motion):

1. **Engine** — [`src/lib/poker/`](src/lib/poker). Pure, deterministic, React-free
   Texas Hold'em: dealing, betting, side pots, hand evaluation, Monte-Carlo equity,
   and the AI policy. Every rule lives here, and ships with tests.
2. **Orchestration** — [`src/store/`](src/store). `game.ts` runs the tournament over
   time (turn pacing, AI timers, blind escalation, hand history, the economy);
   `profile.ts` is the persisted player (versioned, with migrations).
3. **Presentation** — [`src/components/`](src/components), [`src/app/`](src/app).
   Reads the stores; look & feel only.

Full documentation lives in [`docs/`](docs/README.md):

| Doc | What's in it |
|-----|--------------|
| [architecture.md](docs/architecture.md) | Stack, layout, data flow, design decisions |
| [poker-engine.md](docs/poker-engine.md) | The pure engine: rules, evaluation, equity, AI |
| [game-flow.md](docs/game-flow.md) | The tournament loop, economy, ranks, the freeroll, the Daily Deal |
| [cast.md](docs/cast.md) | The cast — Pip's troupe of opponents, career reads, table talk |
| [venues.md](docs/venues.md) | The venue ladder and venue art |
| [awards.md](docs/awards.md) | Collectible "special chips" — the set, triggers, visuals |
| [shop.md](docs/shop.md) | The Chip Shop & earned unlocks — style, never edge |
| [design.md](docs/design.md) | Theme tokens, typography, motion, sound |
| [brand.md](docs/brand.md) | The name, the voice (including the dry line), the anti-casino principles |
| [development.md](docs/development.md) | Setup, testing, conventions, gotchas |

Agents working in this repo should start with [`CLAUDE.md`](CLAUDE.md) /
[`AGENTS.md`](AGENTS.md).

## About

Pip is built by [playpip](https://github.com/playpip), **open source**, and under
active development. It's a pure front-end app: no backend, no accounts, no tracking —
everything runs in the browser and persists locally. The engine is deterministic
and fully unit-tested, so anyone can read exactly how a hand is dealt and shuffled —
provably fair by inspection, not by promise. The product docs in [`docs/`](docs/README.md)
are the source of truth for everything from the [brand](docs/brand.md) to the
[economy](docs/game-flow.md).

Openness is a deliberate foundation: as Pip grows to include things you can pay for
(cosmetics and extras — never pay-to-win) and social/multiplayer play, a public
codebase is what keeps the anti-scam promise honest. Contributions welcome.

Play money only, forever — chips are never a currency, and nothing is for sale.

*Keywords: poker · texas hold'em · sit-and-go · tournament · play money ·
single player · card game · next.js · react · typescript*
