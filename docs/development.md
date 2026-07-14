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
pnpm lint        # eslint (must be clean — 0 errors)
pnpm typecheck   # tsc --noEmit
pnpm test        # AVA — the engine test suite
```

Before considering a change done: **`pnpm typecheck`, `pnpm lint`, and `pnpm test`
should all pass**, and for anything structural, `pnpm build`.

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
- **`set-state-in-effect`:** the ESLint rule (React 19) forbids synchronous `setState`
  inside `useEffect`. Patterns used here instead:
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
- **Images:** venue art uses `<img>` with an eslint-disable (data/So static art; `next/image`
  adds little for these). Avatars are inline SVG data URIs.

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
