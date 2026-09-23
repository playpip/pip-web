// The membership, in one file.
//
// **The price is written down once.** technology#52 asked for exactly this and
// the reason is the failure it prevents: a price that lives in the page, the
// settings row, the prompt, the Terms section and the Stripe config is five
// numbers that agree until the day one of them is edited. If £5.99 ever
// changes, it changes here and nowhere else.
//
// What this file is *not* is the entitlement check. Whether a given player is a
// member is `useEntitlement()` in src/store/entitlement.ts, which reads a row
// the client cannot write. This file only describes what a membership is and
// what comes with it. Keeping those apart is the point: a price list that could
// grant entitlement would be entitlement in a file anyone can edit.

/**
 * Carried by anything the membership gates: a drill kind, a venue, a cast
 * member, a cosmetic, a format.
 *
 * **Absent means free, and that is not a default anyone may change later.** A
 * new thing meant to be paid must carry this flag in the same commit that
 * registers it, or it is free by accident and the box the membership is priced
 * from empties itself on the way to being sold (technology#55).
 *
 * Rule 1 is what stops the flag travelling in the other direction, and on
 * 2026-09-20 it was narrowed: it now protects the **core game** — the ladder,
 * the Rail, the Daily, the freeroll — rather than everything that happened to
 * be free on a given day. The side tables moved behind the check in that same
 * change, before Stripe existed and before anybody could have relied on them.
 * `tests/sitDown.test.ts` holds the new line; docs/membership.md carries the
 * full account, including why this is the only time it happens.
 */
export interface MembersOnly {
  membersOnly?: boolean
}

/**
 * Does this player get this thing?
 *
 * One function for every gated surface in the app, so a venue, a drill and a
 * card back cannot come to different answers about the same player. `member`
 * comes from `useEntitlement()` and nothing here knows where that got it.
 *
 * Deliberately trivial. The interesting question — what counts as a member —
 * is decided once in lib/membership/entitlement.ts, and the reason this is one
 * line is that it must never become a second place where that is re-litigated.
 */
export function included(thing: MembersOnly, member: boolean): boolean {
  return member || !thing.membersOnly
}

/**
 * What a membership costs, in pounds — the base every other currency in
 * `MEMBERSHIP_PRICES` is set from.
 *
 * **Both prices are tax-inclusive** (`tax_behavior: 'inclusive'` on the Stripe
 * price), in every currency, so the number shown is the number that leaves the
 * customer's bank and the page never needs a "plus VAT". That is a deliberate
 * trade — our net varies by local rate instead — and at this price it is the
 * right one.
 *
 * **Adaptive Pricing is off** (CMO's call, cmo#71). With it on, Stripe converts
 * at checkout and builds a 2-4% fee into the rate, so the number on the page
 * stops being the number on the statement. Other currencies are fixed prices
 * of their own instead — see `MEMBERSHIP_PRICES`.
 */
export const MEMBERSHIP_PRICE = {
  /** Pence, so arithmetic never touches a float. */
  monthlyPence: 599,
  annualPence: 4900,
  currency: 'GBP',
  /** What the page and the settings row say. Derived nowhere — read them. */
  monthly: '£5.99',
  annual: '£49',
} as const

/** The currencies the membership is sold in. GBP is the base every other one is set from. */
export type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'CNY'

/** What the membership costs in one currency. */
export interface LocalPrice {
  currency: CurrencyCode
  /** The symbol the page writes before a number. */
  symbol: string
  /** Minor units (pence, cents, fen), so arithmetic never touches a float. */
  monthlyMinor: number
  annualMinor: number
  /** What the page says. Pinned against the minor units by tests/membership.test.ts. */
  monthly: string
  annual: string
  /**
   * Units of this currency per pound when the price was set. **Not used to
   * charge anybody** — the prices above are fixed, and Stripe charges them as
   * written. It is here so the test can check a price was converted and rounded
   * rather than typed, and so the next person to reprice knows where they were.
   */
  ratePerGbp: number
}

/**
 * The membership in every currency we sell it in (Will, 2026-09-23: "convert to
 * nearest rounded currency for each region").
 *
 * **Fixed local prices, not conversion.** Each is its own number on the Stripe
 * price (`currency_options`), so an American pays exactly $7.99 and the page is
 * still telling the truth when it says the number shown is the number charged.
 * That is why Adaptive Pricing stays off (cmo#71): what it objected to was a
 * rate with a fee built into it, and there is no rate here at checkout at all.
 *
 * **The rounding rule is the pound's own shape**: the monthly price to the
 * nearest .99, the yearly to the nearest whole unit. Yuan are priced in whole
 * yuan both ways, which is how prices in China are written. Rates were set on
 * 2026-09-23; repricing is a deliberate act, never a live feed.
 *
 * Every price is tax-inclusive, like the pound's.
 */
export const MEMBERSHIP_PRICES: Record<CurrencyCode, LocalPrice> = {
  GBP: {
    currency: 'GBP',
    symbol: '£',
    monthlyMinor: MEMBERSHIP_PRICE.monthlyPence,
    annualMinor: MEMBERSHIP_PRICE.annualPence,
    monthly: MEMBERSHIP_PRICE.monthly,
    annual: MEMBERSHIP_PRICE.annual,
    ratePerGbp: 1,
  },
  USD: {
    currency: 'USD',
    symbol: '$',
    monthlyMinor: 799,
    annualMinor: 6600,
    monthly: '$7.99',
    annual: '$66',
    ratePerGbp: 1.34,
  },
  EUR: {
    currency: 'EUR',
    symbol: '€',
    monthlyMinor: 699,
    annualMinor: 5700,
    monthly: '€6.99',
    annual: '€57',
    ratePerGbp: 1.16,
  },
  CNY: {
    currency: 'CNY',
    symbol: '¥',
    monthlyMinor: 5800,
    annualMinor: 47000,
    monthly: '¥58',
    annual: '¥470',
    ratePerGbp: 9.6,
  },
}

/** In the order the picker shows them. */
export const CURRENCIES: readonly CurrencyCode[] = ['GBP', 'USD', 'EUR', 'CNY']

/** Minor units as the page writes them: "£4.08", "$66", "¥39". */
export function formatPrice(minor: number, currency: CurrencyCode): string {
  const { symbol } = MEMBERSHIP_PRICES[currency]
  const whole = minor % 100 === 0
  return `${symbol}${(minor / 100).toFixed(whole ? 0 : 2)}`
}

/**
 * Stripe's price ids, from the environment.
 *
 * Not literals: the test-mode and live-mode ids differ, and a live id committed
 * to a public repo is a thing we would rather not explain. Undefined until the
 * Stripe account exists (technology#52 item C), and every caller has to cope
 * with that rather than assume — see `checkoutReady()`.
 */
export const MEMBERSHIP_PRICE_IDS = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY,
  annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL,
} as const

/**
 * Can anybody actually buy this yet?
 *
 * False in every build until the Stripe ids are configured, and the join button
 * reads this rather than rendering hopefully. **A button that starts a checkout
 * which cannot complete is worse than no button**, and until item C lands that
 * is the only checkout we have.
 */
export function checkoutReady(): boolean {
  return Boolean(MEMBERSHIP_PRICE_IDS.monthly && MEMBERSHIP_PRICE_IDS.annual)
}

/**
 * One thing the membership includes.
 *
 * `shipped` is the field that keeps this honest, and it is not bookkeeping.
 * The page built from this list is a sales page, and a sales page listing a
 * feature that does not exist is the exact thing the ROADMAP's "How Pip pays
 * for itself" section exists to catch us doing. So the page renders `shipped`
 * entries and nothing else, and `tests/membership.test.ts` fails the build if
 * an unshipped entry is ever marked as sellable.
 *
 * Flip `shipped` in the commit that ships the feature. Never before it, and
 * never "it's nearly done".
 */
export interface MembershipFeature {
  id: string
  /** The name a player would use for it. */
  title: string
  /** One line. What you get, in plain words, no adjectives doing work. */
  blurb: string
  /** Live in the app right now. Nothing else may be advertised. */
  shipped: boolean
}

/**
 * Everything the membership includes, shipped or not.
 *
 * Kept in one list rather than split into shipped/coming so that the two cannot
 * drift apart, and so the honest question — "is this real yet?" — is a field on
 * the thing rather than which array it was filed in.
 */
export const MEMBERSHIP_FEATURES: readonly MembershipFeature[] = [
  {
    id: 'drills',
    title: 'Every drill',
    blurb:
      'Which five play, count your outs, pot odds, who gets there, calling the river, and the play-it-out mode — graded by the engine, never metered, and pitched at the level you are actually reading at. "What have you got?" and "Which hand wins?" stay free for everyone, forever.',
    shipped: true,
  },
  {
    // The first practice pack (2026-09-23). A drill kind in the registry, but
    // listed on its own because it is the first one that teaches before it
    // asks, and the one the report's leak cards send you to.
    id: 'river',
    title: 'Calling the river',
    blurb:
      'A bet in front of you on the last card, and nothing left to come. A short lesson, then ten spots on the felt: fold or call, and see exactly what they were betting with — the value hands you beat, the misses, the hands that beat you. Only ever asked where the answer holds whether they bluff a little or a lot.',
    shipped: true,
  },
  {
    id: 'rooms',
    // Was "Four member rooms", naming The Lock-In, The Back Room, The Rematch
    // and Last Orders — none of which have existed since they collapsed into
    // Deep Stack (2026-09-19). A sales page naming four rooms a buyer cannot
    // find is the exact failure this list's `shipped` flag exists to prevent,
    // arriving by a different door: the feature was real, the names went stale.
    title: 'Deep Stack, at five prices',
    blurb:
      'Three times the usual chips and a slow clock, from 750 up to 40,000. Post-flop poker where the stacks are deep enough to actually play it. Ordinary tables in every other way: they count towards your rank like any other.',
    shipped: true,
  },
  {
    id: 'custom-tables',
    title: 'Build your own table',
    blurb:
      'Pick the seats, the stakes, how deep you sit, how fast the blinds climb, whether heads are worth money, and which of the regulars sit down with you. Invite anybody you like: a high roller at a cheap table brings their own game with them, so you can play the hardest company in the cast for a price you can afford to lose. The prize is the same either way, and nobody you invite can ever make a table softer than its price.',
    shipped: true,
  },
  {
    id: 'omaha',
    title: 'Pot-Limit Omaha',
    blurb:
      'Four cards each, and you must use exactly two of them with exactly three from the board. Pot-limit betting, deep stacks, and the same cast you already know. A genuinely different game, at The Big Pot.',
    shipped: true,
  },
  {
    id: 'shortdeck',
    title: 'Short Deck',
    blurb:
      'Thirty-six cards — the deuces through fives are thrown away — and two rules come with them: a flush beats a full house, and the ace plays low under the six, so A-6-7-8-9 is a straight. Far more of it connects. Three stakes.',
    shipped: true,
  },
  {
    id: 'hilo',
    title: 'Omaha Hi-Lo',
    blurb:
      'Every pot cut in half: one half to the best hand, the other to the best low — five different ranks, all eight or lower, ace counting as one. You still use exactly two from your hand for each half, and they are rarely the same two.',
    shipped: true,
  },
  {
    // Shipped behind the check on the day The Parlour did and went unlisted
    // until 2026-09-22 — the `shipped` flag catches a page advertising what
    // does not exist, and nothing catches the reverse. A buyer reading this
    // list should find every game they are paying for in it.
    id: 'draw',
    title: 'Five-Card Draw',
    blurb:
      'Five cards each, face down, and no board at all — nothing on the table to read and nothing to share. Bet, throw away as many as you like and take replacements, bet again, show. The only thing anybody learns all hand is how many cards you asked for. Two stakes, at The Parlour.',
    shipped: true,
  },
  {
    id: 'side-tables',
    title: 'Every side table',
    blurb:
      'Fast, Heads-Up, Bounty and Deep — the game you know with one screw turned, at twelve stakes between them. None of them gate your climb up the free ladder.',
    shipped: true,
  },
  {
    id: 'blackjack',
    title: 'Blackjack, for some reason',
    blurb:
      'It is not poker and we are not going to pretend otherwise: there are no opponents, no position and nothing to out-play, because the dealer draws to seventeen whatever you do. Three houses, and each one tells you its edge before you sit down. A curiosity, priced honestly.',
    shipped: true,
  },
  {
    id: 'coaching',
    title: 'Coaching that reads you, not just the hand',
    blurb:
      'A report drawn from every hand you have played: what it is costing you in big blinds, which street the money leaves by, and the hands it happened in. Every line is a ratio of two things that were counted, shown against where a sound player sits. The per-hand read stays free.',
    shipped: true,
  },
  {
    id: 'progress',
    title: 'Your rating, drawn',
    blurb:
      'Every drill keeps a rating that moves both ways, and your stats draw it spot by spot, next to how often you are right and your best run. No streaks and no clock: it is exactly where you left it whenever you come back.',
    shipped: true,
  },
  {
    id: 'review',
    title: 'Session review',
    blurb:
      'Stand up and play the whole session again, hand by hand — the board dealing in, your cards, and what the pot was charging at each call you made. The hands worth a second look are picked out for you. Ladder, Rail and the Daily.',
    shipped: true,
  },
  {
    id: 'god-view',
    title: 'Watch it out after you bust',
    blurb:
      'Stay at the table when you are knocked out and see it played down to one, every hand face up. Tap anyone still in for their cards and their chance of taking it. Only ever once you are out, so there is nothing to act on.',
    shipped: true,
  },
  {
    // Was "Member card backs", described as "one per member room, in that
    // room's colour" — which named rooms that stopped existing when they
    // collapsed into Deep Stack, the same way the `rooms` entry above did. The
    // backs outlived the rooms, and there are five categories now.
    id: 'cosmetics',
    title: 'The members’ shelf',
    blurb:
      'Card backs that wear a real foil, a gilt ring round your avatar, a brass dealer button, a deep sound for the table and two more table finishes. Some come with the membership; the rest the membership lets you buy with chips you won — and anything you spend chips on stays yours for good, membership or not. Nothing in the Chip Shop is ever payable in money.',
    shipped: true,
  },
  {
    id: 'multiplayer',
    title: 'Multiplayer, when it lands',
    blurb: 'Real tables against real people. The biggest thing on the roadmap and not built yet.',
    shipped: false,
  },
]

/** The ones a page may advertise. */
export function sellableFeatures(): readonly MembershipFeature[] {
  return MEMBERSHIP_FEATURES.filter((feature) => feature.shipped)
}

/**
 * The two promises that bound what the membership may ever contain.
 *
 * Here as strings because they are said out loud on `/membership` rather than
 * only kept in docs. A rule the customer can read is a rule we can be held to,
 * which is the whole mechanism this product's positioning runs on.
 */
export const MEMBERSHIP_PROMISES = [
  'The core game is free forever: the ten-venue ladder, the Rail, the Daily and the freeroll. The membership is the side tables and the games that are not Hold’em.',
  'Nothing you can buy changes a hand — not the cards, the odds, what you are shown, or a rebuy.',
] as const

/**
 * Where the cancel button is, said plainly.
 *
 * On the page on purpose (technology#52 item 6). "cancel pip membership" is a
 * query typed by somebody who wants to cancel, and landing them on a sales page
 * serves the wrong intent. It is also the single best proof of the
 * "cancel any time" claim, sitting on the page that makes it.
 */
export const HOW_TO_CANCEL =
  'Settings → Membership → Manage. One click to the portal, one to cancel. It runs to the end of the period you have paid for, and we do not ask you why.'
