// Which AI sits at a table (`lib/poker/ai/tableAi.ts`). Below
// `RANGED_AI_FROM_SKILL`, and at the Daily at any tier, a table plays the AI it
// always has, decision for decision: the fingerprint is the one pinned in
// tests/aiExperiment.test.ts. From the line up it plays `RANGED_AI`, the
// version the measurement scripts call `wpf3`.
//
// Nothing here names the line's value, so moving it is one edit in
// config/aiGates.ts and these still say what they mean.

import test from 'ava'
import { RANGED_AI_FROM_SKILL } from '@/config/aiGates'
import { ALL_VENUES, dailyFor, type Venue, venueById } from '@/config/venues'
import { RANKS } from '@/config/ranks'
import type { AiProfile } from '@/lib/poker/ai/policy'
import { RANGED_AI, tableAi } from '@/lib/poker/ai/tableAi'
import { versionProfile } from '@/lib/poker/ai/versions'
import { fingerprint } from './helpers'

/** The pin in tests/aiExperiment.test.ts: the AI before any switch existed. */
const SHIPPED = 'b6e55ee'
/**
 * `RANGED_AI` at the three fingerprint rungs, computed at the commit that turned
 * it on. `shoveReads` and the flop-seen fix left it as it was: its 36 hands of
 * bots never face an all in before the flop or run a board out to one, and
 * tests/rangeTuning.test.ts pins those spots instead.
 */
const RANGED = 'b010bc78'

const skillOf = (v: Venue) => v.ai.skill ?? 1
const dailies = RANKS.map((r) => dailyFor(r.min))
const ranged = (v: Venue) => !v.daily && skillOf(v) >= RANGED_AI_FROM_SKILL
const withRanged = (p: AiProfile): AiProfile => ({ ...p, experiment: RANGED_AI })

test('below the line, and at every tier of the Daily, a table plays the profile it is given', (t) => {
  const plain = [...ALL_VENUES, ...dailies].filter((v) => !ranged(v))
  t.true(plain.some((v) => !v.daily))
  t.true(dailies.every((v) => v.daily && plain.includes(v)))
  // A Daily tier at or above the line is still the Daily.
  t.true(dailies.some((v) => skillOf(v) >= RANGED_AI_FROM_SKILL))
  for (const v of plain) t.is(tableAi(v.ai, v), v.ai, v.id)
})

test('from the line up, a table plays RANGED_AI, and keeps every number of its own', (t) => {
  const over = ALL_VENUES.filter(ranged)
  t.true(over.length > 0)
  for (const v of over) t.deepEqual(tableAi(v.ai, v), { ...v.ai, experiment: RANGED_AI }, v.id)
  // The table decides, not the seat: a guest's own profile gets the switches too.
  const guest: AiProfile = { ...over[0].ai, skill: 0.1 }
  t.deepEqual(tableAi(guest, over[0]).experiment, RANGED_AI)
})

test('the hardest table below the line, and the hardest Daily, make the shipped decisions', (t) => {
  const under = ALL_VENUES.filter((v) => !ranged(v) && !v.daily).sort(
    (a, b) => skillOf(b) - skillOf(a),
  )[0]
  t.is(
    fingerprint((p) => tableAi(p, under)),
    SHIPPED,
  )
  t.is(
    fingerprint((p) => tableAi(p, dailies[dailies.length - 1])),
    SHIPPED,
  )
})

test('the softest table from the line up plays wpf3, the version that was measured', (t) => {
  const over = ALL_VENUES.filter(ranged).sort((a, b) => skillOf(a) - skillOf(b))[0]
  t.is(
    fingerprint((p) => tableAi(p, over)),
    RANGED,
  )
  t.is(
    fingerprint((p) => versionProfile('wpf3', p)),
    RANGED,
  )
})

test('each fingerprint rung plays the version its own skill names', (t) => {
  for (const id of ['garage', 'cardroom', 'mainevent']) {
    const own = fingerprint((p, v) => tableAi(p, v), [id])
    const expected = ranged(venueById(id) as Venue) ? withRanged : (p: AiProfile) => p
    t.is(own, fingerprint(expected, [id]), id)
  }
})

test('a ranged table at any game but Hold’em plays exactly as before', (t) => {
  for (const variant of ['omaha', 'shortdeck', 'omahahilo'] as const) {
    t.is(
      fingerprint(withRanged, ['mainevent'], variant),
      fingerprint(undefined, ['mainevent'], variant),
      variant,
    )
  }
})
