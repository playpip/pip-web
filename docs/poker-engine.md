# The Poker Engine

`src/lib/poker/` is a **pure, framework-free, deterministic, unit-tested** poker engine.
No React, no I/O, no globals. It is the source of truth for the rules. Everything here
is portable to a server unchanged — which is not a hypothetical: it is the property the
multiplayer plan rests on (`cto/drafts/build-multiplayer.md`).

**It plays two games.** No-Limit Hold'em everywhere, and Pot-Limit Omaha at the one
table that asks for it. See [Variants](#variants) — the difference is a single field on
`HandState`, on purpose.

## Modules

### `cards.ts`
- Types: `Suit` (`c d h s`), `Rank` (`2`–`9 T J Q K A`), `Card { rank, suit }`.
- `RANK_VALUE`, `isRed(suit)`.
- **Seeded RNG**: `mulberry32(seed): Rng`. `Rng = () => number` in `[0,1)`.
- `createDeck()`, `shuffle(items, rng)` (Fisher–Yates), `shuffledDeck(rng)`.
- String codec: `cardToString`, `cardsToStrings`, `cardFromString` (e.g. `"Ah"`, `"Td"`).
  `T` = Ten (matches pokersolver notation; the UI displays it as "10").

> Determinism is the whole game: pass a seeded `Rng` and shuffles/equity are
> reproducible, which is what makes the engine testable. Production passes `Math.random`.

### `handEval.ts`
Thin typed wrapper over **pokersolver** (a CommonJS module; see
`src/types/pokersolver.d.ts`).
- `Variant = 'holdem' | 'omaha'`, and `HOLE_CARDS` — how many cards each deals (2 / 4).
- `evaluateHand(hole, community, variant = 'holdem'): EvaluatedHand` — best five;
  `{ name, description, categoryRank, solved }`.
- `determineWinners(contenders, community, variant = 'holdem'): { winners, evaluations }`
  — handles ties (multiple winners share) and kickers. This is what showdown uses.

**Both default to Hold'em**, so every call site that predates Omaha is unchanged and
cannot silently acquire the other game's rules.

**The Omaha reading is enumerated here rather than delegated.** pokersolver has an
undocumented `'omahahi'` game in some versions; this project has a blog post about
trusting that library's undocumented behaviour, so the rule is implemented where it can
be tested. Sixty candidates (six ways to take two of four hole cards × ten ways to take
three of five board cards), each solved as an exact five-card hand, compared with
pokersolver's own `winners`. Sixty `solve` calls at a showdown is nothing; the equity
sim is the hot path and is bounded by its own iteration count.

**Before three board cards there is no legal Omaha hand**, so the variant falls back to
a free solve of whatever is on the table. Nothing settles a pot in that state — a
showdown always has five — and the only callers are strength estimates before a board
exists. Documented because a silent fallback inside a rules file is how a wrong showdown
ships.

### `pots.ts`
Main + side pot construction — a classic bug source, isolated and heavily tested.
- `buildPots(contributions): Pot[]` where `Contribution { id, committed, folded }`
  and `Pot { amount, eligible[] }`.
- Folded players' chips stay in the pots but they're not eligible to win.
- Adjacent layers with identical eligibility are merged. `totalPot(pots)` sums.

### `engine.ts` — the betting state machine
The heart. Operates on an immutable-ish `HandState` value via pure transitions.

Key types:
- `Street = preflop | flop | turn | river | showdown | complete`
- `PlayerStatus = active | folded | allin | out`
- `Action { type: fold|check|call|bet|raise, amount? }` — for bet/raise, `amount` is
  the **total to commit this street** (the "raise to" amount), not the delta.
- `Player`, `HandState`, `SeatConfig`.

Key functions:
- `startHand(opts): HandState` — deals hole cards (two, or four when
  `opts.variant === 'omaha'`), posts blinds (heads-up: button = SB and acts first
  preflop; multiway: SB left of button, action starts left of BB). Accepts a seeded
  `rng` or a preset `deck` (drawn from the **end** via `pop()`).
- `legalActions(state): LegalActions | null` — what the player to act may do, with
  `callAmount`, `minRaiseTo`, `maxRaiseTo`, and can-flags. `maxRaiseTo` is the all-in
  amount at No-Limit and the **pot-limit cap** at Omaha (see Variants).
- `applyAction(prev, action): HandState` — validates, applies, advances. Enforces
  min-raise (a short all-in does **not** re-open the action), advances streets, deals
  the board, runs it out when betting is closed, resolves showdown, splits pots
  (odd chips go to earliest seats left of the button).
- Helpers: `potSize(state)`, `isHandComplete(state)`.

Results live on `state.result: HandResult` when a hand ends:
`{ showdown, payouts, potsAwarded, evaluations? }`.

### `equity.ts`
Monte-Carlo equity — how often a hand wins at showdown vs N opponents.
- `estimateEquity({ hole, community?, opponents, iterations?, rng?, opponentSelectivity? }): EquityResult`
  → `{ win, tie, equity, iterations }`. `equity` = win share incl. tie splits, in `[0,1]`.
- `opponentSelectivity` (per-opponent, `[0,1]`) weights each opponent's range toward
  stronger hands instead of two random cards — omit it for classic raw equity.
- Powers both the AI and the human's ambient "win %" readout. ~800–1800 iters is plenty.

### `ai/policy.ts`
There is **no drop-in poker bot library** worth using in JS, so the AI is ours:
equity + pot odds + a personality.
- `AiProfile { tightness, aggression, bluff, iterations, skill? }` — `skill` (default 1)
  degrades play quality with genuine mistakes: noisy self-equity reads and folding
  under pressure. Used by the Kitchen Table freeroll so it stays beatable heads-up.
- `decideAction(state, profile, rng?): Action` — always returns a **legal** action.
  Logic: estimate equity vs live opponents — **ranging each by how much they've
  backed the hand** (`opponentSelectivity`, so it doesn't over-call into aggression)
  → compare to pot odds (tightness, plus a little more when players are still to act
  behind it) → value-bet/raise strong hands, check/call medium, fold weak, occasionally
  bluff (less so out of position). Bet sizing is a jittered fraction of the pot,
  clamped to legal bounds. **Preflop, `tightness` is the looseness dial**: it sets a
  starting-hand-quality cutoff (`holeStrength`) below which a holding won't open-bluff
  and folds to any bet, and it scales how far the continue decision discounts (loose,
  station-y) or demands a premium over (nit) the pot odds. Raw equity vs random cards
  flatters junk — 2-3o still wins ~⅓ heads-up — so without this an equity-only bot
  limps and cheap-peels hands a real player mucks. Net effect, measured six-handed in
  `tests/ai.test.ts`: the Garage plays ~35% of hands, the Main Event ~19%, and the fall
  is monotone in between — roughly real VPIP ranges. Never
  overrides checking for free — a limped big blind still sees the flop with anything.
- `opponentSelectivity(state, opp)` is exported and shared with the store's hero
  "win %" read, so both sides model opponent ranges identically.
- Difficulty scales per venue via the profile (see `config/venues.ts`).

## Variants

`HandState.variant` is one field and everything that differs follows from it. It lives on
the state rather than being passed around because every rule that varies has to agree with
the deal that already happened: **a hand dealt four cards and then evaluated as Hold'em is
exactly the bug this field exists to make impossible.**

| | No-Limit Hold'em | Pot-Limit Omaha | Short Deck | Omaha Hi-Lo |
|---|---|---|---|---|
| `variant` | `'holdem'` (the default everywhere) | `'omaha'` | `'shortdeck'` | `'omahahilo'` |
| Deck | 52 | 52 | **36 — no 2s to 5s** | 52 |
| Hole cards | 2 | 4 | 2 | 4 |
| Showdown | best five of seven, free-form | **exactly two from hand + exactly three from board** | best five of seven, **re-ranked** | Omaha high **and** a separate low |
| Max raise | all-in | the pot after your call | all-in | the pot after your call |
| Where | every table | `bigpot`, members only | `shortdeck-*`, members only | `hilo-*`, members only |

**Short Deck changes the ranking, and pokersolver cannot do it.** Two rules come with the
thirty-six cards: a **flush beats a full house** (nine of each suit instead of thirteen
makes flushes the rarer hand), and **A-6-7-8-9 is a straight** — a nine-high one, because
the ace plays below the six. Ask the library and it ranks the boat over the flush and reads
the wheel as ace-high nothing, both confidently and both silently. So `lib/poker/shortDeck.ts`
owns the ranking and its own comparator, `determineWinners` routes short deck away from
`Hand.winners` entirely, and `EvaluatedHand.solved` is **absent** on a short-deck hand
because there is no pokersolver hand behind it. `tests/shortDeck.test.ts` pins both rules.
The rule set is Triton's: three of a kind does *not* beat a straight here, which is a real
variant rule elsewhere and a deliberate no.

**Five-Card Draw has no board and a street that is not a betting round.** Five cards each,
face down, one betting round, a discard, another betting round, a showdown — so `Street`
gained `draw` and `postdraw`, and `Action` gained `{ type: 'draw', discard: number[] }`. Three
things about that street are deliberate and each prevents a silent wrong hand:

- **It admits all-in players.** The draw round iterates `inHand`, not `canAct`. Routing it
  through the betting machinery would have ended the round early whenever somebody was
  all-in, and shown them down the five they were dealt after they had paid to improve.
- **The discard list is de-duplicated and bounds-checked.** The indices come off a screen,
  and `[0, 0]` would throw one card away and draw two — a deck leak, not a rendering glitch.
- **Nothing else is legal.** `legalActions` returns every betting flag false during the draw.
  Adding that turned up a missing guard on `fold`, which had been unreachable for as long as
  every street was a betting street; `tests/draw.test.ts` folds during the draw and is refused.

Five seats, and that is arithmetic: 25 cards dealt and 25 replacements is 50 against a deck
of 52. A sixth seat needs 60 and `applyAction` throws mid-hand. The equity panel shows an em
dash here — `estimateEquity` works by running out a board and a draw hand has none, so asked
anyway it would deal five community cards onto five hole cards and quote a confident
percentage of nothing.

**Omaha Hi-Lo splits every pot.** Half to the best high hand — ordinary Omaha, same
exactly-two rule — and half to the best **low**: five cards of different ranks, all eight
or lower, ace counting as one, straights and flushes not counting against it. Both halves
obey the exactly-two rule independently, and they usually want different cards. Two things
hold the arithmetic together, both in `resolveShowdown`: **no qualifying low means the high
hand scoops** (about half of all pots — awarding half a pot to an empty winner list would
delete it), and **the odd chip goes high**. `tests/hiLo.test.ts` plays a hundred hands and
asserts the chips paid out equal the chips paid in every time.

**The two-from-hand rule is the one everybody gets wrong**, including several commercial
sites historically. Four hearts in your hand is not a flush unless three hearts are also on
the board. A board that is a full house by itself does not give you that full house — you
must still play two of your own cards. `tests/omaha.test.ts` pins both, plus a property
test that deals 60 random hands and asserts the winning five is always reconstructible as
two hole cards and three board cards.

**Pot-limit, written out, because it is arithmetic with an off-by-one in it.** You may
raise by the size of the pot *after* your call, so the pot you are raising into includes
the chips you are about to put in:

```
maxRaiseTo = committedThisStreet + toCall + (pot + toCall)
```

where `pot` is every chip committed this hand on every street, including the current
round's bets. A first bet on a street has `toCall === 0`, which collapses to "bet the pot".
Capped at the stack, so pot-limit never lets you put in more than you have and never stops
you putting in all of it when the pot is bigger. One consequence worth knowing: on a short
stack the cap can fall below the minimum raise, in which case `canRaise` is false and the
only aggressive action left is calling all-in.

**Equity knows too.** `estimateEquity({ variant })` deals opponents four cards and reads
showdowns under the same rule; without it the AI would be estimating Hold'em equity for an
Omaha hand and playing a different game from the one on the table. `opponentSelectivity` is
**ignored** at Omaha rather than reused — the ranged draw weights two-card holdings by a
Hold'em notion of strength and there is no honest way to stretch that to four, so Omaha
estimates are raw equity against random hands.

**A known approximation, stated rather than hidden.** The Big Pot's opponents use the
Downtown Casino's `AiProfile`, because that is what a 5,000 buy-in seats you against
everywhere else. Their equity reading is genuinely Omaha, but their tightness, aggression
and bluff numbers were banded against two cards. It is the table most in need of a tuning
pass, and it is on the roadmap as such.

**Adding a third variant** would mean: a `Variant` member, an entry in `HOLE_CARDS`, a
branch in `evaluateHand`, whatever betting rule it needs in `legalActions`, and the
`variant` threaded into `estimateEquity`. Nothing else — the store, the table and the
economy all take a `Venue` and never ask what game it is.

## Invariants worth preserving (and how they're tested)

- **Chip conservation**: total chips are constant across a hand (verified over 40
  random AI-vs-AI 6-handed hands in `tests/ai.test.ts`).
- **AI only ever returns legal actions** (else `applyAction` throws — asserted).
- **AI never folds when it can check for free.**
- **Every table in `ALL_VENUES` sits inside a real preflop band** — PFR above 5% and
  below 40%, and never calling more than 8x as often as it raises. The bands are
  measured against the profiles imported from `config/venues.ts`, so a table added or
  retuned there is covered without touching the test. Only `iterations` is overridden
  (down to 90, for suite time); read the note above `MEASURED_ITERATIONS` before
  changing that or the hand count, because both move the numbers more than they look.
- **The ladder's difficulty curve**: VPIP falls rung by rung from the Garage to the
  Main Event, and the top of the ladder raises a far greater share of the pots it
  enters than the bottom. A public claim rides on the second one — relaxing it is a
  copy change first.
- Blinds/first-to-act correct heads-up and multiway; min-raise rejection; all-in
  run-outs; side pots; kickers; ties. See `tests/*.test.ts`.

## Testing

AVA, run with `pnpm test`. Specs: `cards`, `handEval`, `pots`, `engine`, `equity`, `ai`.
`tests/helpers.ts` has `makeDeck(popOrder)` to build a deck whose `pop()` order yields
exactly the cards you want — the key to deterministic scenario tests.

```ts
// deterministic hand: hero AA, villain KK, brick board
const deck = makeDeck(['Ah','Kh','Ad','Kd','2c','7s','Ts','Jc','3d'])
let s = startHand({ seats, buttonIndex: 0, smallBlind: 5, bigBlind: 10, deck })
s = applyAction(s, { type: 'call' })   // ...
```

## Rules of engagement

- Never import React, stores, or browser APIs into `lib/poker/`.
- Any rules change ships with tests.
- Keep transitions pure: `applyAction` clones state (`structuredClone`) and returns a
  new value; callers treat `HandState` as immutable.
