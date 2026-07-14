# Architecture

## Stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | **Next.js (App Router)** + React 19 + TypeScript | Desktop-first; mostly client components |
| Styling | **Tailwind CSS v4** | Theme via CSS variables (`globals.css`) |
| Components | **shadcn/ui** on **Base UI** (`@base-ui/react`) | `src/components/ui/` |
| Animation | **Framer Motion** | Card deals, count-ups, transitions, overlays |
| State | **Zustand** | `profile` (persisted) + `game` (transient) |
| Icons | **lucide-react** | |
| Avatars | **DiceBear** `notionists` (`@dicebear/core` + `/collection`) | Rendered locally to SVG, offline |
| Hand ranking | **pokersolver** | Wrapped in `handEval.ts`; typed via `src/types/pokersolver.d.ts` |
| Sound | **Web Audio** (custom synth) | `src/lib/sound.ts`; `howler` is installed but the current SFX are synthesised |
| Theming | **next-themes** | class strategy, dark default |
| Tests | **AVA** (via `tsx`) | Engine only; see [development.md](./development.md) |

Everything is installed with **pnpm**. Do not hand-pin versions — install latest and
let pnpm resolve.

## Directory layout

```
src/
  app/                      # Next.js routes
    layout.tsx              # fonts, ThemeProvider, <html>
    page.tsx                # "/" — onboarding vs home (hydration-gated)
    play/[venue]/page.tsx   # sits the player down at a venue, renders <Table>
    globals.css             # Tailwind + theme tokens (light/dark + pip palette)

  lib/poker/                # ── PURE ENGINE (no React, unit-tested) ──
    cards.ts                # Card types, deck, seeded RNG (mulberry32), shuffle
    handEval.ts             # typed wrapper over pokersolver; winner determination
    pots.ts                 # main + side pot construction
    engine.ts               # betting state machine: blinds, streets, actions, showdown
    equity.ts               # Monte-Carlo equity (win %)
    ai/policy.ts            # heuristic AI decision policy (equity + pot odds + personality)

  lib/
    avatar.ts               # notionists render helpers + seeds
    sound.ts                # Web Audio SFX engine (cue-based)
    useHydrated.ts          # SSR-safe client-only gate (useSyncExternalStore)
    utils.ts                # cn() (clsx + tailwind-merge)

  config/
    venues.ts               # the venue ladder (buy-ins, blinds, prizes, AI profiles)
    names.ts                # AI opponent name pool
    cardBacks.ts            # card-back colours + patterns
    currencies.ts           # selectable display currencies
    ranks.ts                # rank titles (by peak Roll) + top-up amount

  store/
    profile.ts              # PERSISTED: name, avatar, Roll, peakRoll, currency, stats, cardBack (versioned)
    game.ts                 # TRANSIENT: current hand, seats, AI pacing, equity, economy

  components/
    menu/                   # Home (Roll hero + venue slider), VenueArt
    onboarding/             # first-launch flow
    profile/                # AvatarEditor (shared), ProfileDialog
    settings/               # SettingsDialog (card-back customization)
    table/                  # Table, ActionBar
    ui/                     # shadcn primitives (button, dialog)
    PlayingCard.tsx, CardBack.tsx, PlayerAvatar.tsx, CountUp.tsx,
    ThemeToggle.tsx, theme-provider.tsx

  types/pokersolver.d.ts    # ambient types for the CJS pokersolver module

tests/                      # AVA specs for the engine + a deck helper
public/venues/              # generated venue art (garage.jpg … mainevent.jpg)
```

## The three layers (and the rule for touching them)

1. **Engine** (`lib/poker/`) — pure functions + a `HandState` value. Deterministic
   given a seeded RNG. Portable to a server. **Rules live here.** Never import React
   or stores here.
2. **Orchestration** (`store/game.ts`) — wraps the engine to run a *sit-and-go tournament over
   time*: seats a human + AI, paces AI turns with timers, computes the human's ambient
   equity, resolves the economy. **Time, pacing, and money live here.**
3. **Presentation** (`components/`, `app/`) — reads stores, renders. **Look & feel
   live here.** Uses theme tokens, not hardcoded colours (see [design.md](./design.md)).

## Data flow (a hand)

```
play/[venue]/page.tsx
  └─ useGame.sitDown(venue, human)                 // pay buy-in; everyone stacks = buy-in
       └─ startHand(...)  (engine)                 // deal, blinds
            └─ progress()                          // whose turn?
                 ├─ human → compute equity, wait for act()
                 └─ AI    → setTimeout → decideAction() → applyAction() → progress()
       └─ hand complete → finishHand()             // eliminate busts; next hand OR bust/win
```

The engine is synchronous and pure. The *store* adds the asynchronous, stateful
choreography (timers, sounds, transitions) on top.

## Key decisions & rationale

- **Pure engine, delegated ranking.** We own the fiddly, bug-prone parts (betting
  flow, side pots, blinds) and unit-test them hard; we delegate 5-from-7 hand ranking
  to `pokersolver` to de-risk. Winner logic and pot math are ours and tested.
- **Deterministic RNG.** `mulberry32(seed)` makes shuffles and equity reproducible,
  which is what makes the engine testable. Production uses `Math.random`.
- **Local-only persistence.** Only `profile` is persisted (localStorage, versioned
  with a migration hook) — a clean seam to swap for a backend later.
- **AI on the main thread.** Equity sims (up to ~1800 iters) run synchronously inside
  the AI's turn timer. Fine today; the obvious future optimization is a Web Worker.
- **Account-free, no real money.** Chips are play money; the display currency is a
  cosmetic per-player choice (`config/currencies.ts`, `useMoney()`).

## Known limitations / future work

- AI equity is main-thread (see above) → Web Worker candidate.
- SFX are synthesised; `howler` is present to swap in real samples without touching callers.
- No hand-history / detailed-stats screen yet (lifetime counters are tracked in `profile`).
- Opponent hole cards are revealed only at showdown (hidden during play).
- Blinds are fixed — no tournament blind escalation yet.
