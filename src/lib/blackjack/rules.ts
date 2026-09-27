// The three tables, and what actually differs between them.
//
// **Difficulty here is house rules, not a better dealer.** The dealer has no
// decisions to make — it draws to a number and stops, and that is the whole of
// its strategy — so there is no skill knob to turn. What a casino turns instead
// is the paytable and the deck count, and those are the levers here. Every one
// of them is stated on the card before you sit down, because a house edge you
// have to discover is the thing this app exists not to do.
//
// **The edge figures were recalculated on 2026-09-20**, when the table dropped
// to hit and stand only. They are not decoration and they are not the numbers
// a casino would quote for the same deck count and paytable — removing
// doubling costs a basic-strategy player about 1.5% and removing splitting
// about 0.6%, so every table here is roughly two points worse than its
// real-world namesake. Saying "0.15%" over a game with no double would have
// been a straightforwardly false claim on the one screen whose whole argument
// is that we tell you the number.
//
// Two fields went with those actions: `doubleAfterSplit` and `surrender`. Both
// described choices the player no longer has, and a rule that cannot apply is
// worse than no rule — it reads as a difference between tables that is not one.

export interface HouseRules {
  id: 'friendly' | 'standard' | 'brutal'
  name: string
  /** One line for the picker row. */
  blurb: string
  /** How many 52-card decks in the shoe. Fewer is (slightly) better for you. */
  decks: number
  /** Dealer draws on soft 17 rather than standing. Worse for the player. */
  hitsSoft17: boolean
  /** What a natural pays, as a multiple of the bet. 1.5 is 3:2; 1.2 is 6:5. */
  blackjackPays: number
  /**
   * House edge against basic strategy **for this table as it is actually
   * dealt** — hit and stand only. Shown, not hidden.
   */
  edgePercent: number
}

export const HOUSE_RULES: readonly HouseRules[] = [
  {
    id: 'friendly',
    name: 'Friendly',
    blurb: 'Single deck, 3:2 on a natural, dealer stands on soft 17.',
    decks: 1,
    hitsSoft17: false,
    blackjackPays: 1.5,
    edgePercent: 2,
  },
  {
    id: 'standard',
    name: 'Standard',
    blurb: 'Six decks, 3:2 on a natural, dealer stands on soft 17.',
    decks: 6,
    hitsSoft17: false,
    blackjackPays: 1.5,
    edgePercent: 2.4,
  },
  {
    id: 'brutal',
    name: 'Brutal',
    blurb: 'Eight decks, 6:5 on a natural, dealer hits soft 17.',
    decks: 8,
    hitsSoft17: true,
    blackjackPays: 1.2,
    edgePercent: 4.1,
  },
]

export function houseRulesById(id: string): HouseRules {
  const rules = HOUSE_RULES.find((r) => r.id === id)
  if (!rules) throw new Error(`no house rules with id ${id}`)
  return rules
}

/** The stacks you may sit down with, in Roll chips. One-to-one with the table. */
export const BLACKJACK_STACKS: readonly number[] = [500, 2_000, 10_000, 50_000]
