// Minimal typings for pokersolver (ships no types of its own). It's a CommonJS
// module whose module.exports carries the Hand class, so we type the default.
declare module 'pokersolver' {
  export class Hand {
    /** Human-readable category, e.g. "Two Pair", "Flush". */
    name: string
    /** Full description, e.g. "Two Pair, A's & K's". */
    descr: string
    /** Numeric category rank (higher = stronger hand category). */
    rank: number
    cards: unknown[]
    /** Solve the best 5-card hand from 5–7 card strings like ["Ah","Kd",...]. */
    static solve(cards: string[], game?: string, canDisqualify?: boolean): Hand
    /** Given solved hands, return the winning hand(s) (ties share). */
    static winners(hands: Hand[]): Hand[]
  }

  const pokersolver: { Hand: typeof Hand }
  export default pokersolver
}
