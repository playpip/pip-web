// The persisted-profile migration chain. A stored profile can be years old and
// can also arrive from another device's synced row (store/sync runs the same
// chain over it), so a missed branch is not a cosmetic bug — it is a field
// arriving as `undefined` in code that assumes it exists.
//
// `migrateProfile` is exported and pure over the object it's handed, which is
// what makes this testable without a store or a DOM.

import test from 'ava'
import { migrateProfile, PERSIST_VERSION } from '@/store/profile'
import { currentChallenge } from '@/lib/challenge'
import { DEFAULT_CARD_BACK } from '@/config/cardBacks'

/** A v11 profile: everything before challengers, nothing after. */
const v11 = () => ({
  created: true,
  name: 'Player',
  avatar: null,
  roll: 4_200,
  peakRoll: 9_000,
  stats: {
    handsPlayed: 300,
    handsWon: 90,
    biggestPot: 2_400,
    showdownsWon: 40,
    tournamentsEntered: 12,
    tournamentsWon: 3,
  },
  rollHistory: [{ t: 10, roll: 4_200 }],
  venueRecords: { garage: { entered: 4, won: 2, bestFinish: 1, fastestWinHands: 18 } },
  tendencies: {
    handsDealt: 300,
    vpipHands: 80,
    raises: 40,
    calls: 60,
    betsFaced: 120,
    foldsToBet: 50,
    showdowns: 45,
  },
  cardBack: DEFAULT_CARD_BACK.id,
  awards: { 'journey-first': 11 },
  cameFromFreeroll: false,
  castRecords: {},
  tableTalk: true,
  daily: null,
  owned: ['ocean'],
  deckFace: 'classic',
  tableFinish: null,
})

test('v11 → v12 adds the challenge fields without touching progress', (t) => {
  const before = v11()
  const after = migrateProfile(v11(), 11)

  t.deepEqual(after.challengeWins, [])
  t.is(after.challengesPlayed, 0)

  // Nothing else moved.
  t.is(after.roll, before.roll)
  t.is(after.peakRoll, before.peakRoll)
  t.deepEqual(after.stats, before.stats)
  t.deepEqual(after.awards, before.awards)
  t.deepEqual(after.venueRecords, before.venueRecords)
  t.deepEqual(after.owned, before.owned)
})

test('a migrated profile can be handed straight to the challenge rules', (t) => {
  // The failure this guards: `challengeWins` arriving `undefined` and every
  // `.includes` on it throwing the first time the home screen renders.
  const p = migrateProfile(v11(), 11)
  const challenge = currentChallenge({
    roll: p.roll,
    venueRecords: p.venueRecords,
    challengeWins: p.challengeWins,
    challengesPlayed: p.challengesPlayed,
  })
  t.truthy(challenge)
  t.is(challenge?.rematch, false)
})

test('v12 → v13 turns per-hand coaching on for an existing player', (t) => {
  // On rather than off: the read is quiet by design (most hands have none), and
  // a player who does not want it will find the toggle long before they would
  // find a setting that shipped silently off.
  const v12 = { ...v11(), challengeWins: ['doris'], challengesPlayed: 2 }
  const after = migrateProfile(v12, 12)
  t.true(after.handCoaching)
  t.deepEqual(after.challengeWins, ['doris'], 'nothing else moved')
})

test('v13 → v14 leaves haptics off for an existing player', (t) => {
  // Off, and not "off unless they seem like the type". A vibration nobody
  // asked for is the one thing in this build that can startle someone.
  const v13 = { ...v11(), challengeWins: [], challengesPlayed: 0, handCoaching: true }
  const after = migrateProfile(v13, 13)
  t.false(after.haptics)
  t.true(after.handCoaching, 'the post-hand read was not disturbed')
})

test('v14 → v15 gives an existing player an empty drill record', (t) => {
  // Empty, not seeded. There is nothing to honour — the shipped drills kept
  // nothing — and deriving an opening rating from hands played would be a
  // claim about how somebody reads a showdown made out of how they bet.
  const v14 = {
    ...v11(),
    challengeWins: [],
    challengesPlayed: 0,
    handCoaching: true,
    haptics: true,
  }
  const after = migrateProfile(v14, 14)
  t.deepEqual(after.drills, {})
  t.true(after.haptics, 'nothing else moved')
})

test('v15 → v16 gives an existing drill record an empty shape breakdown', (t) => {
  // Empty, and it cannot be anything else. The totals do not record which
  // shapes they were, so a player with two hundred answers behind them starts
  // this breakdown at zero. Splitting the totals by the generator's measured
  // shape frequencies would put four rows on the screen that describe the
  // generator rather than the player, which is the invented-authority failure
  // the whole drills build has avoided so far.
  const v15 = {
    ...v11(),
    challengeWins: [],
    challengesPlayed: 0,
    handCoaching: true,
    haptics: false,
    drills: {
      'which-hand-wins': { answered: 212, correct: 150, rating: 1_240, bestRun: 11 },
      'count-your-outs': { answered: 8, correct: 5, rating: 1_010, bestRun: 2 },
    },
  }
  const after = migrateProfile(v15, 15)

  t.deepEqual(after.drills['which-hand-wins'].shapes, {})
  t.deepEqual(after.drills['count-your-outs'].shapes, {}, 'every record, not just the first')
  // The failure this branch exists to stop: a record loading with `shapes`
  // undefined and the first answer after the upgrade throwing on it.
  t.is(after.drills['which-hand-wins'].rating, 1_240, 'the rating was not disturbed')
  t.is(after.drills['which-hand-wins'].answered, 212)
})

test('v15 → v16 is a no-op for a player who has never opened a drill', (t) => {
  const v15 = {
    ...v11(),
    challengeWins: [],
    challengesPlayed: 0,
    handCoaching: true,
    haptics: false,
    drills: {},
  }
  t.deepEqual(migrateProfile(v15, 15).drills, {})
})

test('an ancient profile survives the whole chain', (t) => {
  // A v1 save is a name, a Roll and nothing else. Every branch has to fire.
  const ancient = { created: true, name: 'Player', avatar: null, roll: 800 }
  const p = migrateProfile(ancient, 1)

  t.is(p.cardBack, DEFAULT_CARD_BACK.id)
  t.is(p.peakRoll, 800)
  t.deepEqual(p.awards, {})
  t.deepEqual(p.castRecords, {})
  t.deepEqual(p.challengeWins, [])
  t.is(p.challengesPlayed, 0)
  t.true(p.handCoaching)
  t.false(p.haptics)
  t.deepEqual(p.drills, {})
  // v10 → v11 grandfathers the three card backs that moved into the Chip Shop.
  t.deepEqual([...p.owned].sort(), ['midnight', 'ocean', 'slate'])
})

test('migrating an already-current profile is a no-op', (t) => {
  const current = {
    ...v11(),
    challengeWins: ['doris'],
    challengesPlayed: 2,
    drills: {
      'which-hand-wins': {
        answered: 40,
        correct: 31,
        rating: 1_120,
        bestRun: 9,
        shapes: { category: { answered: 21, correct: 19 }, kicker: { answered: 12, correct: 5 } },
      },
    },
  }
  const p = migrateProfile(structuredClone(current), PERSIST_VERSION)
  t.deepEqual(p.challengeWins, ['doris'])
  t.is(p.challengesPlayed, 2)
  // The one that would be silent: a chain that reset `drills` on a current
  // profile would wipe a rating on every load and nothing would report it.
  t.is(p.drills['which-hand-wins'].rating, 1_120)
  t.is(p.drills['which-hand-wins'].bestRun, 9)
  // The same failure one level down, and it is the one the v16 branch could
  // plausibly cause: emptying `shapes` on a profile that is already current.
  t.is(p.drills['which-hand-wins'].shapes.kicker.answered, 12)
})
