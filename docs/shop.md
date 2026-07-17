# The Chip Shop & earned unlocks

> **Status: built (v1).** Inventory in `src/config/shop.ts`; earned/bought card
> backs in `src/config/cardBacks.ts`; purchases persist in the profile
> (`owned` / `deckFace` / `tableFinish`, `PERSIST_VERSION` 10); the shop opens
> from the home screen (`ShopDialog`), with Pearl behind the counter.

## The two rules (non-negotiable)

1. **Style and story, never edge.** Nothing earnable or buyable may affect
   odds, information, or gameplay. No insurance, no re-buys, no stat boosts.
   The moment a purchase touches gameplay, the no-scam promise dies.
2. **Award chips are never purchasable.** Earned-only, forever.

## Why a shop at all

The Roll had no sink — past the Main Event, chips pile up with nothing to want.
The shop gives winnings purpose, and creates the most interesting decision a
bankroll game can offer: **style costs progression.** Spending never moves
`peakRoll` (rank is about winnings, not thrift).

## The name & the keeper

**The Chip Shop** (the chippy pun is exactly Pip's register). It's a place, not
a settings tab: **Pearl** (in the cast, pinned to `only: ['shop']` so she never
plays a table) greets each visit with a dry line.

## Inventory (v1)

| Category | Items | Notes |
|----------|-------|-------|
| Card backs | Penny (1k) · Powder (5k) · Noir (10k) · Racing Green (25k) · Gold Leaf (50k, **requires a Riverboat win**) · The Millionaire (1M) | A price ladder from first-splurge to prestige. The hybrid pattern: a win unlocks the *right to buy*. The Millionaire is the absurdity — the price is the trophy. |
| The deck | High-Contrast Deck (3k) · Four-Colour Deck (5k) | Contrast: heavier ink, bigger pips. Four-colour: diamonds blue, clubs green (`--color-suit-blue/green` tokens). Rendering in `PlayingCard`. Readability charm, not information — every suit is equally visible either way. |
| Table finishes | Slate (2.5k) · Walnut (7.5k) · Midnight (15k) · Forest (25k) · Oxblood (50k) | A colour wash + pool on the table (`Table.tsx`), both themes. |
| Souvenirs | One per table — ladder, side tables, **and the Kitchen Table** (½ buy-in, floor 25) · The Golden Pip (5M, no win required) | **Bought chips**: they wear the award-chip template (venue accent + a motif via `souvenirAward`) and sit on the chip shelf in `ChipsDialog` under "Souvenirs · from the Chip Shop" — unowned ones show hollow, so the shelf doubles as a quiet want-list. Winning the venue unlocks the purchase. |

### Earned card backs (free — not shop items)

First **win** at each ladder venue unlocks that venue's back (its accent, a
fine pattern) — `EARNED_BACKS` in `config/cardBacks.ts`, derived from
`venueRecords` with **no new persisted state**. Locked designs show hollow with
a lock in the Settings picker, with the unlock hint in the tooltip.

## Surfacing doctrine

Same as the chip shelf: **the shop is there when you go looking.** No sale
banners, no NEW dots, no rotating stock, no countdowns. Prices span the whole
game so the shop is fun at a 400-chip Roll (finishes) and at a million (you
know the one).

## Follow-ups (discussed, deliberately not in v1)

- Avatar gear (hats, glasses) — needs DiceBear option work in the creator.
- ~~Buying a round~~ — built, then **cut** (2026-07-16): the Beer button was
  clutter nobody would parse, and the cast's own table talk carries the charm.
- A richer souvenir visual (the AwardChip disc language could stretch to it).
- Paid cosmetics (real money) — far future; the two rules above still govern.

## Where to make changes

| Want to change… | Edit |
|-----------------|------|
| Add/price an item | `src/config/shop.ts` (+ `tests/shop.test.ts`) |
| Add an earned/shop back | `src/config/cardBacks.ts` (`EARNED_BACKS` / `SHOP_BACKS`) |
| Four-colour rendering | `components/PlayingCard.tsx` + suit tokens in `globals.css` |
| The finish tint | the `style` on `Table.tsx`'s root |
| Pearl's lines | the `pearl` entry in `src/config/cast.ts` |
