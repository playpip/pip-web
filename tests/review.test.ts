import test from 'ava'
import { scoreDecisions, EDGE_FLOOR, type HeroDecision, type Scored } from '@/lib/coach'
import {
  COSTLY_BB,
  SHARP_EDGE,
  gradeDecision,
  gradeLabel,
  isMistake,
  marginLine,
} from '@/lib/review/grade'
import { handGrade, tallySession, type ReviewSession } from '@/lib/review/session'
import { highlightsOf, highlightsOfHand, isNotable } from '@/lib/review/highlights'
import { cardFromString } from '@/lib/poker/cards'
import {
  reviewableVenue,
  VENUES,
  RING_TABLES,
  SIDE_TABLES,
  CHALLENGE_TABLES,
  DEEP_STACK_TABLES,
  SHORT_DECK_TABLES,
  HI_LO_TABLES,
  DRAW_TABLES,
  THE_DAILY,
  KITCHEN_TABLE,
  BIG_POT,
  CUSTOM_TABLE_ROUTE,
} from '@/config/venues'
import type { HandEvent, HandRecord } from '@/store/game'

const cards = (...s: string[]) => s.map(cardFromString)
const HERO = { playerId: 'hero', playerName: 'Will' }

function decision(over: Partial<HeroDecision> = {}): HeroDecision {
  return { pot: 600, toCall: 200, opponents: 1, selectivity: [0.5], board: [], ...over }
}

/** A hand with as many priced hero decisions as you hand it. */
function hand(
  steps: { type: 'call' | 'fold' | 'check' | 'bet'; d?: HeroDecision }[],
  over: Partial<HandRecord> = {},
): HandRecord {
  const events: HandEvent[] = steps.map(({ type, d }) => ({
    kind: 'action',
    ...HERO,
    type,
    amount: d?.toCall,
    decision: d,
  }))
  return {
    handNo: 4,
    smallBlind: 25,
    bigBlind: 50,
    events,
    community: cards('Ah', 'Kh', '9s'),
    reveals: [{ ...HERO, cards: cards('7c', '2d') }],
    summary: 'Vivienne wins 800',
    ...over,
  }
}

/** A scored decision built to order, so the bands can be tested exactly. */
function scored(over: Partial<Scored> = {}): Scored {
  return {
    decision: decision(),
    folded: false,
    eventIndex: 0,
    required: 0.25,
    equity: 0.45,
    margin: 100,
    ...over,
  }
}

// --- what gets scored at all ------------------------------------------------

test('every priced decision in the hand is scored, in the order they were made', (t) => {
  const flop = cards('Ah', 'Kh', '9s')
  const turn = cards('Ah', 'Kh', '9s', '3d')
  const all = scoreDecisions(
    hand([
      { type: 'call', d: decision({ pot: 100, toCall: 50, board: [] }) },
      { type: 'call', d: decision({ pot: 600, toCall: 200, board: flop }) },
      { type: 'fold', d: decision({ pot: 2000, toCall: 400, board: turn }) },
    ]),
  )
  t.is(all.length, 3)
  t.deepEqual(
    all.map((s) => s.eventIndex),
    [0, 1, 2],
  )
  t.deepEqual(
    all.map((s) => gradeDecision(s, 50).street),
    ['preflop', 'flop', 'turn'],
  )
})

test('a bet is never graded, because nothing here can price fold equity', (t) => {
  // What makes a bet good is whether they fold, which is a guess about an
  // opponent rather than a number on the table. The review inherits that limit
  // from lib/coach.ts and must not quietly start marking bets right or wrong.
  const all = scoreDecisions(
    hand([
      { type: 'bet', d: decision({ pot: 600, toCall: 0 }) },
      { type: 'check', d: decision({ pot: 600, toCall: 0 }) },
    ]),
  )
  t.is(all.length, 0)
})

test('scoring never reaches for an opponent’s revealed cards', (t) => {
  // The easiest bug in the whole feature: grading a call against what they
  // turned out to hold. That teaches results rather than decisions. The same
  // hand, with and without the opponent showing the nuts, must score the same.
  const board = cards('Ah', 'Kh', '9s')
  const base = hand([{ type: 'call', d: decision({ board, pot: 600, toCall: 200 }) }], {
    community: board,
  })
  const blind = scoreDecisions(base)
  const shown = scoreDecisions({
    ...base,
    reveals: [
      ...base.reveals,
      { playerId: 'ai0', playerName: 'Vivienne', cards: cards('Ac', 'Ad'), handName: 'Trips' },
    ],
  })
  t.deepEqual(shown, blind)
})

// --- the grades -------------------------------------------------------------

test('a spot inside the noise floor is marked as unknowable, not as an error', (t) => {
  // The free read goes silent here. A review that claims to list every decision
  // cannot go silent, so it says the estimate cannot call it — which is the
  // honest thing and the reason this grade exists.
  const d = gradeDecision(scored({ required: 0.4, equity: 0.4 + EDGE_FLOOR / 2 }), 50)
  t.is(d.grade, 'close')
  t.is(d.verdict, 'unknowable')
  t.is(gradeLabel(d), 'Nothing in it')
  t.is(marginLine(d), null)
  t.false(isMistake(d.grade))
})

test('right on a thin edge reads as sharp; right on a wide one reads as sound', (t) => {
  const thin = gradeDecision(scored({ required: 0.4, equity: 0.4 + SHARP_EDGE / 2 }), 50)
  const wide = gradeDecision(scored({ required: 0.2, equity: 0.8 }), 50)
  t.is(thin.grade, 'sharp')
  t.is(wide.grade, 'sound')
  t.is(thin.verdict, 'right')
  t.is(wide.verdict, 'right')
})

test('a mistake is sized in big blinds, not chips', (t) => {
  // The same chips are a catastrophe at the Garage and a rounding error at the
  // Main Event. Four big blinds is four big blinds at both.
  const bb = 50
  const slip = gradeDecision(
    scored({ required: 0.5, equity: 0.1, margin: -(COSTLY_BB - 1) * bb }),
    bb,
  )
  const costly = gradeDecision(scored({ required: 0.5, equity: 0.1, margin: -COSTLY_BB * bb }), bb)
  t.is(slip.grade, 'slip')
  t.is(costly.grade, 'costly')
  t.is(costly.bb, -COSTLY_BB)
  t.true(isMistake(slip.grade) && isMistake(costly.grade))
})

test('the wrong call and the wrong fold are named as what they were', (t) => {
  const called = gradeDecision(
    scored({ folded: false, required: 0.5, equity: 0.1, margin: -600 }),
    50,
  )
  const folded = gradeDecision(
    scored({ folded: true, required: 0.1, equity: 0.8, margin: -600 }),
    50,
  )
  t.is(gradeLabel(called), 'Paid too much')
  t.is(gradeLabel(folded), 'Folded the best of it')
  // The unit is spelled out: "12.0bb" is a sentence in a language the reader
  // may not speak.
  t.is(marginLine(called), 'Folding was 12.0 big blinds cheaper')
  t.is(marginLine(folded), 'Calling was worth 12.0 big blinds')
})

// --- the session ------------------------------------------------------------

function session(hands: ReviewSession['hands']): ReviewSession {
  return {
    venueId: 'garage',
    venueName: "Friends' Garage",
    accent: '#7C8CF0',
    cash: false,
    startedAt: 0,
    endedAt: null,
    outcome: null,
    hands,
    dropped: 0,
  }
}

test('the session tally counts every spot and sums only big blinds', (t) => {
  const right = gradeDecision(scored({ required: 0.2, equity: 0.8, margin: 200 }), 50)
  const wrong = gradeDecision(scored({ required: 0.5, equity: 0.1, margin: -300 }), 50)
  const close = gradeDecision(scored({ required: 0.4, equity: 0.4 }), 50)
  const record = hand([])
  const tally = tallySession(
    session([
      { record: { ...record, heroDelta: 400 }, decisions: [right, close] },
      { record: { ...record, heroDelta: -300 }, decisions: [wrong] },
      { record: { ...record, heroDelta: 0 }, decisions: [] },
    ]),
  )
  t.is(tally.hands, 3)
  t.is(tally.handsWithDecisions, 2)
  t.is(tally.priced, 3)
  t.is(tally.right, 1)
  t.is(tally.wrong, 1)
  t.is(tally.close, 1)
  t.is(tally.bbWon, 4)
  t.is(tally.bbGivenUp, 6)
  t.is(tally.chips, 100)
})

test('a hand is labelled by its worst mistake, not by its biggest number', (t) => {
  // A hand can hold a 12bb good call and a 4bb error. The list exists to find
  // the error, so the error is what the row wears.
  const great = gradeDecision(scored({ required: 0.2, equity: 0.9, margin: 600 }), 50)
  const error = gradeDecision(scored({ required: 0.5, equity: 0.1, margin: -150 }), 50)
  const worst = handGrade({ record: hand([]), decisions: [great, error] })
  t.is(worst?.grade, 'slip')
  t.is(handGrade({ record: hand([]), decisions: [] }), null)
})

// --- the hands worth opening first ------------------------------------------

test('a big pot, a costly call and a rare hand all earn a highlight', (t) => {
  const record = hand([])
  // The pot won and the chips given up are deliberately the same size, so the
  // order below is the rule and not the arithmetic.
  const costly = gradeDecision(scored({ required: 0.5, equity: 0.1, margin: -600 }), 50)
  const marks = highlightsOfHand(
    {
      record: {
        ...record,
        heroDelta: 600,
        reveals: [{ ...HERO, cards: cards('7c', '2d'), handName: 'Full House' }],
      },
      decisions: [costly],
    },
    3,
  )
  const kinds = marks.map((m) => m.kind)
  t.true(kinds.includes('won'))
  t.true(kinds.includes('costly'))
  t.true(kinds.includes('made'))
  // A mistake outranks a pot of the same size: finding it is why anyone opens
  // the review.
  t.is(marks[0].kind, 'costly')
  t.true(marks.every((m) => m.index === 3))
})

test('a quiet hand is not dressed up as a highlight', (t) => {
  const quiet = { record: { ...hand([]), heroDelta: -50 }, decisions: [] }
  t.deepEqual(highlightsOfHand(quiet, 0), [])
  t.false(isNotable(quiet, 0))
})

test('a folded hand cannot claim the hand the river brought', (t) => {
  // handName is only filled in for a player who reached the showdown, so a hand
  // mucked on the flop has none — and must not be marked as a full house
  // because the board later made one.
  const folded = {
    record: {
      ...hand([]),
      heroDelta: -50,
      reveals: [{ ...HERO, cards: cards('7c', '2d') }],
    },
    decisions: [],
  }
  t.deepEqual(highlightsOfHand(folded, 0), [])
})

test('highlights offer each hand once, best first', (t) => {
  const record = hand([])
  const big = { record: { ...record, heroDelta: 2000 }, decisions: [] }
  const small = { record: { ...record, heroDelta: 700 }, decisions: [] }
  const quiet = { record: { ...record, heroDelta: 10 }, decisions: [] }
  const marks = highlightsOf(session([quiet, small, big]))
  t.deepEqual(
    marks.map((m) => m.index),
    [2, 1],
  )
})

// --- which tables are reviewed ----------------------------------------------

test('the review covers the core game and nothing else', (t) => {
  for (const venue of [...VENUES, ...RING_TABLES, THE_DAILY, KITCHEN_TABLE]) {
    t.true(reviewableVenue(venue), `${venue.id} is the core game and should be reviewed`)
  }
  const out = [
    ...SIDE_TABLES,
    ...CHALLENGE_TABLES,
    ...DEEP_STACK_TABLES,
    ...SHORT_DECK_TABLES,
    ...HI_LO_TABLES,
    ...DRAW_TABLES,
    BIG_POT,
    CUSTOM_TABLE_ROUTE,
  ]
  for (const venue of out) {
    t.false(reviewableVenue(venue), `${venue.id} is not the core game and must not be reviewed`)
  }
})

test('a table dealing anything but Hold’em is never reviewed', (t) => {
  // The arithmetic is two-card equity. A four-card game graded by it would be
  // confidently wrong, which is worse than not being graded at all.
  t.false(reviewableVenue({ ...VENUES[0], variant: 'omaha' }))
  t.true(reviewableVenue({ ...VENUES[0], variant: 'holdem' }))
})
