# AGENTS.md

Guidance for AI agents working in this repo (Pip — a clean single-player Texas
Hold'em web app). This mirrors [`CLAUDE.md`](./CLAUDE.md); full docs are in
[`docs/`](./docs/README.md). Read the relevant doc before non-trivial work.

## Orientation

- **What it is:** play-money, account-free, desktop-first Hold'em vs AI. GitHub repo:
  [`playpip/pip-web`](https://github.com/playpip/pip-web).
- **Three layers** (don't cross the boundaries):
  1. `src/lib/poker/` — pure, deterministic, unit-tested engine (the rules).
  2. `src/store/` — `game.ts` (pacing/AI/economy), `profile.ts` (persisted).
  3. `src/components/`, `src/app/` — presentation only.

## Where to read

- Overview & layout → [docs/architecture.md](./docs/architecture.md)
- Poker rules / AI → [docs/poker-engine.md](./docs/poker-engine.md)
- Tournament flow / economy → [docs/game-flow.md](./docs/game-flow.md)
- Design system & tokens → [docs/design.md](./docs/design.md)
- Brand / voice → [docs/brand.md](./docs/brand.md)
- Venues & venue art → [docs/venues.md](./docs/venues.md)
- Setup, testing, conventions → [docs/development.md](./docs/development.md)

## Non-negotiables

- **pnpm** for everything; never hand-pin versions.
- **AVA** for tests (not Vitest); engine changes ship with tests.
- **Theme tokens only** for colour (`foreground/<alpha>`, `bg-primary`) — must work in
  light *and* dark. Never hardcode `white`/`black`.
- **No real-money framing:** "chips", never `$`; no casino textures or pop-ups.
- **Engine is pure & deterministic** (seeded `Rng`; no React/store imports).
- **Persisted-schema changes** bump `PERSIST_VERSION` + add a migration.
- Obey the **`set-state-in-effect`** lint rule (see docs/development.md).

## Definition of done

`pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass (plus `pnpm build` for
structural changes). Verify UI by running `pnpm dev`. Commit/push only when asked.
