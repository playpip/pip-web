# CLAUDE.md — agent guide for Pip

**Pip** is a clean, single-player Texas Hold'em web app (play money, no accounts,
desktop-first). GitHub repo: [`playpip/pip-web`](https://github.com/playpip/pip-web).

Full documentation lives in **[`docs/`](./docs/README.md)** — read it before non-trivial
work. This file is the quick-start and the non-negotiables.

## Read first (by task)

| Doing… | Read |
|--------|------|
| Anything | [docs/README.md](./docs/README.md), [docs/architecture.md](./docs/architecture.md) |
| Poker rules / AI | [docs/poker-engine.md](./docs/poker-engine.md) |
| Tournament pacing / economy | [docs/game-flow.md](./docs/game-flow.md) |
| UI / styling | [docs/design.md](./docs/design.md) |
| Copy / naming / tone | [docs/brand.md](./docs/brand.md) |
| Venues / venue art | [docs/venues.md](./docs/venues.md) |
| Setup / testing / conventions | [docs/development.md](./docs/development.md) |

## The three layers (respect the boundaries)

1. **Engine** — `src/lib/poker/`. Pure, deterministic, React-free, unit-tested. Rules live here.
2. **Orchestration** — `src/store/game.ts` (turn pacing, AI timers, economy) + `src/store/profile.ts` (persisted).
3. **Presentation** — `src/components/`, `src/app/`. Reads stores; look & feel only.

Rules change → engine (+ tests). Pacing/money → game store. Looks → components + tokens.

## Non-negotiables

- **Package manager: pnpm.** Never hand-pin versions — install latest, let pnpm resolve.
- **Tests: AVA**, not Vitest. Engine changes ship with tests.
- **Colours: theme tokens only.** Never hardcode `bg-white/…`, `text-black`, etc. Use
  `foreground/<alpha>` for subtle surfaces, `bg-primary`/`text-primary-foreground` for
  emphasis. Must work in **both light and dark**. (See docs/design.md.)
- **No real money framing.** Play-money "chips" only; never show `$`. No casino textures,
  no pop-ups, no dark patterns. (See docs/brand.md.)
- **Determinism in the engine.** Pass a seeded `Rng`; no `Date.now()`/`Math.random()` in
  logic that must be reproducible.
- **Engine stays pure.** No React/store/browser imports in `src/lib/poker/`.
- **Persisted profile changes** → bump `PERSIST_VERSION` + add a `migrate` branch in
  `src/store/profile.ts`.
- **`set-state-in-effect`** (React 19 lint) is enforced — use the patterns in
  docs/development.md (`useHydrated`, mount-form-while-open), not `setState` in `useEffect`.

## Commands / definition of done

```bash
pnpm dev         # http://localhost:3000
pnpm test        # AVA engine suite
pnpm lint        # must be 0 errors
pnpm typecheck   # tsc --noEmit
pnpm build       # for structural changes
```

A change is done when **typecheck + lint + test pass** (and `build` for structural work).
UI isn't unit-tested — verify UI by running the app. Commit/push only when asked.
