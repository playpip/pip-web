# Pip — Documentation

**Pip** is a clean, modern, single-player Texas Hold'em web app — casual poker,
redesigned. No fake felt, no neon, no pop-ups. You play a local bankroll (your
**Roll**) up a ladder of venues against increasingly sharp AI.

It is inspired by [Offsuit](https://offsuit.app/) but is its own product: desktop-first,
account-free, fully local, free (no real money — chips are play money), and **open
source** — the deterministic engine is public, so the game is provably fair by
inspection. Openness is the trust foundation for everything we add later (paid
cosmetics, multiplayer); see [brand.md](./brand.md).

## Docs index

| Doc | What's in it |
|-----|--------------|
| [architecture.md](./architecture.md) | Stack, directory layout, data-flow, key design decisions |
| [poker-engine.md](./poker-engine.md) | The pure, tested poker engine (cards, hand eval, pots, betting, equity, AI) |
| [game-flow.md](./game-flow.md) | Runtime orchestration: the game store, the tournament loop, the economy, ranks, the freeroll |
| [brand.md](./brand.md) | The Pip brand — name, voice, positioning |
| [awards.md](./awards.md) | Collectible "special chips" awards — the set, triggers, visuals |
| [design.md](./design.md) | Design system: theme tokens, colour, typography, motion, sound, components |
| [venues.md](./venues.md) | The venue ladder, adding venues, and the AI-image workflow |
| [development.md](./development.md) | Setup, scripts, testing (AVA), conventions, gotchas |

## 30-second mental model

- **Pure engine** (`src/lib/poker/`) — framework-free, deterministic, exhaustively
  unit-tested. Knows nothing about React. This is the source of truth for rules.
- **Stores** (`src/store/`) — Zustand. `profile` is persisted (localStorage);
  `game` is transient orchestration that drives the engine and paces AI turns.
- **UI** (`src/components/`, `src/app/`) — Next.js App Router, Tailwind, shadcn/ui
  (Base UI), Framer Motion. Presentational; reads stores.

If you change rules, you change the engine (and its tests). If you change how a
hand *plays out over time* (pacing, transitions, economy), you change the game store.
If you change how it *looks*, you stay in components + theme tokens.

## Status & scope

- **In scope / built:** onboarding, avatar creator, the Roll + venue ladder,
  full Hold'em vs AI, sit-and-go tournaments with a bankroll/rank economy + selectable currency, live equity, sound, motion, theming,
  card-back customization.
- **Explicitly out of scope (for now):** online multiplayer, accounts, real money,
  cash games, non-Hold'em variants.
- See the repo root [`PLAN.md`](../PLAN.md) for the original plan and rationale.
