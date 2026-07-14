# Awards — "Special Chips" (plan)

> **Status: planned, not built.** This is the design doc for Pip's collectible awards.
> Nothing here is implemented yet.

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

## The set (v1 — 18 chips)

### Venue chips — one per rung, earned by **winning** the venue (10)

| id | Chip | Earned by |
|----|------|-----------|
| `venue-garage` … `venue-mainevent` | The venue's accent + tier number | First tournament **win** at that venue |

Winning, not entering — unlocking a venue is already its own reward (you can afford
it); the chip marks conquering it.

### Hand chips — first time you **win a pot** with the hand (5)

| id | Chip | Earned by |
|----|------|-----------|
| `hand-fullhouse` | "Full House" | Win a showdown with a full house |
| `hand-quads` | "Quads" | Win a showdown with four of a kind |
| `hand-straightflush` | "Straight Flush" | Win a showdown with a straight flush |
| `hand-royal` | "The Royal" | Win a showdown with a royal flush |
| `hand-wheel` | "The Wheel" | Win a showdown with the A-2-3-4-5 straight |

Must be **won at showdown** (the engine's `result.evaluations` names the hand), so the
chip certifies a real moment, not a folded-out technicality.

### Journey chips — the story of the grind (3)

| id | Chip | Earned by |
|----|------|-----------|
| `journey-kitchen` | "Back From Broke" | Win the Kitchen Table freeroll, then **win any ladder venue** before going broke again |
| `journey-shark` / `journey-legend` | Rank chips | Reach the Shark / Legend rank (`peakRoll`) |

"Back From Broke" is the flagship — it makes the freeroll loop a badge of honour
instead of a walk of shame.

## Detection & data

All triggers are observable at two seams — no engine changes:

- **`finishHand()`** in `store/game.ts` already knows: winners, `result.evaluations`
  (hand names), payouts, survivors, and the venue → hand chips + venue chips.
- **`rankFor(peakRoll)`** transitions in the profile → rank chips.
- "Back From Broke" needs one persisted flag (`cameFromFreeroll`) set on a Kitchen
  Table win and cleared when the roll next hits 0.

Persistence: `profile.awards: Record<string, number>` (id → epoch ms earned), plus the
flag above. **Bump `PERSIST_VERSION` (→ 6) with a migrate branch** per the repo rule.
Detection lives in a pure helper (`src/lib/awards.ts`, unit-tested): given
(hand result, venue, profile before), return newly earned award ids — the game store
just applies them.

## Surfacing (calm, in this order)

1. **Earn moment** — a single quiet line on the handover/result screen ("★ New chip —
   Quads"), same visual weight as the result message. No modal, no confetti, no sound
   beyond the existing win sound.
2. **The shelf** — a grid in the profile dialog: earned chips in colour, unearned as
   outlines with their "how" copy hidden until earned ("???" taglines invite curiosity;
   venue and rank chips can show their requirement since those are self-evident).
3. **Nothing else.** No badges on the home screen, no red dots, no "3/18 collected!"
   banners. The collection is there when you go looking.

## Explicit non-goals

- No time-limited or repeatable awards (nothing expires; nothing resets).
- No awards for spending, logging in, or volume grinding (hands-played counts are
  stats, not honours).
- No award ever gates gameplay — chips are memories, not keys.

## Build order (when picked up)

1. `lib/awards.ts` (pure detection + tests) and the profile field + migration.
2. `AwardChip` SVG component + the shelf in the profile dialog.
3. The earn line on the handover screen.
