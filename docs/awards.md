# Awards — "Special Chips"

> **Status: built (v1).** Detection lives in `src/lib/awards.ts` (pure, unit-tested);
> earned chips persist in the profile (`awards`, `PERSIST_VERSION` 6); the chip
> visual is `src/components/AwardChip.tsx`; the collection opens from the profile
> dialog's **Chips** button (`ChipsDialog`); the quiet earn line shows on the
> handover banner and the Champion overlay.

## Concept

Awards are **special chips** — collectible poker chips you earn when something worth
remembering happens: you crack a venue for the first time, you hit quads, you win your
way back from broke. A pip is the atom of a card; a chip is the atom of the game — your
collection is the story of your play.

They are **not** XP, dailies, streak-bait, or a battle pass. A chip is earned once,
quietly, and kept forever. (See docs/brand.md: calm information, premium restraint,
no scam energy.)

## Visual system

One chip template, many faces — exactly like the favicon (`src/app/icon.svg`): a flat
disc, rim ticks, inner ring. Each award recolors the disc and stamps a small motif in
the centre (a suit pip, a number, a venue accent). This reuses the established pattern
language from card backs (`config/cardBacks.ts` patterns) and venue accents
(`config/venues.ts`), so the whole set stays on-brand and cheap to render — an SVG
component (`AwardChip`), no image assets.

- **Venue chips** use that venue's `accent` colour.
- **Hand chips** use the cardface palette (suit red / suit black on white).
- **Journey chips** use the pip periwinkle (`--color-pip`).

Unearned chips show as hollow outlines (the hatch pattern used for face-down cards),
so the shelf reads as a collection with visible gaps — the pull is seeing what's
missing, not a nag.

## The set (55 chips)

### Venue chips — one per rung, earned by **winning** the venue (10)

| id | Chip | Earned by |
|----|------|-----------|
| `venue-garage` … `venue-mainevent` | The venue's accent + tier number | First tournament **win** at that venue |

Winning, not entering — unlocking a venue is already its own reward (you can afford
it); the chip marks conquering it.

### Hand chips — first time the hand **wins a showdown** (7)

| id | Chip | Earned by |
|----|------|-----------|
| `hand-straight` | "Straight" | Win a showdown with a straight |
| `hand-flush` | "Flush" | Win a showdown with a flush |
| `hand-fullhouse` | "Full House" | Win a showdown with a full house |
| `hand-quads` | "Quads" | Win a showdown with four of a kind |
| `hand-straightflush` | "Straight Flush" | Win a showdown with a straight flush |
| `hand-royal` | "The Royal" (gold) | Win a showdown with a royal flush (also earns Straight Flush) |
| `hand-wheel` | "The Wheel" | Win a showdown with the A-2-3-4-5 straight (also earns Straight) |

Must be **won at showdown** (the engine's `result.evaluations` names the hand), so the
chip certifies a real moment, not a folded-out technicality.

### Moment chips — plays that make a story (7)

| id | Chip | Earned by |
|----|------|-----------|
| `moment-sevendeuce` | "The Seven Deuce" | Win a pot holding 7-2 (the classic) |
| `moment-bullets` | "The Bullets" | Win a pot holding pocket aces |
| `moment-bigslick` | "Big Slick" | Win a **showdown** holding Ace-King |
| `moment-knockout` | "The Bouncer" | Take **every** chip in a hand that busts an opponent |
| `moment-doubleko` | "Two Birds" | Bust **two** opponents in a single hand |
| `moment-comeback` | "The Comeback" | Win a ladder venue after falling to ≤10% of your starting stack |
| `moment-chipandchair` | "Chip and a Chair" | Win a ladder venue after being ground down to ≤1 big blind |

### Nickname chips — win a pot holding a folk-named starting hand (25)

| id | Chip | Earned by |
|----|------|-----------|
| `nickname-KK` … `nickname-93` | The hand's folk name (jade) | Win a pot holding that named starting hand |

Generated one-to-one from the nicknames in `src/config/handNames.ts` (Cowboys,
Ladies, Snowmen, Motown, The Heinz …), so the shelf tracks that list exactly.
The three most iconic named hands — pocket aces, Ace-King, 7-2 — are **not**
duplicated here; they keep their bespoke moment chips (The Bullets, Big Slick,
The Seven Deuce). Detection reuses `nicknameKeyFor` from `handNames`, so the
whisper you see when dealt the hand and the chip you earn for winning with it
are always the same set.

### Journey chips — the story of the grind (6)

| id | Chip | Earned by |
|----|------|-----------|
| `journey-first` | "First Pot" | Win your first pot |
| `journey-kitchen` | "Back From Broke" | Win the Kitchen Table freeroll, then **win any ladder venue** before going broke again |
| `journey-regular` / `journey-shark` / `journey-pro` / `journey-legend` | Rank chips | Reach that rank (`peakRoll`) |

"Back From Broke" is the flagship — it makes the freeroll loop a badge of honour
instead of a walk of shame; "First Pot" gives every new player their first chip within
minutes.

## Detection & data

All triggers are observable at two seams — no engine changes:

- **`finishHand()`** in `store/game.ts` already knows: winners, `result.evaluations`
  (hand names), payouts, survivors, hero's hole cards, and the venue → hand chips +
  venue chips + nickname chips + rank chips (from the just-updated `peakRoll`).
- "Back From Broke" uses one persisted flag (`cameFromFreeroll`): set on a Kitchen
  Table win, consumed when the comeback chip is earned, and cleared if you bust back
  below the Garage buy-in first.

Persistence: `profile.awards: Record<string, number>` (id → epoch ms earned), plus the
flag above (`PERSIST_VERSION` 6, with a migrate branch per the repo rule). Detection
is a pure helper (`detectAwards` in `src/lib/awards.ts`, unit-tested): given the hand
outcome and what's owned, it returns newly earned chips — the game store just applies
them and exposes `newAwards` for the UI.

## Surfacing (calm, in this order)

1. **Earn moment** — a single quiet line on the handover/result screen ("★ New chip —
   Quads"), same visual weight as the result message. No modal, no confetti, no sound
   beyond the existing win sound.
2. **The shelf** — its own dialog (the **Chips** button in the profile dialog opens `ChipsDialog`), grouped by kind: earned chips in colour, unearned as
   hollow outlines. Tap any chip to see its name and requirement — every chip shows
   how it's earned up front, so the shelf doubles as a quiet goal list.
3. **Nothing else.** No badges on the home screen, no red dots, no "3/18 collected!"
   banners. The collection is there when you go looking.

## Explicit non-goals

- No time-limited or repeatable awards (nothing expires; nothing resets).
- No awards for spending, logging in, or volume grinding (hands-played counts are
  stats, not honours).
- No award ever gates gameplay — chips are memories, not keys.

## Where to make changes

| Want to change… | Edit |
|-----------------|------|
| Add/rename a chip, tune triggers | `src/lib/awards.ts` (+ `tests/awards.test.ts`) |
| The chip visual | `src/components/AwardChip.tsx` |
| The shelf | `src/components/profile/ChipsDialog.tsx` |
| The earn moment | `Banner` / `EndOverlay` in `src/components/table/Table.tsx` |
