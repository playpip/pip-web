# Design System

Pip is **black-first, flat, minimal** — a fintech/tech feel, not a casino. Both light
and dark themes are supported; **dark is the default and the design's home base.**

## Golden rule: use tokens, not hardcoded colours

Do **not** write `bg-white/10`, `text-black`, `border-white/…` etc. — they don't adapt
to light mode. Use theme-aware tokens:

- Text: `text-foreground`, `text-muted-foreground`.
- Subtle surfaces/borders/rings: **`foreground/<alpha>`** (a light tint in dark mode, a
  dark tint in light mode). e.g. `bg-foreground/[0.03]`, `border-foreground/10`,
  `ring-foreground/80`.
- Primary/emphasis (buttons, badges, chips that must pop): **`bg-primary` +
  `text-primary-foreground`** (flips correctly per theme).
- Backdrops meant to stay dark in both themes (win/bust overlay, chips over dark art):
  `bg-black/…` is fine and intentional.

This convention is what makes the app coherent in both themes. When adding UI, follow it.

## Theme tokens

Defined in `src/app/globals.css`:
- shadcn/Tailwind semantic tokens under `:root` (light) and `.dark` (dark). Dark
  `--background` is near-black (`oklch(0.08 0 0)`).
- **Pip brand tokens** (`@theme`, static across themes):
  - `--color-suit-red: #f0574e` — soft coral for ♥/♦ (not fire-engine red).
  - `--color-suit-black: #16161d`, `--color-cardface: #fafafa`, `--color-cardface-ink: #16161d`.
  - `--color-pip: #7c8cf0` — brand accent.
  - `--color-felt: #0a0a0b`.
- Generous radii scale (`--radius-*`), large rounded corners are on-brand.

Theming is via **next-themes** (`class` strategy, `defaultTheme="dark"`,
`ThemeToggle` in the home + table top bars). `useHydrated()` guards client-only reads
to avoid SSR flashes.

## Colour

- **Canvas:** near-black (dark) / near-white (light).
- **Accent:** one at a time. Each **venue** carries its own `accent` (see `config/venues.ts`)
  used for its tier chip.
- **Cards:** white face (`bg-cardface`) with coral-red or ink pips. Shadow is
  theme-aware — soft in light, deeper on the dark table.
- **Card backs:** user-customizable colour + pattern (muted, Notion-style palette). See
  `config/cardBacks.ts` and `components/CardBack.tsx`.

## Typography

- **Geist** (sans) + **Geist Mono**, wired as `--font-sans` / `--font-mono`.
- Numbers use `tabular-nums` (stacks, pot, Roll) so they don't jitter when animating.
- Headings are tight (`tracking-tight`), lowercase for the `pip` wordmark.

## Motion (Framer Motion)

Subtle, physical, purposeful:
- **Cards** deal in with a slight arc + spring + stagger (`DealtCard`).
- **Numbers** count up/down (`CountUp`) instead of snapping — Roll, pot, stacks.
- **Buttons** have spring press states; the active-seat highlight glides; overlays
  fade/zoom in.
- Keep durations short and easing spring-like. Nothing gratuitous.

## Sound (`src/lib/sound.ts`)

Clean, minimal SFX **synthesised with the Web Audio API** (no asset files) — tactile
blips in keeping with the anti-casino aesthetic, not casino jingles.
- `sound.play(cue)` where cue ∈ `deal, check, call, bet, raise, fold, allin, win, lose,
  tap, turn`. Debounced; respects a global mute (`sound.setMuted`).
- The interface is intentionally generic so real samples (via the already-installed
  `howler`) can be swapped in later without touching callers.

## Layout patterns

- **Desktop-first.** Home: a compact Roll hero + a card-grid main menu (The Daily, The
  Rail, Venues, Side Tables, the Chip Shop). Tapping a section opens its own page
  (`/game/ladder`, `/game/rail`, `/game/side`) via `SectionScreen` — an iOS-style back
  header; venue pages show a responsive grid on desktop, a vertical list on mobile.
- **Table:** opponents arranged around a minimal arc (computed via ellipse math in
  `Table.tsx`), community + pot dead-center, the hero anchored bottom-center with the
  action bar. No felt, no table graphic — just the players and cards on the canvas.
- **Cards:** `PlayingCard` (face, sizes `sm|md|lg`), `DealtCard` (animated), `CardBack`
  (customizable face-down). Ten renders as "10" though the engine uses `T`.

## Components inventory

- Menu: `Home`, `VenueArt` (image with SVG fallback).
- Onboarding/profile: `Onboarding`, `AvatarEditor` (shared), `ProfileDialog`,
  `ChipsDialog` (award collection), `StatsDialog` (lifetime stats + the Roll graph).
- Settings: `SettingsDialog` (card-back picker + profile backup/restore).
- Table: `Table`, `ActionBar` (fold / check·call / bet·raise + sizer with ½·¾·Pot·Max),
  `HandHistoryDialog` (last-hand timeline).
- Primitives: `PlayerAvatar`, `PlayingCard`, `CardBack`, `CountUp`, `AwardChip`,
  `RollGraph` (hand-rolled smoothed SVG area chart), `ThemeToggle`,
  shadcn `ui/button`, `ui/dialog`.

## Adding UI — checklist

1. Use theme tokens (see the golden rule). Test both light and dark.
2. `tabular-nums` for any animating number.
3. Fire an appropriate `sound.play(...)` cue on meaningful actions.
4. Prefer Framer Motion for enter/exit and value transitions; keep it subtle.
5. Respect the brand: flat, one accent, no `$`, no casino textures.
