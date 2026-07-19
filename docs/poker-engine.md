# The Poker Engine

`src/lib/poker/` is a **pure, framework-free, deterministic, unit-tested** Texas
Hold'em engine. No React, no I/O, no globals. It is the source of truth for the rules.
Everything here is portable to a server unchanged.

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
- `evaluateHand(hole, community): EvaluatedHand` — best 5-from-7; `{ name, description, categoryRank, solved }`.
- `determineWinners(contenders, community): { winners, evaluations }` — handles ties
  (multiple winners share) and kickers. This is what showdown uses.

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
- `startHand(opts): HandState` — deals hole cards, posts blinds (heads-up: button =
  SB and acts first preflop; multiway: SB left of button, action starts left of BB).
  Accepts a seeded `rng` or a preset `deck` (drawn from the **end** via `pop()`).
- `legalActions(state): LegalActions | null` — what the player to act may do, with
  `callAmount`, `minRaiseTo`, `maxRaiseTo` (all-in), and can-flags.
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
  clamped to legal bounds.
- `opponentSelectivity(state, opp)` is exported and shared with the store's hero
  "win %" read, so both sides model opponent ranges identically.
- Difficulty scales per venue via the profile (see `config/venues.ts`).

## Invariants worth preserving (and how they're tested)

- **Chip conservation**: total chips are constant across a hand (verified over 40
  random AI-vs-AI 6-handed hands in `tests/ai.test.ts`).
- **AI only ever returns legal actions** (else `applyAction` throws — asserted).
- **AI never folds when it can check for free.**
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
