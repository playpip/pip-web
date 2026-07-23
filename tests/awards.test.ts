import test from 'ava'
import { AWARDS, awardById, detectAwards, type AwardContext } from '@/lib/awards'
import { VENUES, KITCHEN_TABLE } from '@/config/venues'
import { cardFromString } from '@/lib/poker/cards'

const baseCtx = (over: Partial<AwardContext> = {}): AwardContext => ({
  venue: VENUES[0], // the Garage
  heroWon: false,
  showdown: false,
  heroHand: undefined,
  heroHole: undefined,
  knockedOut: false,
  eliminatedCount: 0,
  bigBlind: 2,
  lowestStack: 100,
  startingStack: 100,
  tournamentWon: false,
  cameFromFreeroll: false,
  peakRoll: 100,
  ...over,
})

const ids = (ctx: AwardContext, owned: Record<string, number> = {}) =>
  detectAwards(ctx, owned).map((a) => a.id)

const showdownWin = (name: string, description: string, over: Partial<AwardContext> = {}) =>
  baseCtx({ heroWon: true, showdown: true, heroHand: { name, description }, ...over })

test('the set has 59 chips with unique ids', (t) => {
  t.is(AWARDS.length, 59)
  t.is(new Set(AWARDS.map((a) => a.id)).size, 59)
  t.is(AWARDS.filter((a) => a.kind === 'venue').length, 10)
  t.is(AWARDS.filter((a) => a.kind === 'hand').length, 7)
  t.is(AWARDS.filter((a) => a.kind === 'moment').length, 7)
  t.is(AWARDS.filter((a) => a.kind === 'nickname').length, 29)
  t.is(AWARDS.filter((a) => a.kind === 'journey').length, 6)
  t.truthy(awardById('venue-garage'))
  t.truthy(awardById('nickname-QQ'))
})

test('winning a ladder venue earns its chip — once', (t) => {
  const ctx = baseCtx({ tournamentWon: true })
  t.deepEqual(ids(ctx), ['venue-garage'])
  t.deepEqual(ids(ctx, { 'venue-garage': 1 }), [])
})

test('winning the freeroll earns no venue chip', (t) => {
  t.deepEqual(ids(baseCtx({ venue: KITCHEN_TABLE, tournamentWon: true })), [])
})

test('any first pot win earns First Pot', (t) => {
  t.deepEqual(ids(baseCtx({ heroWon: true })), ['journey-first'])
  t.deepEqual(ids(baseCtx({ heroWon: true }), { 'journey-first': 1 }), [])
})

test('hand chips need a showdown win with the hand', (t) => {
  t.deepEqual(ids(showdownWin('Full House', "Full House, A's over K's")), [
    'hand-fullhouse',
    'journey-first',
  ])
  // no showdown → no hand chip; lost the pot → nothing at all
  t.deepEqual(
    ids(
      baseCtx({
        heroWon: true,
        showdown: false,
        heroHand: { name: 'Full House', description: '' },
      }),
    ),
    ['journey-first'],
  )
  t.deepEqual(
    ids(
      baseCtx({
        heroWon: false,
        showdown: true,
        heroHand: { name: 'Full House', description: '' },
      }),
    ),
    [],
  )
})

test('straight, flush, quads, straight flush, royal and wheel are recognised', (t) => {
  t.deepEqual(ids(showdownWin('Straight', 'Straight, 9 High')), ['hand-straight', 'journey-first'])
  t.deepEqual(ids(showdownWin('Flush', 'Flush, Ah High')), ['hand-flush', 'journey-first'])
  t.deepEqual(ids(showdownWin('Four of a Kind', "Four of a Kind, A's")), [
    'hand-quads',
    'journey-first',
  ])
  t.deepEqual(ids(showdownWin('Straight Flush', 'Straight Flush, Qh High')), [
    'hand-straightflush',
    'journey-first',
  ])
  // a royal is also a straight flush — both chips land together
  t.deepEqual(ids(showdownWin('Straight Flush', 'Royal Flush')), [
    'hand-straightflush',
    'hand-royal',
    'journey-first',
  ])
  // the wheel is also a straight
  t.deepEqual(ids(showdownWin('Straight', 'Straight, 5 High')), [
    'hand-straight',
    'hand-wheel',
    'journey-first',
  ])
})

test('The Seven Deuce needs a won pot holding exactly 7-2', (t) => {
  const holding = (a: string, b: string) =>
    baseCtx({ heroWon: true, heroHole: [cardFromString(a), cardFromString(b)] })
  t.deepEqual(ids(holding('7c', '2d')), ['moment-sevendeuce', 'journey-first'])
  t.deepEqual(ids(holding('2s', '7h')), ['moment-sevendeuce', 'journey-first'])
  // pocket sevens aren't 7-2 — but they are Hockey Sticks, a named hand
  t.deepEqual(ids(holding('7c', '7d')), ['nickname-77', 'journey-first'])
  t.deepEqual(ids(holding('Ac', '2d')), ['journey-first'])
  // losing with 7-2 earns nothing
  t.deepEqual(ids(baseCtx({ heroHole: [cardFromString('7c'), cardFromString('2d')] })), [])
})

test('nickname chips fire on a won pot with a folk-named starting hand', (t) => {
  const holding = (a: string, b: string) =>
    baseCtx({ heroWon: true, heroHole: [cardFromString(a), cardFromString(b)] })
  // pairs and offsuit/suited-agnostic names
  t.deepEqual(ids(holding('Qc', 'Qd')), ['nickname-QQ', 'journey-first']) // Ladies
  t.deepEqual(ids(holding('5c', 'Jh')), ['nickname-J5', 'journey-first']) // Motown, any order
  // The Heinz (5-7) and Jack Benny (3-9) resolve to their high-first keys
  t.deepEqual(ids(holding('7c', '5d')), ['nickname-75', 'journey-first'])
  t.deepEqual(ids(holding('9c', '3d')), ['nickname-93', 'journey-first'])
  // an unnamed hand earns no nickname chip
  t.deepEqual(ids(holding('9c', '4d')), ['journey-first'])
  // losing with a named hand earns nothing
  t.deepEqual(ids(baseCtx({ heroHole: [cardFromString('Qc'), cardFromString('Qd')] })), [])
  // the three iconic hands keep their bespoke moment chip — no nickname duplicate
  t.deepEqual(ids(holding('Ac', 'Ad')), ['moment-bullets', 'journey-first'])
  t.deepEqual(ids(holding('7c', '2d')), ['moment-sevendeuce', 'journey-first'])
  t.is(awardById('nickname-AA'), undefined)
  t.is(awardById('nickname-AK'), undefined)
})

test('The Bouncer fires on a clean knockout', (t) => {
  t.deepEqual(ids(baseCtx({ heroWon: true, knockedOut: true })), [
    'moment-knockout',
    'journey-first',
  ])
})

test('The Comeback needs a ladder win from a tenth of the starting stack', (t) => {
  t.deepEqual(ids(baseCtx({ tournamentWon: true, lowestStack: 10 })), [
    'moment-comeback',
    'venue-garage',
  ])
  t.deepEqual(ids(baseCtx({ tournamentWon: true, lowestStack: 11 })), ['venue-garage'])
  // a freeroll comeback doesn't count
  t.deepEqual(ids(baseCtx({ venue: KITCHEN_TABLE, tournamentWon: true, lowestStack: 5 })), [])
})

test('Chip and a Chair needs a ladder win from a single big blind', (t) => {
  // Down to one big blind (of a 100 stack) — both the comeback and the rarer
  // chip-and-a-chair land together.
  t.deepEqual(ids(baseCtx({ tournamentWon: true, bigBlind: 50, lowestStack: 8 })), [
    'moment-comeback',
    'moment-chipandchair',
    'venue-garage',
  ])
  // At one big blind but never below a tenth of the stack: chip-and-a-chair only.
  t.deepEqual(ids(baseCtx({ tournamentWon: true, bigBlind: 50, lowestStack: 50 })), [
    'moment-chipandchair',
    'venue-garage',
  ])
  // Over a big blind at the low point: neither moment, just the venue chip.
  t.deepEqual(ids(baseCtx({ tournamentWon: true, bigBlind: 50, lowestStack: 51 })), [
    'venue-garage',
  ])
  // The freeroll never grants moment chips.
  t.deepEqual(
    ids(baseCtx({ venue: KITCHEN_TABLE, tournamentWon: true, bigBlind: 50, lowestStack: 8 })),
    [],
  )
})

test('The Bullets fires on a won pot holding pocket aces', (t) => {
  const holding = (a: string, b: string) =>
    baseCtx({ heroWon: true, heroHole: [cardFromString(a), cardFromString(b)] })
  t.deepEqual(ids(holding('Ac', 'Ad')), ['moment-bullets', 'journey-first'])
  t.deepEqual(ids(holding('Ac', 'Kd')), ['journey-first'])
  // losing with aces earns nothing
  t.deepEqual(ids(baseCtx({ heroHole: [cardFromString('Ac'), cardFromString('Ad')] })), [])
})

test('Big Slick needs a showdown win holding Ace-King', (t) => {
  const showdownHole = (a: string, b: string) =>
    baseCtx({ heroWon: true, showdown: true, heroHole: [cardFromString(a), cardFromString(b)] })
  t.deepEqual(ids(showdownHole('Ah', 'Ks')), ['moment-bigslick', 'journey-first'])
  t.deepEqual(ids(showdownHole('Ks', 'Ah')), ['moment-bigslick', 'journey-first'])
  // no showdown → no chip (Big Slick's drama is at the reveal)
  t.deepEqual(
    ids(baseCtx({ heroWon: true, heroHole: [cardFromString('Ah'), cardFromString('Ks')] })),
    ['journey-first'],
  )
})

test('Two Birds needs a double knockout', (t) => {
  t.deepEqual(ids(baseCtx({ heroWon: true, knockedOut: true, eliminatedCount: 2 })), [
    'moment-knockout',
    'moment-doubleko',
    'journey-first',
  ])
  // a single knockout is only the Bouncer
  t.deepEqual(ids(baseCtx({ heroWon: true, knockedOut: true, eliminatedCount: 1 })), [
    'moment-knockout',
    'journey-first',
  ])
})

test('Back From Broke needs the freeroll flag AND a ladder tournament win', (t) => {
  const win = baseCtx({ tournamentWon: true, cameFromFreeroll: true })
  t.deepEqual(ids(win), ['venue-garage', 'journey-kitchen'])
  // flag without a win, or a freeroll win with the flag: no chip
  t.deepEqual(ids(baseCtx({ cameFromFreeroll: true })), [])
  t.deepEqual(
    ids(baseCtx({ venue: KITCHEN_TABLE, tournamentWon: true, cameFromFreeroll: true })),
    [],
  )
})

test('rank chips fire on peak Roll thresholds', (t) => {
  t.deepEqual(ids(baseCtx({ peakRoll: 999 })), [])
  t.deepEqual(ids(baseCtx({ peakRoll: 1_000 })), ['journey-regular'])
  t.deepEqual(ids(baseCtx({ peakRoll: 10_000 })), ['journey-regular', 'journey-shark'])
  t.deepEqual(ids(baseCtx({ peakRoll: 1_000_000 })), [
    'journey-regular',
    'journey-shark',
    'journey-pro',
    'journey-legend',
  ])
  t.deepEqual(ids(baseCtx({ peakRoll: 1_000_000 }), { 'journey-regular': 1, 'journey-shark': 1 }), [
    'journey-pro',
    'journey-legend',
  ])
})
