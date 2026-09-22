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
3. **Every price in this room is paid in chips you won. Nothing here is ever
   payable in money.** Not a shortcut, not a bundle, not "and for £2 you can
   skip the grind". The Roll is earned at a table or it is not earned.

### Rule 3 was rewritten on 2026-09-21, and here is the account of it

It used to end: *"The membership does not sell anything on these shelves and no
shop price is ever payable in cash. Member cosmetics are a different shelf."*
The membership now does sell things on these shelves — a **members' shelf** of
rings, buttons, packs and card backs that the membership lets you *buy*, with
chips, at prices above the open shelf.

- **What changed.** A cosmetic may now carry a price **and** `membersOnly`. The
  membership opens the right to buy; chips you won still buy it. That
  combination used to be forbidden outright and `tests/shop.test.ts` failed the
  build on it.
- **Why it is not the thing rule 3 was protecting.** The promise rule 3 was
  actually making is the first sentence above, and it is untouched: no price in
  this room is payable in money. What was forbidden was a *shape*, on the
  argument that a price plus a membership would "invent an exchange rate between
  the two economies". It does not. There is no rate at which money becomes
  chips, in either direction, and there still is not: a member who has won
  nothing can buy nothing.
- **The pattern is not new.** Gold Leaf has shipped since v1 needing a Riverboat
  win *and* 50,000 chips — a gate on the right to buy, with chips still doing
  the buying. The members' shelf is that pattern with a membership where the
  win goes.
- **The one thing that would make it dishonest, and the rule that stops it.**
  Charging chips for a thing and then repossessing it when a subscription
  lapses. So: **bought is bought.** A member-shelf item stays yours after you
  cancel, forever, and `cardBackUnlocked` checks `price` *before* `membersOnly`
  precisely so that this is true by construction rather than by care.
  `tests/shop.test.ts` fails the build if a cancelled membership ever takes back
  something chips paid for.
- **What this costs us.** Shelves that are no longer purely "chips you won" in
  their *access*, only in their *currency*. Somebody could reasonably say the
  membership now reaches into the Chip Shop. It does, onto one clearly-labelled
  shelf at the bottom, and every item on it is one the game did not have before.

**Nothing moved.** No item that was ever buyable with chips by anybody is on the
members' shelf, and `tests/shop.test.ts` fails the build if one appears on both.
That is the difference between this and the side tables in September, and it is
why this needed no apology to anybody.

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
| Card backs | Ocean (250) · Rosé (400) · Slate (500) · Lilac (600) · Midnight (750) · Penny (1k) · Powder (5k) · Noir (10k) · Racing Green (25k) · Gold Leaf (50k, **requires a Riverboat win**) · The Millionaire (1M) | A price ladder from beginner-reachable to prestige. The low tier (under a Garage buy-in) — Ocean/Slate/Midnight pulled from the old free set, plus Rosé — gives a new player something to want within a win or two. The hybrid pattern: a win unlocks the *right to buy*. The Millionaire is the absurdity — the price is the trophy. |
| The deck | **Big Index (free)** · High-Contrast Deck (3k) · Four-Colour Deck (5k) | Big Index: a larger corner rank, free **and staying free** — a readability option behind a price is a toll on the players least able to skip it. Contrast: heavier ink, bigger pips. Four-colour: diamonds blue, clubs green (`--color-suit-blue/green` tokens). Rendering in `PlayingCard`. Readability charm, not information — every suit is equally visible on every face, and no face may ever take a rank or a suit off a card. |
| Table finishes | **Baize (free)** · Slate (2.5k) · Walnut (7.5k) · Midnight (15k) · Forest (25k) · Oxblood (50k) | A colour wash + pool on the table (`Table.tsx`), both themes. Baize is the green everybody pictures, given away so the plain felt is a choice. |
| Avatar rings | **Hairline (free)** · Brass (1.5k) · Enamel (4k) · Rope (12k) · Ivory (30k) | A band round *your* avatar — at the table, in the AppBar, on your profile. Never worn by the cast: a ring on Doris would be the app claiming she bought one. Drawn as padding on the `<img>` so switching one on moves no seat (`PlayerAvatar`). |
| Dealer buttons | **The House (free)** · Bone (800) · Lacquer (3.5k) · Perspex (9k) · Oak (20k) | The disc that moves a seat every hand. Four millimetres of screen you look at constantly. Reaches the felt through `TableStyleContext` in `components/table/parts.tsx` — a context rather than a store read, because that file is deliberately state-free so the review can reuse it. |
| Sound packs | **The House (free)** · **Hush (free)** · Felt (3k) · Brass (15k) | A pack is a *transform* of the twelve cues in `lib/sound.ts` — pitch, gain, length, optional oscillator — never a second cue table, so the cues cannot drift out of the relationships they were tuned in. Hush is free for the same reason Big Index is: quiet is not a luxury. |
| Souvenirs | One per table — ladder, side tables, **and the Kitchen Table** (½ buy-in, floor 25) · The Golden Pip (5M, no win required) | **Bought chips**: they wear the award-chip template (venue accent + a motif via `souvenirAward`) and sit on the chip shelf in `ChipsDialog` under "Souvenirs · from the Chip Shop" — unowned ones show hollow, so the shelf doubles as a quiet want-list. Winning the venue unlocks the purchase. |

### Earned card backs (free — not shop items)

First **win** at each ladder venue unlocks that venue's back (its accent, a
fine pattern) — `EARNED_BACKS` in `config/cardBacks.ts`, derived from
`venueRecords` with **no new persisted state**. Locked designs show hollow with
a lock in the Settings picker, with the unlock hint in the tooltip.

## Member cosmetics (the second shelf)

Two kinds, and the difference between them is what happens when a membership
lapses. Both live on **the members' shelf**, at the bottom of the shop, labelled
as its own thing.

| | Price | On lapse | Stock |
|---|---|---|---|
| **Included** | none, ever | **locks again** | 4 card backs (Lock-In, Back Room, Nightcap, Last Orders) · Gilt ring · Engraved button · Velvet pack · Smoke finish · Minimal deck |
| **The members' shelf** | chips you won | **stays yours** | Oyster (20k) · Cask (75k) · Eclipse (250k) card backs · Mother-of-Pearl ring (100k) · The Pip button (60k) · After Hours pack (40k) · Marble finish (120k) |

An included item never has a price, and a member-shelf item always does —
`tests/shop.test.ts` holds both, and the two live in separate arrays
(`MEMBER_BACKS` / `MEMBER_SHOP_BACKS`) so that which-is-which is readable
without running the predicate in your head.

**Bought is bought.** See the rule 3 account above: `cardBackUnlocked` and
`cosmeticUnlocked` both check `price` before `membersOnly`, so a cancelled
membership cannot repossess anything chips paid for.

**The members' backs wear foil.** A thin warm keyline and a sheen that crosses
the card every seven seconds, drawn from the design's *gate* rather than a flag,
so a member back cannot ship without it and a shop back cannot acquire it — the
day foil means "expensive" instead of "the membership" is the day it stops
telling the player anything. Reduced motion gets the keyline and nothing that
moves (`components/CardBack.tsx`, `.foil-sweep` in globals.css).

**They lead the Style picker**, ahead of the free set (Will, 2026-09-21: "move
the card backs you get to the front so I can see them"). They were last, which
made them four scroll-lengths off the right edge of a strip most players never
scrolled. It is a reorder inside a screen the player opened, not a prompt:
nothing appears over anything, nothing returns after dismissal, and a locked
back still just says what it is. If it ever grows a button it has stopped being
that.

**What is equipped is what renders, and nothing asks about a membership at the
felt.** `Table.tsx` looks a card back up and draws it; `AppBoot` hands the sound
pack to the engine. The gate is on the picker, where a locked thing cannot be
chosen. The cost is that somebody whose membership has lapsed keeps the look
they chose until they change it — which is the same trade the card back has
always made, and better than reaching into a live session to take a colour away.

**The denominator rule (ruled by Will, 2026-08-14, `technology#52`).** Member
cosmetics count in their own collection and **never in the main shelf's
`X of N`**. The shelf already ships that pattern (`Scalps · 0 of 22`), and a
free player's collection reading permanently incomplete because of items they
cannot earn is the thing that *reads* as a dark pattern even though it isn't.
Cheap to decide now, a migration to fix later — so it is decided.

Rule 1 still governs: a member card back is a card back. Style and story, never
edge.

## Surfacing doctrine

Same as the chip shelf: **the shop is there when you go looking.** No sale
banners, no NEW dots, no rotating stock, no countdowns. Prices span the whole
game so the shop is fun at a 400-chip Roll (finishes) and at a million (you
know the one).

## Follow-ups (discussed, deliberately not in v1)

- Avatar gear (hats, glasses) — needs DiceBear option work in the creator. The
  ring shipped instead (2026-09-21) because it needed none of that.
- Chip colourways — the bets on the felt are text, not discs, so this is a
  rendering feature wearing a cosmetic's clothes. Not a config entry.
- Felt *patterns* — ruled out rather than pending: the finish is "flat, no
  texture, ever" (`Table.tsx`), and a weave would be the first thing on the felt
  competing with the cards.
- ~~Buying a round~~ — built, then **cut** (2026-07-16): the Beer button was
  clutter nobody would parse, and the cast's own table talk carries the charm.
- A richer souvenir visual (the AwardChip disc language could stretch to it).
- ~~Paid cosmetics (real money)~~ — **resolved**: they are not shop items at
  all. They come with the membership, on their own shelf with their own
  denominator, and no Chip Shop price is ever payable in cash. See
  "Member cosmetics" above.

## Where to make changes

| Want to change… | Edit |
|-----------------|------|
| Add/price an item | `src/config/shop.ts` (+ `tests/shop.test.ts`) |
| Add a ring, button or sound pack | `src/config/cosmetics.ts` — the registry is the source of truth and `shop.ts` projects it |
| Add an earned/shop back | `src/config/cardBacks.ts` (`EARNED_BACKS` / `SHOP_BACKS`) |
| Put something on the members' shelf | `MEMBER_SHOP_BACKS`, or `membersOnly: true` **with** a price on a cosmetic |
| Give something away | price `0` and no flag — then add its id to the free list `tests/shop.test.ts` pins, deliberately |
| Four-colour rendering | `components/PlayingCard.tsx` + suit tokens in `globals.css` |
| The finish tint | the `style` on `Table.tsx`'s root |
| Pearl's lines | the `pearl` entry in `src/config/cast.ts` |
