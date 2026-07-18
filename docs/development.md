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
  The one deliberate exception is `QrCode.tsx` (fixed white card for camera
  scannability) — see [data-and-offline.md](./data-and-offline.md#qr-scan-to-phone).
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
  branch in `store/profile.ts`. The profile is portable (file / code / QR) via one
  shared envelope — see [data-and-offline.md](./data-and-offline.md).
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

## Deploy & releases

**Cloudflare Pages, pure static.** `next.config.ts` sets `output: 'export'`, so
`pnpm build` writes the whole site to `out/` as plain files — no server, no env
vars, no secrets at runtime. Every route prerenders: `/play/[venue]` enumerates
its paths via `generateStaticParams` (all venues are known config), and
`app/manifest.ts` opts in with `dynamic = 'force-static'`.

Pushes to `main` deploy automatically via
`.github/workflows/deploy-cloudflare-pages.yaml`: the full `test:all` gate runs
first, then `wrangler pages deploy out` publishes. The workflow needs two repo
secrets — `CLOUDFLARE_API_TOKEN` (a token with the *Cloudflare Pages — Edit*
permission) and `CLOUDFLARE_ACCOUNT_ID` — and a Pages project named `pip-web`.

Production domain: **[playpip.io](https://playpip.io)**.

### Automatic releases

The same workflow cuts a release on every push to `main`, after a green gate +
successful deploy:

- **Version** auto-bumps — **patch by default**; put `#minor` or `#major` anywhere
  in the commit message to bump harder (`#major` wins if both appear).
- The bump is **committed before the build**, so the deployed PWA reports the new
  version and its build id is the release commit.
- Then it **tags `vX.Y.Z`, pushes it, and publishes a GitHub Release** with
  auto-generated notes (diffed from the previous release).

Notes:

- No infinite loop: the bump commit is pushed with the default `GITHUB_TOKEN`
  (which doesn't retrigger workflows) and carries `[skip ci]` as belt-and-braces.
  The workflow declares `permissions: contents: write` and checks out with
  `fetch-depth: 0` (needed to push and to diff release notes).
- A manual `workflow_dispatch` run **redeploys the current version** — no bump, no
  release (the release steps are gated to `push` events).
- This pushes **directly to `main`** — if you add branch protection that blocks
  everyone, exempt the `github-actions` bot or move to a Release-PR model.

### Versioning & cache-busting

Two values are injected at build (`next.config.ts` → `env`) and inlined into the
client bundle:

- `NEXT_PUBLIC_APP_VERSION` — the human version, read from `package.json`. Shown in
  the Settings footer (`Pip v0.1.0 · <build id>`).
- `NEXT_PUBLIC_BUILD_ID` — the git short SHA. Uniquely identifies each deploy.

The service worker's cache name is `pip-__BUILD_ID__`; `scripts/stamp-sw.mjs` (run
by `pnpm build`, after `next build`) stamps the git short SHA into `out/sw.js`. So
**every deploy ships a byte-different `sw.js`** → the browser installs a new worker
→ `activate` purges the old cache. That's the cache-bust.

On an update the new worker **waits** rather than taking over silently.
`useServiceWorkerUpdate` (registered from `UpdatePrompt`, mounted in the root
layout) detects the waiting worker — re-checking hourly and whenever the tab regains
focus — and shows a "new version is ready → Reload" nudge. Reload posts
`SKIP_WAITING`; the worker activates and the page reloads onto the new assets. See
[data-and-offline.md](./data-and-offline.md#offline-the-service-worker) for the
offline caching strategy itself.
