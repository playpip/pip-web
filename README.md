<img src="docs/assets/pip-logo.png" width="72" alt="pip logo" />

# pip

**Casual poker, redesigned.** Pip is a clean, single-player Texas Hold'em web app —
play money, no accounts, no pop-ups, no fake felt.

Free poker apps tend to look and feel like a scam: neon, leather textures, coin
jingles, and more time spent closing offers than playing cards. Pip is the opposite —
a flat, calm, black-first table where the poker is the whole product.

## How it plays

- **The venue ladder** — ten winner-take-all sit-and-go tournaments, from the
  100-chip *Friends' Garage* to the 1,000,000-chip *Main Event*. The buy-in is your
  starting stack; win the table, take the prize, climb.
- **Blinds escalate** — levels rise every few hands, so tournaments always end.
- **Real opponents (almost)** — AI players with per-venue difficulty, personalities,
  and bios. Higher venues play tighter, more aggressive, and more bluff-aware.
- **Broke? Win your way back** — there's no free top-up. *The Kitchen Table* freeroll
  opens when you can't afford the Garage: beat one soft opponent heads-up and the
  winner's stake buys you back onto the ladder.
- **Ambient help** — live win-% equity, hand strength, and a reviewable last-hand
  history. Informative, never nagging.
- **Yours, locally** — your profile, Roll (bankroll), rank, and card-back live in
  localStorage. No login, no server, no tracking.
- Light and dark themes, quiet tactile sound, desktop and mobile layouts.

Play money only: balances are **chips**, never a currency, and nothing is for sale.

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
| `pnpm test` | AVA suite for the poker engine |
| `pnpm lint` | ESLint (must be 0 errors) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | Production build |

A change is done when **typecheck + lint + test pass** (and `build` for structural
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
| [game-flow.md](docs/game-flow.md) | The tournament loop, economy, ranks, the freeroll |
| [venues.md](docs/venues.md) | The venue ladder and venue art |
| [design.md](docs/design.md) | Theme tokens, typography, motion, sound |
| [brand.md](docs/brand.md) | The name, the voice, the anti-casino principles |
| [development.md](docs/development.md) | Setup, testing, conventions, gotchas |

Agents working in this repo should start with [`CLAUDE.md`](CLAUDE.md) /
[`AGENTS.md`](AGENTS.md).
