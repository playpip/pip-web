# Contributing to Pip

Thanks for being here. Pip is a small, open project, and it's better with other people
in it.

## You don't have to write code

Genuinely useful contributions that aren't pull requests:

- **Playtest and report.** Something feels off, a hand looks wrong, a layout breaks on
  your phone — [open an issue](https://github.com/playpip/pip-web/issues). Bugs are gold.
- **Design and UX feedback.** Pip lives or dies on feel. If something's confusing or
  ugly, say so — specifically.
- **Docs.** If a doc lied to you or a step was missing, fixing it helps the next person.
- **Tell someone.** A calm, non-scammy poker app is a hard thing to find. Sharing it is
  a real contribution.

## Running it locally

Requires [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev        # → http://localhost:3000
```

## The one gate

A change is done when **`pnpm test:all` passes** — that's format, types, lint (Biome),
the AVA suite, `knip`, and `audit` in one command. For anything structural, run
`pnpm build` too. The UI isn't unit-tested, so verify visual changes by actually running
the app.

```bash
pnpm test:all
pnpm format     # Biome: format + safe fixes
```

## Where things live

Pip has three layers with hard boundaries — respect them and most PRs review themselves:

1. **Engine** — [`src/lib/poker/`](src/lib/poker). Pure, deterministic, React-free poker.
   Every rule lives here and ships with tests. If you touch a rule, add a test.
2. **Orchestration** — [`src/store/`](src/store). Runs the tournament over time and holds
   the persisted player. No look-and-feel here.
3. **Presentation** — [`src/components/`](src/components), [`src/app/`](src/app). Reads the
   stores. Look-and-feel only — no game rules.

The [`docs/`](docs/README.md) folder is the source of truth for how everything works,
including the [brand voice](docs/brand.md). If you're changing behaviour, read the
relevant doc first.

## Opening a pull request

- Keep it focused — one change per PR is easier to review and to merge.
- Match the surrounding code; `pnpm format` handles the mechanics.
- Explain the *why*, not just the *what*.
- New to the repo? Look for [`good first issue`](https://github.com/playpip/pip-web/labels/good%20first%20issue).

## The non-negotiables

Pip is anti-casino by design. A contribution won't land if it breaks these:

- **Play money only.** No real currency, no `$`, nothing that costs real money, ever.
- **Style, never edge.** Cosmetics and unlocks never affect gameplay. No pay-to-win.
- **No dark patterns.** No ads, no fake urgency, no guilt loops, no nagging.
- **Honest and private.** No accounts, no cookies, no personal data — and we say exactly
  what we count. The marketing has to clear the same bar as the code.

If in doubt, open an issue and ask before building. We'd rather talk first than turn away
good work at the end.
