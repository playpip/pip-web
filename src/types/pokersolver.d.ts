// Minimal typings for pokersolver (ships no types of its own). It's a CommonJS
// module whose module.exports carries the Hand class, so we type the default.
declare module 'pokersolver' {
  /**
   * One card of a solved hand. Not the same shape as our own Card: the rank
   * lives on `value`, and an ace playing low in a five-high straight is
   * rewritten to '1' (with `rank` 0) by the solver itself.
   */
  export interface SolvedCard {
    /** '2' to '9', 'T', 'J', 'Q', 'K', 'A', or '1' for an ace playing low. */
    value: string
    /** 'c' | 'd' | 'h' | 's'. */
    suit: string
    /** Index in rank order: 0 is a deuce (or a low ace), 13 an ace. */
    rank: number
  }

  export class Hand {
    /** Human-readable category, e.g. "Two Pair", "Flush". */
    name: string
    /** Full description, e.g. "Two Pair, A's & K's". */
    descr: string
    /** Numeric category rank (higher = stronger hand category). */
    rank: number
    /**
     * The cards the solver used, its own order: the cards that make the hand
     * first, then the kickers, each descending. **Not always five** - where
     * more than five are eligible (a six-card flush, a full house made of two
     * trips) every eligible card is here. The first five are the hand; use
     * `bestFive()` in `lib/poker/handEval` rather than reading this directly.
     */
    cards: SolvedCard[]
    /** Solve the best 5-card hand from 5–7 card strings like ["Ah","Kd",...]. */
    static solve(cards: string[], game?: string, canDisqualify?: boolean): Hand
    /** Given solved hands, return the winning hand(s) (ties share). */
    static winners(hands: Hand[]): Hand[]
  }

  const pokersolver: { Hand: typeof Hand }
  export default pokersolver
}
