# Design System

Pip is **black-first, flat, minimal** — a fintech/tech feel, not a casino. **Dark
only.** Light mode was removed on 2026-10-03: the felt, the venue art and the table
finishes were all designed for dark, and light was a second set of rules that never
looked right. The `dark` class is fixed on `<html>` in `app/layout.tsx`.

## Golden rule: use tokens, not hardcoded colours

Do **not** write `bg-white/10`, `text-black`, `border-white/…` etc. — keep colour in
one place so it can be tuned. Use the tokens:

- Text: `text-foreground`, `text-muted-foreground`.
- Subtle surfaces/borders/rings: **`foreground/<alpha>`** (a light tint over the dark
  canvas). e.g. `bg-foreground/[0.03]`, `border-foreground/10`,
  `ring-foreground/80`.
- Primary/emphasis (buttons, badges, chips that must pop): **`bg-primary` +
  `text-primary-foreground`**.
- Backdrops over art (win/bust overlay, chips over venue art): `bg-black/…` is fine and
  intentional.

## Theme tokens

Defined in `src/app/globals.css`:
- shadcn/Tailwind semantic tokens under `:root` (dark values only). `--background` is
  near-black (`oklch(0.08 0 0)`). Older components still carry `dark:` variants; they
  always apply, and the unprefixed classes beside them are dead weight to drop when
  touched.
- **Pip brand tokens** (`@theme`, static across themes):
  - `--color-suit-red: #f0574e` — soft coral for ♥/♦ (not fire-engine red).
  - `--color-suit-black: #16161d`, `--color-cardface: #fafafa`, `--color-cardface-ink: #16161d`.
  - `--color-pip: #7c8cf0` — brand accent.
  - `--color-felt: #0a0a0b`.
  - The table: `--color-table-cloth`, `-rail`, `-rail-edge`, `-line`, `-shade`, and
    the chips `--color-chip-ivory|coral|slate|ink|stripe`. Chip and turn-ring drawing
    lives in `globals.css` (`.table-chip`, `.seat-turn`).
- Generous radii scale (`--radius-*`), large rounded corners are on-brand.

There is no theme provider and no toggle. `useHydrated()` guards client-only reads to
avoid SSR flashes. The owned **table finish** is a fixed backdrop behind every app
screen (`components/FeltBackdrop.tsx`, mounted in the root layout); marketing pages
paint `bg-background` over it and stay plain.

## Colour

- **Canvas:** near-black.
- **Accent:** one at a time. Each **venue** carries its own `accent` (see `config/venues.ts`)
  used for its tier chip.
- **Cards:** white face (`bg-cardface`) with coral-red or ink pips. Deep shadow on the
  dark table.
- **Card backs:** user-customizable colour + pattern (muted, Notion-style palette). See
  `config/cardBacks.ts` and `components/CardBack.tsx`.

## Typography

- **Geist** (sans) + **Geist Mono**, wired as `--font-sans` / `--font-mono`.
- Numbers use `tabular-nums` (stacks, pot, Roll) so they don't jitter when animating.
- Headings are tight (`tracking-tight`), lowercase for the `pip` wordmark.

### Type scale: never size text in px

**Font sizes written in pixels are banned and a test enforces it** (`tests/textScale.test.ts`). Settings has a
text size control that reaches 200% (WCAG 1.4.4, and pinch-zoom is off by ruling), and it works
by multiplying the root font size. Anything in `rem` follows; anything in `px` is frozen, so one
caption left in px stays small while the paragraph around it doubles.

- Tailwind's own sizes (`text-xs` up) are rem already. Use them first.
- Below `text-xs` the app has three tokens, in `globals.css`:
  `text-2xs` (11px), `text-3xs` (10px), plus `text-md` (15px, the reading size on `/learn`).
- A genuine one-off gets an arbitrary **rem** value: `text-[0.8125rem]`, never the px equivalent.
- **The one exception is the card face** (`PlayingCard`). A rank has to stay proportional to
  the card it is drawn on, so the rule there is: rem box -> rem type, `vw` box (the mobile table)
  -> type capped in `vw` via `min()`. The caps are the size the type already has on the narrowest
  phone, so nothing moves at 100%.

### The table stops at 150%

**Reading surfaces go to 200%. `/play/*` caps at 150%** (`TABLE_MAX_TEXT_SCALE` in
`lib/textScale.ts`). Will played a hand at 200% on a phone and it does not hold: 150% is just
about playable, 200% is not. The felt is the one screen that cannot reflow, because nine seats,
a board, a pot and an action row all have to be visible at once and in a fixed spatial
relationship, so type that doubles has nowhere to push except off the screen.

- **The cap is at the root, not on a container.** Every `rem` is measured against the root font
  size, and the table's dialogs render in a portal on `<body>`, outside anything the table wraps.
  `TextScaleProvider` watches the pathname and applies `effectiveTextScale()`.
- **The boot script applies it too.** A hard refresh on `/play/kitchen` resumes the table, and the
  provider's effect runs after paint, so without the cap in the inline script the felt draws once
  at 200% and jumps.
- **The stored setting is never rewritten.** Walking off the table restores 200%.
- **Do not fix a table overflow by widening the cap**, and do not fix one by dropping the 200%
  step: that would take the WCAG 1.4.4 answer away from every reading surface to fix one screen.

### Dialogs are capped and scroll, never clipped

A dialog is centred with a transform, so content taller than the viewport spills off **both**
ends and neither is reachable. `DialogContent` therefore caps itself at `100dvh - 2rem` and
scrolls, and it is a **column flex** so a body that opts in with `min-h-0 overflow-y-auto`
shrinks under pressure and keeps the header and the footer on screen. (`tests/textScale.test.ts`
holds the primitive to it.)

- **A `max-h-[Nvh]` scroll region inside a dialog wants `min-h-0` beside it.** The vh cap is the
  look at 100%; `min-h-0` is what lets it give way when the type is twice the size.
- **A dialog that sets its own `overflow-hidden`** (the ones with cover art: `VenueInfoDialog`,
  `ShopDialog`) has opted out of the popup's scroll, so it has to own one inside. Its art header
  needs `shrink-0` or the flex will squash the picture instead of scrolling the words.
- **Never cap a dialog's body against the viewport by hand** (`max-h-[calc(100dvh-9rem)]`). The
  subtracted figure is a guess about the header's height, and the text size setting can double it.

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
- **A new player's lobby is short.** Until `isNewPlayer` (`lib/newPlayer`: fewer than three
  tournaments and 150 hands) is false, Home shows the Next Up card, The Daily and Learn with
  Webb, plus a "More ways to play" button that opens the full lobby. Nothing is hidden for good.
- **Above-the-fold copy on marketing pages animates in CSS (`.rise-in`), never with a Framer
  `initial`.** Framer writes `initial` into the static HTML as `opacity:0` and only lifts it
  after hydration. Scroll reveals use `Reveal`, which renders visible and only hides what is
  below the fold once JS is running.
- **The marketing header is wordmark + one link + CTA on a phone.** Everything else in
  `Landing`'s nav (Features, Venues, Blog, GitHub, the theme toggle) is `hidden ... sm:block`,
  because six controls at 357px wide is a crowded bar, not a nav. Hide, don't remove: the
  links stay in the HTML for crawlers, and each one is repeated in the footer. Anything new
  added to that bar needs a breakpoint and a reason to be the exception.
- **Table:** drawn as a real table since 2026-10-07 (`components/table/surface.tsx`,
  `seat.tsx`). Calm had tipped into empty, so the felt is now a place:
  - **The room** (`TableRoom`): the venue's own painting, blurred and dimmed behind
    everything, with the venue `accent` as the light over the table. The Garage glows
    periwinkle, the Main Event red. A built table (no painting) gets the light only.
  - **The table** (`TableFelt`): an oval with a dark rail and a cloth lit from above.
    The cloth is the player's **table finish** (Chip Shop, chosen in Style), a shade
    darker; the plain table (no finish) is `--color-table-cloth` graphite with the
    venue accent mixed in, so Baize is still a choice rather than the default.
    `FeltBackdrop` still paints the finish behind every other screen.
  - **Seats** (`FeltSeat`) sit on the rail, on the oval's own ellipse
    (`feltSeatPositions` + `FELT_WIDE` / `FELT_COMPACT` in `lib/tableSeats.ts`): a
    bigger face, a nameplate on the cloth, their cards tucked face down behind them,
    the last action as a pill (derived from consecutive hand states in
    `useSeatActions`; presentation only), and a travelling turn ring on whoever is to
    act. Folded seats dim. Showdown cards turn over where the backs were.
  - **Board**: five outlined places on the cloth, not five card backs. Cards drop and
    flip over (`BoardCard`), the flop staggered.
  - **Chips**: `ChipStack` draws a bet as a small stack (counted in small blinds, four
    muted clay colours, `--color-chip-*`) in front of each seat; at the end of a street
    the stacks slide into the pot, and at the end of a hand the pot slides to the
    winner. Left/top in stage percent, so nothing is measured.
  - The hero's cards straddle the near rail; on a phone the action bar is the last
    row, under the thumb. The review and the lessons keep the older arc (`Seat`,
    `opponentPositions`) and are tuned to it; they are not on the drawn table yet.
- **Cards:** `PlayingCard` (face, sizes `sm|md|lg`), `DealtCard` (animated), `CardBack`
  (customizable face-down). Ten renders as "10" though the engine uses `T`.

## Components inventory

- Menu: `Home`, `VenueArt` (image with SVG fallback).
- Onboarding/profile: `onboarding/firstSeat` (no screen: a first visit is dealt straight in),
  `AvatarEditor` (shared), `ProfileDialog`,
  `ChipsDialog` (award collection), `StatsDialog` (lifetime stats + the Roll graph).
- Settings: `SettingsDialog` (card-back picker + profile backup/restore).
- Table: `Table`, `ActionBar` (fold / check·call / bet·raise + sizer with ½·¾·Pot·Max),
  `HandHistoryDialog` (last-hand timeline).
- Primitives: `PlayerAvatar`, `PlayingCard`, `CardBack`, `CountUp`, `AwardChip`,
  `RollGraph` (hand-rolled smoothed SVG area chart; its `LineGraph` core also draws the
  drill rating over spots answered, and the report's sparklines via `profile/DrillRating`), `ThemeToggle`,
  shadcn `ui/button`, `ui/dialog`.

## Adding UI — checklist

1. Use theme tokens (see the golden rule).
2. `tabular-nums` for any animating number.
3. Fire an appropriate `sound.play(...)` cue on meaningful actions.
4. Prefer Framer Motion for enter/exit and value transitions; keep it subtle.
5. Respect the brand: flat, one accent, no `$`, no casino textures.
