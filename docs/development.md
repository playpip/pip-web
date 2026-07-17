# Development

## Prerequisites

- **Node** ≥ 20 (built on 22).
- **pnpm** (the only supported package manager here).

> Install everything with pnpm and **do not hand-pin versions** — install latest and let
> pnpm resolve. pnpm's build-script approvals live in `pnpm-workspace.yaml`
> (`allowBuilds` / `onlyBuiltDependencies` for `esbuild`, `sharp`, `unrs-resolver`).

## Scripts

```bash
pnpm dev         # Next dev server (Turbopack) → http://localhost:3000
pnpm build       # production build
pnpm start       # serve the production build
pnpm lint        # biome lint (must be clean — 0 errors)
pnpm lint:fix    # biome — apply safe + unsafe fixes
pnpm format      # biome — format + safe fixes, in place
pnpm typecheck   # tsc --noEmit
pnpm test        # AVA — the engine test suite
pnpm test:all    # scripts/test.sh — format, types, lint, AVA, knip, audit
pnpm sim         # difficulty simulation (scripts/sim.ts) — see below
```

Before considering a change done: **`pnpm test:all` should pass** (it runs the format
check, typecheck, lint, AVA suite, knip unused-code check, and dependency audit), and
for anything structural, `pnpm build`.

### The difficulty simulator

`pnpm sim` plays full sit-and-go tournaments with a proxy human against each
venue's real AI (real engine, blinds, escalation) and reports win rates — the
tool for tuning any `AiProfile` or pacing knob in `config/venues.ts`. Change a
knob, re-run, compare against the "fair" column (1/seats). Deterministic per seed.

```bash
pnpm sim                       # kitchen + the ladder (competent hero, n=200)
pnpm sim garage pub            # specific venues; also: ladder | side | all
pnpm sim garage --n 500        # more tournaments = tighter estimate (slower)
pnpm sim --hero casual         # beginner | casual | competent | best
pnpm sim garage --skill 0.4    # trial an AI skill without editing config
```

It's Monte-Carlo-heavy — a venue takes ~2–4 minutes at n=50; high venues
(more `iterations`) take longer. n=50 has roughly a ±7pp margin; use n≥200
for numbers you'll quote.

## Testing (AVA)

Tests are **AVA**, not Vitest. Config in `ava.config.js` runs TypeScript via `tsx`:

```js
export default {
  extensions: ['ts'],
  nodeArguments: ['--import=tsx'],
  workerThreads: false,      // so the tsx loader applies to test files
  files: ['tests/**/*.test.ts'],
}
```

- The package is ESM (`"type": "module"`), which is required for the `tsx` loader to
  resolve a single AVA instance — don't remove it.
- Only the **pure engine** is unit-tested (`tests/{cards,handEval,pots,engine,equity,ai}.test.ts`).
  UI is not unit-tested; verify it by running the app.
- `tests/helpers.ts` → `makeDeck(popOrder)` builds a deck whose `pop()` order is exactly
  `popOrder`, for deterministic scenarios.
- The AI/equity tests are Monte-Carlo and take a few seconds; a whole-run timeout under
  heavy load can flake — re-run `pnpm test` if you see "pending after a timeout".

Add a test for any rules/AI change. Favor invariants (chip conservation, legality)
alongside specific scenarios.

## Conventions & gotchas

- **Colours:** use theme tokens, never hardcoded `white`/`black`. See [design.md](./design.md).
- **`set-state-in-effect`:** no synchronous `setState` inside `useEffect` (a React 19
  rule; enforced by convention here — Biome has no equivalent). Patterns used instead:
  - client-only gate → `useHydrated()` (`useSyncExternalStore`).
  - "seed a form when a dialog opens" → mount the form only while open (`{open && <Form/>}`)
    and initialize its `useState` from the store (see `ProfileDialog`/`SettingsDialog`).
- **pokersolver is CommonJS:** import the default and destructure (`import pkg from
  'pokersolver'; const { Hand } = pkg`), with types in `src/types/pokersolver.d.ts`.
- **No `Date.now()`/`Math.random()` in engine logic that must be deterministic** — pass a
  seeded `Rng`. (They're fine in UI/store code like avatar seeds.)
- **Persisted profile:** changing its shape → bump `PERSIST_VERSION` and add a `migrate`
  branch in `store/profile.ts`.
- **Turbopack root** is pinned in `next.config.ts` so `pnpm-workspace.yaml` isn't mistaken
  for a monorepo root.
- **Images:** venue art uses plain `<img>` (static art; `next/image` adds little for
  these) — Biome's `noImgElement` is off repo-wide. Avatars are inline SVG data URIs.

## Adding a dependency

```bash
pnpm add <pkg>            # runtime
pnpm add -D <pkg>         # dev
```
If pnpm reports ignored build scripts, add the package to `onlyBuiltDependencies` /
`allowBuilds` in `pnpm-workspace.yaml` and re-run `pnpm install`.

## Deploy

Static-friendly Next app; deploys to **Vercel** as-is. `/` is static; `/play/[venue]`
is dynamic. No backend, env vars, or secrets required.

Production domain: **[playpip.io](https://playpip.io)**.
