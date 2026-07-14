# Clean Poker — a clean, iOS-styled Texas Hold'em for the web

A web poker app **inspired by** [Offsuit](https://offsuit.app/) — clean, modern,
no-nonsense, iOS design sensibility — but with our own name, twist, and a
**desktop-first** experience (Offsuit is phone-only, so this is greenfield).

Personal project for now; may ship if it turns out cool.

---

## Locked decisions

| # | Decision |
|---|----------|
| Scope | **Offline single-player vs AI.** No backend, no accounts, no multiplayer for now. |
| Vibe | **Inspired by** Offsuit (clean, minimal, iOS, no fake felt/neon) — **own name & branding**. |
| Platform | **Desktop-first** web. (Still responsive-friendly, but designed for desktop.) |
| Money | **Free & fully local.** All state in the browser. Monetization deferred. |
| Structure | **Tournament-tier menu** — pick a venue from low to high stakes; higher buy-in = tougher AI. |
| Variant | **Texas Hold'em only.** |
| Persistence | Local (localStorage/IndexedDB) — bankroll, progress, stats, unlocked venues. |

### Tooling constraints (from you)
- **pnpm** for everything. `pnpm dlx create-next-app`, `pnpm add …`.
- **No assumed versions** — always install latest and let pnpm resolve. Nothing pinned from memory.
- **Tests: [AVA](https://github.com/avajs/ava), not Vitest.** Engine gets a real AVA suite.

## Name — **Shove**

> **Update (July 2026): renamed to Pip** — a pip is the suit symbol printed on a card.
> Shove turned out to be insider slang that casual players didn't get. See
> [docs/brand.md](./docs/brand.md).

Going with **Shove** (lowercase wordmark: `shove`).

Why it works: it's a real poker action (going all-in), one punchy syllable, reads as a
verb like the modern one-word brands it'll sit next to (Ramp, Cash, Robinhood). It also
*means* the game loop — you shove your stack, take the risk, and climb the venue ladder.
Calm, minimal UI + a bold short name is a good contrast. Lowercase wordmark, one accent
color, memoji-ish mascot.

Backups if you veto: **Muck**, **Rounder**, **Case**. (Repo can stay `clean-poker`;
the product brand is Shove.)

---

## 1. What we're borrowing from Offsuit (design DNA)

From the screenshots, the system we're recreating (in spirit):

- **Pure black canvas.** No felt, no gradients, no casino skeuomorphism.
- **Cards = white, heavily-rounded rects** — big rank + small suit pip; red suits are
  a soft coral, not fire-engine red. **Face-down = diagonal hatch**, not a decorative back.
- **Player row** with avatar, first name, chip count; folded/inactive dim to grey; a
  small **"D"** = dealer button.
- **Pot as a plain number**; **actions as pill buttons** (`Call 16`, `Raise 32`, a
  compact bet-sizer control); fold as a third control.
- **Ambient stats**: a hand-strength card ("High Card" + equity number) — helpful info
  presented calmly, never as pop-ups.
- Clean geometric sans, generous spacing, **monochrome + one accent**, spring-y motion.
  Reads like a fintech app, not a casino.

**Desktop adaptation:** the phone shows one perspective (your seat at bottom). On
desktop we have room — I'd lay opponents around a minimal **arc/oval table** (still
black, still flat, no felt), keep your hole cards + action pills anchored bottom-center,
and put ambient stats and pot in the negative space. We keep the flat card + hatch-back
+ pill language exactly; we just use the extra width instead of stacking vertically.

## 2. The menu = tournament venues (the entry experience)

A super clean home/menu — a ladder of venues, low → high stakes, each with a bigger
buy-in and **tougher, more sophisticated AI**. You grind a local bankroll to unlock the
next rung. Illustrative ladder (names TBD):

1. **Friends' Garage** — micro buy-in, loose/passive AI that makes obvious mistakes.
2. **The Basement / Local Bar** — small stakes, semi-loose AI.
3. **The Card Room** — mid stakes, tighter/positional AI.
4. **Downtown Casino** — high stakes, aggressive, bluff-aware AI.
5. **Vegas / The Championship** — top tier, near-optimal AI with balanced ranges & bluffs.

Each venue defines a config bundle: buy-in, blind structure, seat count, and an **AI
difficulty profile**. Unlock state, best finishes, and bankroll persist locally. This is
the progression spine of the app and the first screen we design.

## 2.5 The economy — your Roll, venues & never getting stuck

This resolves your homescreen + progression idea into a concrete loop.

**The home screen hero is your Roll** — one big number at the top (your total bankroll),
styled like the pot. Everything else on the menu is the venue ladder beneath it.

**Each venue = a sit-and-go tournament** with a fixed **buy-in**:

| Venue | Buy-in | Feel of the AI |
|-------|--------|----------------|
| Friends' Garage | **Free (freeroll)** | loose/passive, obvious mistakes |
| The Basement | 100 | small stakes, semi-loose |
| The Card Room | 500 | tighter, positional |
| Downtown Casino | 2,500 | aggressive, bluff-aware |
| Vegas / Championship | 10,000 | balanced ranges, semi-bluffs, traps |

*(Numbers illustrative — we'll tune. You start with a small seed Roll, e.g. 500.)*

**The loop:**
1. Pick a venue you can afford. Its buy-in is **deducted from your Roll**; you sit down
   with that stack.
2. Play the sit-and-go vs AI. **Cash/win → payout added back to your Roll.** Bust → you
   lose the buy-in.
3. **Re-entry:** bust but Roll still covers the buy-in? Re-enter freely. Can't afford it?
   You're out of that venue — drop to one you can afford.
4. **Unlocks:** a venue appears the moment your Roll can cover its buy-in (with a light
   *bankroll-management* nudge — we warn if you're about to sit down with your whole Roll).

**Never getting stuck (your zero-out question).** The bottom venue — **Friends' Garage —
is a permanent free freeroll**: 0 buy-in, small guaranteed prize pool. So no matter how
broke you go, you can always sit down for free and grind your Roll back up to the next
rung. This is the elegant, on-brand answer: no paywall, no daily-timer gacha, no dead end
— it fits the anti-scam ethos. (Optional convenience we *could* add later: a small daily
top-up. Off by default; the freeroll is the real safety net.)

This makes the ladder self-balancing: skill lets you climb; variance can knock you down;
the freeroll guarantees you're never permanently out. That's the whole single-player arc.

## 2.6 First launch (onboarding) & persistence

**First launch — make your player.** No accounts, no login. On first open we show a small
onboarding flow:
1. **Design your avatar** — an in-app `notionists` avatar creator: pick/shuffle options
   (hair, glasses, etc. that the style exposes), live preview. We store the chosen options
   (or a seed), not an image.
2. **Choose a name** — your display name at the table.
3. Seed your starting Roll and drop you on the home screen.

You can re-edit avatar/name later from settings.

**AI opponents get random avatars + names** — each opponent is spun up from a random
`notionists` seed and a name pulled from a bundled name pool, so tables always look varied
and consistent per-opponent within a session.

**Persistence — yes, local for now.** Everything lives in the browser:
- **`localStorage`** (via a small typed wrapper / Zustand `persist` middleware) for the
  core profile & progression: avatar options, name, **Roll**, unlocked venues, best
  finishes, and lifetime stats (VPIP/PFR/etc). It's small, synchronous, and plenty.
- We keep a **versioned schema** with a migration hook from day one, so we can evolve the
  save format without wiping people's progress — and so it's a clean seam to swap for a
  real backend later if we ever add accounts/multiplayer.
- (If hand-history logs ever get large, we can move just those to **IndexedDB**; not needed
  for MVP.)

## 3. AI approach — grounded

**There is no drop-in "good poker bot" npm library.** Serious poker AI (Pluribus etc.)
is research-grade C++/GPU work, not a package you install. So we **build the AI
ourselves** on top of a fast, proven **equity engine**, and scale sophistication per venue.

Building blocks:
- **Hand strength + equity** via Monte-Carlo: simulate N random run-outs (≈1,000/decision
  is plenty and fast) using a fast evaluator to get win %. This also powers the ambient
  "win %" stat for the human.
- **Decision policy** layered on equity:
  - Pot odds vs. equity (call/fold threshold).
  - Position, number of players, street.
  - Bet sizing relative to pot; raise/3-bet logic.
  - **Personality knobs per venue/opponent**: aggression, bluff frequency, tightness,
    tilt/variance — so low venues feel loose & exploitable and high venues feel sharp.
  - Randomization so opponents aren't deterministic/readable.
- **Difficulty = which knobs + how much lookahead.** Garage AI: high equity threshold,
  no bluffs, obvious sizing. Vegas AI: balanced ranges, semi-bluffs, position-aware
  aggression, occasional traps.

This is genuinely "semi-sophisticated and realistic" without needing a solver. If we
later want more, we can add opponent-modeling (tracking the human's VPIP/PFR and adapting).

## 4. Hand evaluator (this was open question #6 you weren't sure about)

The "hand evaluator" is just the code that, given 7 cards, computes the best 5-card poker
hand and decides who wins (including kickers and split pots). It's the mathematical heart
of poker and is fiddly to get 100% right — so **we use a battle-tested library rather than
hand-roll it**. Candidates (all on npm):

- **`pokersolver`** — most widely used, human-friendly API, handles Hold'em + winner
  determination. Great default for correctness & speed-to-build.
- **`@pokertools/evaluator`** — O(1) lookup-table evaluator built for **Monte-Carlo /
  real-time**; fastest for our AI equity loop.

**Plan:** use `pokersolver` for showdown/winner logic (clear + correct), and a fast
evaluator (`@pokertools/evaluator` or `poker-evaluator`) inside the Monte-Carlo equity
loop where speed matters. We'll benchmark and possibly consolidate on one. Either way,
**we don't write the 7-card ranking math ourselves.** We still own — and AVA-test — the
**betting state machine, pot/side-pot construction, and blind/street flow**, which is
where our real game logic lives.

## 5. Assets

- **Player avatars:** **[DiceBear](https://www.dicebear.com/) `notionists` style** (locked)
  — MIT, free, no account, **seed-driven** (same seed + options → same avatar, so we store
  a small string/options object, never an image). Clean line-art look that fits the minimal
  flat UI. We'll use the local `@dicebear/core` + `@dicebear/collection` packages (render to
  SVG in-app) rather than the HTTP API, so avatars work offline and there's no network call.
- **Playing cards:** **render in code (SVG/React components), not image files.** The
  Offsuit cards are literally a rank + a suit pip on a rounded white rectangle — trivial
  and crisp to draw as components, infinitely scalable, themeable (coral red / black),
  and the diagonal-hatch back is a CSS/SVG pattern. No sprite sheets, no licensing.
- **Chips / pot:** simple flat tokens or just numbers, matching Offsuit's number-forward
  style. Drawn in code.
- **Icons:** `lucide-react` (ships with shadcn).
- **Font:** SF-style system stack with **Inter** web fallback.

Net: **no purchased/downloaded art needed** — everything is code-drawn or seed-generated.

## 5.5 Sound & motion (feel)

Two pillars of the "expensive, clean, modern" feel — both first-class, not afterthoughts.

**Sound design** — clean, minimal, tactile (think iOS / fintech UI sounds, not casino jingles):
- **Engine:** [Howler.js](https://howlerjs.com/) (tiny, reliable, preloading, volume/mute,
  sprite support) behind a small `useSound`/`sfx` wrapper so any component can fire a cue.
- **Cue set (MVP):** card deal/slide, chip bet/call, check tap, fold, raise/all-in whoosh,
  pot-won shuffle, your-turn soft chime, button tap, win/lose sting. Kept short & subtle.
- **Assets:** curated **CC0 / royalty-free** UI clicks + poker foley (deal, chips), lightly
  processed for consistency; bundled locally (no CDN). A **global mute + volume** in
  settings, respected everywhere, and we honour `prefers-reduced-motion` for the visual side.
- Sounds are **debounced/pooled** so rapid actions don't stack harshly.

**Motion** — subtle, physical, Framer Motion throughout:
- **Cards:** deal in with a slight arc + spring + stagger; flip on reveal; muck slides out.
- **Chips / pot:** bets animate to the pot; pot slides to the winner on showdown.
- **Actions:** pill buttons have spring press states; the active-player highlight glides
  seat to seat; bet-sizer is a smooth draggable.
- **Numbers:** Roll / stack / pot values **count up/down** rather than snapping.
- **Screens:** menu ↔ table transitions with shared-layout (`layoutId`) where it reads well.
- **Principles:** short durations, spring easing, nothing gratuitous; everything gated by
  `prefers-reduced-motion`. Timing is coordinated with the matching SFX cue so sound + motion
  land together.

## 6. Technical architecture

**Stack**
- **Next.js (App Router) + TypeScript** — desktop-first.
- **Tailwind + shadcn/ui** (Button, Dialog, Sheet, Slider, Tabs, Tooltip, Avatar),
  restyled to the black/rounded look.
- **Framer Motion** — deals, chip moves, action feedback (iOS spring feel).
- **Zustand** for UI/game state; **the poker engine stays a pure, framework-free module**
  so it's testable and portable if we ever add a server.
- **AVA** for engine unit tests.
- Hand eval via `pokersolver` (+ a fast evaluator for equity). DiceBear for avatars.
- Deploy on **Vercel**. Everything installed via **pnpm**, latest versions.

**Structure**
```
src/
  lib/poker/            # PURE engine, zero React, AVA-tested
    cards.ts            # deck, shuffle, Card type
    handEval.ts         # thin wrapper over pokersolver (winner, ranking)
    equity.ts           # Monte-Carlo equity via fast evaluator
    gameEngine.ts       # state machine: blinds, streets, betting, pots/side-pots
    ai/                 # decision policy + per-venue personality profiles
    stats.ts            # VPIP/PFR/etc from the hand log
  config/venues.ts      # the tournament ladder (buy-ins, blinds, AI profiles)
  store/                # Zustand: engine <-> UI
  lib/avatar.ts         # notionists render + random-seed helpers (dicebear)
  components/
    onboarding/         # first-launch avatar creator + name
    menu/               # venue ladder, Roll hero / progress home base
    table/              # Table, CommunityCards, Pot, SeatRow, Seat
    cards/              # PlayingCard (SVG face + hatch back), HoleCards
    actions/            # ActionBar (Call/Raise pills), BetSizer
    stats/              # HandStrength card, live equity
    ui/                 # themed shadcn primitives
  app/                  # / (menu/home base), /play/[venue], /settings
tests/                  # AVA specs for the engine
```

**Design tokens (Tailwind theme):** black bg `~#0A0A0A`; card white `#FAFAFA`; coral red
suit `~#F0574E`; muted grey for folded; one accent for primary action; big radii
(`rounded-2xl/3xl`); soft shadows; SF/Inter font stack.

**Hardest parts (owned by us, well-tested):** betting state machine + side-pot math, and
the AI decision policy. Hand ranking is delegated to a library to de-risk.

## 7. Phased delivery

1. **Scaffold** — `pnpm dlx create-next-app`, Tailwind + shadcn, AVA wired, theme tokens,
   deploy skeleton to Vercel.
2. **Engine** — cards/shuffle, `pokersolver` wrapper, betting state machine, pots/side-pots
   — all with AVA tests. Add Monte-Carlo equity.
3. **Onboarding + menu / venue ladder** — first-launch avatar creator (`notionists`) + name,
   then the clean home base: Roll hero, venues, unlock/progress — all persisted to localStorage.
4. **Table UI (static)** — recreate the Offsuit look on desktop with mock state.
5. **Wire engine → UI** — playable full hand loop vs one basic AI.
6. **AI depth + stats** — per-venue personalities, difficulty scaling, live equity/hand
   strength, 2–6 seats.
7. **Polish** — Framer Motion deals/chips, sound, empty/edge states, responsive niceties.
8. **Persistence + tournaments** — blind escalation, rebuys, finishes, saved stats & progress.

*(Later, explicitly out of scope now: accounts, online multiplayer, cosmetics, monetization.)*

## Future: staking (the paid bridge)

The comeback mechanic today is the **Kitchen Table freeroll** (see docs/game-flow.md) —
broke players win their way back in; there is no free top-up.

The eventual evolution is **staking**, real poker economics: when you're broke, an NPC
backer fronts a buy-in and takes a cut of your prizes until they've made back ~2× their
stake ("Marco spots you 100; he takes half your cashes until he's got 200"). It's
narrative-rich, poker-authentic, and creates the natural slot for money later —
**"buy out your backer"** (or skip the debt) as a paid convenience rather than
pay-to-win chip sales. If money ever enters Pip, it enters here or via cosmetics
(card backs), never as "buy chips" — that's the scam-energy line we don't cross.

## 8. Open questions — status

- ✅ **Name** → **Shove** (§Name); later renamed to **Pip** (see update note in §Name).
- ✅ **Cash vs tournament / bankroll fail state** → resolved in §2.5: each venue is a
  **sit-and-go** with a buy-in; the **Roll** is your homescreen hero; **re-enter while
  funds allow**; the **free Garage freeroll** is the permanent never-stuck safety net.
- ⏳ **Avatar style** — pick your favourite DiceBear style and I'll wire it:
  - Browse all 35+ styles: **https://www.dicebear.com/styles/**
  - Closest to Offsuit's expressive/3D-emoji feel, my shortlist to look at first:
    - `fun-emoji` — https://www.dicebear.com/styles/fun-emoji/
    - `personas` — https://www.dicebear.com/styles/personas/
    - `adventurer` — https://www.dicebear.com/styles/adventurer/
    - `notionists` — https://www.dicebear.com/styles/notionists/
    - `thumbs` — https://www.dicebear.com/styles/thumbs/
  - Tell me the style name and I'll lock it in. (Doesn't block engine work.)

Nothing here blocks phases 1–2 (scaffold + engine) — I can start now and slot the avatar
style in when you pick.

## 9. Way forward

Unless you say otherwise, I'll:
1. Scaffold (Next.js + Tailwind + shadcn + AVA) via pnpm, latest versions, and set theme tokens.
2. Build the **pure engine with AVA tests** (`pokersolver` + Monte-Carlo equity + betting/pot state machine).
3. Come back to you on §8 before designing the menu and table UI.

Say go and I'll start with phases 1–2.

---
*Sources: [offsuit.app](https://offsuit.app/) · [App Store](https://apps.apple.com/us/app/offsuit-texas-holdem-poker/id6446099491) · [Product Hunt](https://www.producthunt.com/products/offsuit-poker) · [pokersolver](https://www.npmjs.com/package/pokersolver) · [@pokertools/evaluator](https://www.npmjs.com/package/@pokertools/evaluator) · [DiceBear](https://www.dicebear.com/) · the three provided screenshots.*
