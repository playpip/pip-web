// Thin, typed wrapper over pokersolver. We delegate the fiddly 5-from-7 ranking
// and kicker logic to a battle-tested library; the rest of the engine is ours.

import pokersolver, { type Hand as SolvedHand } from 'pokersolver'
import type { Card, Rank, Suit } from './cards'

// pokersolver is CommonJS; grab Hand off the default (module.exports) object.
// The named import above is type-only (erased at runtime) for the SolvedHand type.
const { Hand } = pokersolver
import { RANKS, SHORT_DECK_RANKS, cardsToStrings } from './cards'
import { compareShortDeck, evaluateShortDeck } from './shortDeck'

export interface EvaluatedHand {
  /** Category label, e.g. "Full House". */
  name: string
  /** Full description incl. kickers, e.g. "Two Pair, A's & K's". */
  description: string
  /** Category rank (higher = better category). */
  categoryRank: number
  /**
   * Opaque solved hand, used for winner comparison — absent at Short Deck.
   *
   * Short Deck reorders the categories (a flush beats a full house) and adds a
   * straight pokersolver cannot see, so its hands are not solved by the library
   * at all and there is nothing to put here. Every consumer that comes through
   * `determineWinners` or `bestFive` is already covered; a caller reaching for
   * `solved` directly has to cope with its absence, which is the point of
   * making it optional rather than faking one.
   */
  readonly solved?: SolvedHand
  /** The five cards that made it, most significant first. */
  readonly best: Card[]
}

/**
 * Which game's rules are being applied.
 *
 * `holdem` is the free-form "best five of seven" everything here has always
 * done. `omaha` is the rule that makes Pot-Limit Omaha a different game rather
 * than Hold'em with more cards: **exactly two of your four, and exactly three
 * of the board.** Four hearts in your hand is not a flush, and the board
 * pairing does not give you a full house on its own.
 *
 * Defaulted everywhere, so every existing caller keeps the behaviour it had.
 */
export type Variant = 'holdem' | 'omaha' | 'shortdeck' | 'omahahilo' | 'draw'

/** How many hole cards a variant deals. */
export const HOLE_CARDS: Record<Variant, number> = {
  holdem: 2,
  omaha: 4,
  shortdeck: 2,
  omahahilo: 4,
  // Five, and there is no board to add to them: a draw hand is the whole hand
  // from the moment it is dealt.
  draw: 5,
}

/**
 * Which ranks are in the deck.
 *
 * Every caller that builds or refills a deck reads this rather than `RANKS`,
 * because a short-deck table dealt from fifty-two cards is not short deck and
 * an equity sim that draws a four into the runout is quietly answering a
 * different question than the table is asking.
 */
export const DECK_RANKS: Record<Variant, readonly Rank[]> = {
  holdem: RANKS,
  omaha: RANKS,
  shortdeck: SHORT_DECK_RANKS,
  omahahilo: RANKS,
  draw: RANKS,
}

/**
 * Does this variant deal four cards and read them two-at-a-time?
 *
 * Hi-Lo's *high* half is ordinary Omaha — same four cards, same exactly-two
 * rule — so every high-hand path here treats them identically. The low half is
 * a different question entirely and lives in `hiLo.ts`.
 */
export const isOmaha = (variant: Variant): boolean => variant === 'omaha' || variant === 'omahahilo'

/** Every k-sized combination of `items`, as index tuples. Small n only. */
function combinations<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = []
  const pick = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc)
      return
    }
    for (let i = start; i < items.length; i++) pick(i + 1, [...acc, items[i]])
  }
  pick(0, [])
  return out
}

/**
 * The best legal Omaha five, by enumeration.
 *
 * Six ways to pick two of four, ten ways to pick three of five: sixty hands,
 * each solved as an exact five-card holding and compared by pokersolver's own
 * `winners`. Enumerated rather than reasoned about because the reasoning is
 * where Omaha evaluators go wrong, and sixty `solve` calls at a showdown is
 * nothing — the equity sim is the hot path and it is bounded by its own
 * iteration count.
 *
 * **Not routed through pokersolver's own 'omahahi' game.** That option exists
 * in some versions of the library and is undocumented in the one we pin; this
 * project has a blog post about trusting exactly that (`pokersolver`'s
 * undocumented behaviour), so the rule is implemented here where it can be
 * tested rather than assumed.
 */
function solveOmaha(holeCards: readonly Card[], communityCards: readonly Card[]): SolvedHand {
  const candidates: SolvedHand[] = []
  for (const two of combinations(holeCards, 2)) {
    for (const three of combinations(communityCards, 3)) {
      candidates.push(Hand.solve(cardsToStrings([...two, ...three])))
    }
  }
  // `winners` returns every hand tied for best; they are equal by definition,
  // so the first is as good as any.
  return Hand.winners(candidates)[0] ?? candidates[0]
}

/**
 * Evaluate the best 5-card hand from a player's hole + community cards.
 *
 * **Before there are three community cards there is no legal Omaha hand**, so
 * the variant falls back to a free solve of whatever is on the table. Nothing
 * settles a pot in that state — a showdown always has five board cards — and
 * the only callers are strength estimates before a board exists. Stated here
 * because a silent fallback in a rules file is how a wrong showdown ships.
 */
export function evaluateHand(
  holeCards: readonly Card[],
  communityCards: readonly Card[],
  variant: Variant = 'holdem',
): EvaluatedHand {
  // Short Deck never reaches pokersolver: its categories are in a different
  // order and one of its straights is invisible to the library (see shortDeck).
  if (variant === 'shortdeck') {
    const hand = evaluateShortDeck([...holeCards, ...communityCards])
    return {
      name: hand.name,
      description: hand.description,
      categoryRank: hand.categoryRank,
      best: hand.cards,
    }
  }
  const solved =
    isOmaha(variant) && communityCards.length >= 3 && holeCards.length >= 2
      ? solveOmaha(holeCards, communityCards)
      : Hand.solve(cardsToStrings([...holeCards, ...communityCards]))
  return {
    name: solved.name,
    description: solved.descr,
    categoryRank: solved.rank,
    solved,
    best: solvedBestFive(solved),
  }
}

/**
 * The five cards the evaluator actually used, in its own order: the cards that
 * make the hand first, then the kickers, each descending.
 *
 * That order is the useful part. Two hands of the same category can be walked
 * card by card until they differ, and the card they differ on is the one that
 * settled it, which is how a grade explains itself in a sentence instead of
 * asserting a winner.
 *
 * Two things the solver does that the name here does not: it hands back **six
 * or seven cards** where more than five are eligible (every card of a six-card
 * flush, both trips of a full house), and it renames an ace playing low in a
 * five-high straight to '1'. Both are handled. The list stays in its own
 * descending order through the overflow, so the first five are the hand.
 */
export function bestFive(hand: EvaluatedHand): Card[] {
  return hand.best
}

/** The solver's five, in its own order. Short Deck brings its own. */
function solvedBestFive(solved: SolvedHand): Card[] {
  return solved.cards.slice(0, 5).map((card) => ({
    rank: (card.value === '1' ? 'A' : card.value) as Rank,
    suit: card.suit as Suit,
  }))
}

/**
 * "a full house" / "two pair". A made hand in words, ready to sit in a
 * sentence. The article is part of the phrase because English will not give it
 * up. Names come from the solver; anything unrecognised returns null and the
 * caller leaves the clause off rather than shipping "won with undefined".
 *
 * Here rather than beside one of its callers: the recap says this after a hand
 * and a drill says it in a grade, and two copies of this map is one copy too
 * many.
 */
const HAND_PHRASES: Record<string, string> = {
  'High Card': 'high card',
  Pair: 'a pair',
  'Two Pair': 'two pair',
  'Three of a Kind': 'three of a kind',
  Straight: 'a straight',
  Flush: 'a flush',
  'Full House': 'a full house',
  'Four of a Kind': 'four of a kind',
  // A royal is a straight flush by name; only the description tells them apart.
  'Straight Flush': 'a straight flush',
}

export function handPhrase(hand: Pick<EvaluatedHand, 'name' | 'description'>): string | null {
  if (hand.description === 'Royal Flush') return 'a royal flush'
  return HAND_PHRASES[hand.name] ?? null
}

export interface HandContenders<T> {
  /** Caller-supplied id/handle for a player. */
  id: T
  hole: readonly Card[]
}

export interface ShowdownResult<T> {
  /** Winning player ids (more than one on a tie). */
  winners: T[]
  /** Every contender's evaluated hand, keyed by id, for display. */
  evaluations: Map<T, EvaluatedHand>
}

/**
 * Compare contenders sharing a board and return the winner id(s). Ties (equal
 * hands) yield multiple winners so the caller can split the pot.
 */
export function determineWinners<T>(
  contenders: readonly HandContenders<T>[],
  communityCards: readonly Card[],
  variant: Variant = 'holdem',
): ShowdownResult<T> {
  const evaluations = new Map<T, EvaluatedHand>()
  for (const c of contenders) {
    evaluations.set(c.id, evaluateHand(c.hole, communityCards, variant))
  }

  // Short Deck compares on its own score because the library's ordering is
  // wrong for it by design. Everything else stays on `Hand.winners`, which is
  // the battle-tested path and not worth re-deriving for the sake of symmetry.
  if (variant === 'shortdeck') {
    const scored = contenders.map((c) => ({
      id: c.id,
      score: evaluateShortDeck([...c.hole, ...communityCards]).score,
    }))
    let bestScore = scored[0]?.score ?? []
    for (const s of scored) if (compareShortDeck(s.score, bestScore) > 0) bestScore = s.score
    return {
      winners: scored.filter((s) => compareShortDeck(s.score, bestScore) === 0).map((s) => s.id),
      evaluations,
    }
  }

  const solvedList = contenders.map((c) => evaluations.get(c.id)!.solved!)
  const winningSolved = new Set(Hand.winners(solvedList))

  const winners = contenders
    .filter((c) => winningSolved.has(evaluations.get(c.id)!.solved!))
    .map((c) => c.id)

  return { winners, evaluations }
}
