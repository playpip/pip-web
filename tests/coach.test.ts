import { readFileSync } from 'node:fs'
import test from 'ava'
import { heroDecision, readHand, type HeroDecision } from '@/lib/coach'
import { cardFromString } from '@/lib/poker/cards'
import { applyAction, legalActions, startHand, type SeatConfig } from '@/lib/poker/engine'
import type { HandEvent, HandRecord } from '@/store/game'

const cards = (...s: string[]) => s.map(cardFromString)

const HERO = { playerId: 'hero', playerName: 'Will' }

function decision(over: Partial<HeroDecision> = {}): HeroDecision {
  return { pot: 600, toCall: 200, opponents: 1, selectivity: [0.5], board: [], ...over }
}

/** A hand whose only interesting moment is one priced hero decision. */
function hand(
  type: 'call' | 'fold' | 'check',
  d: HeroDecision | undefined,
  over: Partial<HandRecord> = {},
): HandRecord {
  const events: HandEvent[] = [
    { kind: 'action', playerId: 'ai0', playerName: 'Vivienne', type: 'bet', amount: d?.toCall },
    { kind: 'action', ...HERO, type, amount: type === 'call' ? d?.toCall : undefined, decision: d },
  ]
  return {
    handNo: 4,
    smallBlind: 25,
    bigBlind: 50,
    events,
    community: d?.board ?? [],
    reveals: [{ ...HERO, cards: cards('7c', '2d') }],
    summary: 'Vivienne wins 800',
    ...over,
  }
}

// --- the read itself --------------------------------------------------------

test('a call with far too little equity reads as the cheaper fold', (t) => {
  // 200 into 600 lays 25%. 72o on AhKh9s against one live opponent is nowhere
  // near that, and the turn leaves one card to come.
  const read = readHand(
    hand('call', decision({ board: cards('Ah', 'Kh', '9s'), toCall: 200, pot: 600 })),
  )
  t.truthy(read)
  t.false(read!.good)
  t.regex(read!.text, /^The flop call\./)
  t.regex(read!.text, /You needed 25% and had about \d+%/)
  t.regex(read!.text, /Folding was the cheaper option\./)
})

test('folding the best of it says so without scolding', (t) => {
  // The nuts on the river, facing a tiny price. Folding is the whole mistake.
  const read = readHand(
    hand('fold', decision({ board: cards('7h', '2s', '7d', '2c', '9h'), pot: 1000, toCall: 100 }), {
      reveals: [{ ...HERO, cards: cards('7c', '2d') }],
      community: cards('7h', '2s', '7d', '2c', '9h'),
    }),
  )
  t.truthy(read)
  t.false(read!.good)
  t.regex(read!.text, /^The river fold\./)
  t.regex(read!.text, /worth a call/)
  t.notRegex(read!.text, /mistake|wrong of you|should have/i)
})

test('a good laydown is worth as much airtime as a bad call', (t) => {
  const read = readHand(
    hand('fold', decision({ board: cards('Ah', 'Kh', 'Qs', 'Jd'), pot: 300, toCall: 900 })),
  )
  t.truthy(read)
  t.true(read!.good)
  t.regex(read!.text, /^The turn fold\./)
  t.regex(read!.text, /Good laydown\./)
})

test('calling with the best of it names the price it paid', (t) => {
  const read = readHand(
    hand('call', decision({ board: cards('7h', '2s', '7d', '2c', '9h'), pot: 1000, toCall: 100 }), {
      community: cards('7h', '2s', '7d', '2c', '9h'),
    }),
  )
  t.truthy(read)
  t.true(read!.good)
  t.regex(read!.text, /Good call\./)
  t.regex(read!.text, /you put in 100 to win 1,000/)
})

// --- when it says nothing, which is most hands ------------------------------

test('a free check is not a priced decision, so there is no read', (t) => {
  t.is(readHand(hand('check', decision({ toCall: 0 }))), null)
})

test('a close spot is inside the noise and gets no read', (t) => {
  // 900 into 900 lays 50%. A coin flip against a 50% price has no lesson in it,
  // and 1500 simulations cannot tell which side of the line it landed.
  const read = readHand(
    hand('call', decision({ board: cards('Ah', 'Kd', '9s', '4c', '2h'), pot: 900, toCall: 900 }), {
      reveals: [{ ...HERO, cards: cards('Ac', 'Kc') }],
      community: cards('Ah', 'Kd', '9s', '4c', '2h'),
    }),
  )
  if (read) t.regex(read.text, /Good call\./, 'if it speaks at all it must not call this a mistake')
  t.pass()
})

test('a right decision worth less than a big blind stays quiet', (t) => {
  // The edge is real but the pot is two chips. Nothing to say.
  const read = readHand(
    hand('fold', decision({ board: cards('Ah', 'Kh', 'Qs', 'Jd'), pot: 1, toCall: 3 }), {
      bigBlind: 50,
    }),
  )
  t.is(read, null)
})

test('a hand with no decision snapshots gets no read', (t) => {
  // This is the shape a hand decoded from a /hand permalink arrives in: the
  // wire format carries actions and amounts, never the snapshots.
  t.is(readHand(hand('call', undefined)), null)
})

test('a record with no hero hole cards gets no read', (t) => {
  t.is(readHand(hand('call', decision(), { reveals: [] })), null)
})

// --- the guardrails ---------------------------------------------------------

test('showdown reveals cannot change the read', (t) => {
  // The single easiest bug to write in this module is to reach for
  // HandRecord.reveals and price the decision against what the opponent
  // actually held. That produces advice which is correct and useless, because
  // it teaches results rather than decisions. The same hand, once with the
  // opponent showing the nuts and once with them showing nothing, must read
  // identically.
  const board = cards('Ah', 'Kh', '9s')
  const base = hand('call', decision({ board, pot: 600, toCall: 200 }), { community: board })
  const blind = readHand(base)
  const withShowdown = readHand({
    ...base,
    reveals: [
      ...base.reveals,
      { playerId: 'ai0', playerName: 'Vivienne', cards: cards('Ac', 'Ad'), handName: 'Trips' },
    ],
  })
  t.deepEqual(withShowdown, blind)
})

test('the same hand always reads the same', (t) => {
  const h = hand('call', decision({ board: cards('Ah', 'Kh', '9s') }))
  t.deepEqual(readHand(h), readHand(h))
})

test('the price quoted is the price the pot laid', (t) => {
  // 150 to call into 450 is exactly 25%, and the sentence must say 25%.
  const read = readHand(
    hand('call', decision({ board: cards('Ah', 'Kh', '9s'), pot: 450, toCall: 150 })),
  )
  t.truthy(read)
  t.regex(read!.text, /You needed 25%/)
})

// --- a short stack's call -------------------------------------------------

/**
 * Heads-up, both in for 250 preflop, then a 1000 bet on the flop. The hero has
 * `heroStack - 250` behind. With `third`, a deep seat has called preflop and
 * flatted the 1000 before the hero acts.
 */
function flopFacing1000(heroStack: number, third = false) {
  const seats: SeatConfig[] = [
    { id: 'hero', name: 'Will', stack: heroStack },
    { id: 'ai0', name: 'Vivienne', stack: 5000 },
    ...(third ? [{ id: 'ai1', name: 'Otto', stack: 5000 }] : []),
  ]
  let s = startHand({ seats, buttonIndex: 0, smallBlind: 25, bigBlind: 50, rng: () => 0.5 })
  const act = (type: 'call' | 'bet' | 'raise', amount?: number) => {
    s = applyAction(s, { type, amount })
  }
  // Preflop: whoever opens raises to 250, everybody calls it.
  act('raise', 250)
  while (s.street === 'preflop') act('call')
  while (s.players[s.toActIndex].id !== 'hero') {
    if (s.currentBet === 0) act('bet', 1000)
    else act('call')
  }
  return { state: s, toCall: legalActions(s)!.callAmount }
}

test('a short stack calling an over-bet plays for what it can match', (t) => {
  // 300 behind, 1000 bet into 500. The 700 the hero cannot match is not theirs
  // to win: the call risks 300 to win 800, which needs 27%, not 300 / 1800.
  const { state, toCall } = flopFacing1000(550)
  t.is(toCall, 300)
  const d = heroDecision(state, 'hero', toCall)!
  t.is(d.pot, 800)

  const read = readHand(hand('call', { ...d, board: cards('Ah', 'Kh', 'Qs') }))
  t.truthy(read)
  t.regex(read!.text, /You needed 27%/)
})

test('a covered call still plays for the whole pot', (t) => {
  const { state, toCall } = flopFacing1000(5000)
  t.is(toCall, 1000)
  t.is(heroDecision(state, 'hero', toCall)!.pot, 1500)
})

test("a short stack leaves every bigger stack's excess out of the pot", (t) => {
  // Three in for 250, then 1000 and a flat call. The hero's 300 can win 300
  // from each of them: 750 + 300 + 300.
  const { state, toCall } = flopFacing1000(550, true)
  t.is(toCall, 300)
  t.is(heroDecision(state, 'hero', toCall)!.pot, 1350)
})

test('the largest swing is the one that gets talked about', (t) => {
  // Two priced decisions in one hand: a trivial preflop call and a big river
  // fold with the nuts. The river is the moment worth naming.
  const board = cards('7h', '2s', '7d', '2c', '9h')
  const record: HandRecord = {
    handNo: 9,
    smallBlind: 25,
    bigBlind: 50,
    events: [
      {
        kind: 'action',
        ...HERO,
        type: 'call',
        amount: 50,
        decision: decision({ pot: 75, toCall: 50, board: [] }),
      },
      { kind: 'board', label: 'Runout', cards: board },
      {
        kind: 'action',
        ...HERO,
        type: 'fold',
        decision: decision({ pot: 2000, toCall: 200, board }),
      },
    ],
    community: board,
    reveals: [{ ...HERO, cards: cards('7c', '2d') }],
    summary: 'Vivienne wins 2,200',
  }
  const read = readHand(record)
  t.truthy(read)
  t.regex(read!.text, /^The river fold\./)
})

// ---------------------------------------------------------------------------
// The label, pinned. Not arithmetic, but a settled claim, and technology#44's
// convention is that a settled claim ships with a check.

test('the setting is labelled "Second opinion" and says it is usually quiet', (t) => {
  // technology#46 (CMO). "Coaching" was the wrong register: a coach is someone
  // whose job is to correct you, and this is a peer looking over your shoulder.
  // It also has to survive being silent most hands, which a coach label cannot.
  //
  // The hint's second sentence is the load-bearing half. "Most hands do not get
  // one" puts the design decision on the surface where a player meets it, so
  // silence reads as normal instead of as a bug. Losing it turns the quietest
  // feature in the app into a suspected broken one.
  const source = readFileSync(
    new URL('../src/components/settings/SettingsDialog.tsx', import.meta.url),
    'utf-8',
  )
  const body = source.split('function HandCoachingSection')[1] ?? ''
  // Only what the player reads. The store field is still called handCoaching,
  // deliberately, so the whole function body would fail this on its own name.
  const row = body.split('<ToggleRow')[1]?.split('checked=')[0] ?? ''
  t.true(row.includes('label='), 'the section stopped rendering a labelled toggle')
  t.true(row.includes('label="Second opinion"'), 'the label moved')
  t.true(row.includes('Most hands do not get one.'), 'the hint lost its second sentence')
  t.false(/coach/i.test(row), 'the word the CMO ruled out is back in the label or hint')
})
