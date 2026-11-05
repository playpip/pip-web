import { readdirSync, readFileSync } from 'node:fs'
import test from 'ava'
import {
  applyDecision,
  applySubmission,
  cleanAvatar,
  cleanName,
  decideSubmission,
  emptyCore,
  EXPERIENCE_CAPS,
  experienceCap,
  FLAG_AFTER,
  isCapped,
  freshState,
  isProvisional,
  kindCosts,
  LOSS_CAP_BB,
  lossForRating,
  MAX_CHANGE_PER_SUBMIT,
  MAX_DECISIONS_PER_HOUR,
  MIN_HAND_GAP_MS,
  MIN_SUBMIT_GAP_MS,
  parseCore,
  PROVISIONAL_DECISIONS,
  RATING_CEILING,
  RATING_FLOOR,
  ratedLoss,
  ratingFromLoss,
  ratingKindOf,
  ratingOf,
  rawRatingOf,
  type RatingCore,
  type Rejection,
  type SubmittedHand,
  validateHands,
  weekStartOf,
} from '@/lib/rating'

// The Pip Rating (docs/rating.md): decision quality on a chess-like scale,
// from the chip cost Pip already prices on every hand.

const NOW = Date.parse('2026-11-04T12:00:00Z')

/** `n` hands, a second apart past the gap, each with one decision. */
function hands(n: number, loss: number, stake = 10, from = NOW - n * 5_000): SubmittedHand[] {
  return Array.from({ length: n }, (_, i) => ({
    at: from + i * 5_000,
    decisions: [{ kind: 'flop-call' as const, loss, stake }],
  }))
}

function play(core: RatingCore, n: number, loss: number, stake = 10): RatingCore {
  let c = core
  for (let i = 0; i < n; i++) c = applyDecision(c, 'river-call', loss, stake)
  return c
}

// --- the scale ---------------------------------------------------------------

test('a new player starts at 1000, provisional', (t) => {
  t.is(ratingOf(emptyCore()), 1000)
  t.true(isProvisional(0))
  t.true(isProvisional(PROVISIONAL_DECISIONS - 1))
  t.false(isProvisional(PROVISIONAL_DECISIONS))
})

test('the scale runs one way, from the ceiling down to the floor', (t) => {
  t.is(ratingFromLoss(0), RATING_CEILING)
  t.is(ratingFromLoss(10), RATING_FLOOR)
  t.is(ratingFromLoss(Number.NaN), RATING_CEILING)
  let previous = Number.POSITIVE_INFINITY
  for (const loss of [0.006, 0.01, 0.02, 0.045, 0.09, 0.12]) {
    const r = ratingFromLoss(loss)
    t.true(r < previous, `${loss} should rate below the smaller loss before it`)
    previous = r
  }
})

test('halving what you give away is worth 350 points, and the anchors hold', (t) => {
  t.is(ratingFromLoss(0.025), 1000)
  t.is(ratingFromLoss(0.0125), 1350)
  t.is(ratingFromLoss(0.05), 650)
  // The calibration's strongest proxy gives away about 0.45% of the stake:
  // just under 2000, so Expert is past the best Pip plays.
  t.true(Math.abs(ratingFromLoss(0.0045) - 1866) <= 1)
  for (const r of [500, 1000, 1500, 2000, 2500]) t.is(ratingFromLoss(lossForRating(r)), r)
})

// --- decisions, not results ---------------------------------------------------

test('a right decision costs nothing, however the cards fell', (t) => {
  // `bb` is the price's verdict before the cards came; the result is not an input.
  t.is(ratedLoss({ grade: 'sound', bb: 3.2 }), 0)
  t.is(ratedLoss({ grade: 'sharp', bb: 0.4 }), 0)
})

test('a spot inside the noise floor costs nothing either way', (t) => {
  t.is(ratedLoss({ grade: 'close', bb: -0.9 }), 0)
})

test('a wrong decision costs what it gave up, to the cap', (t) => {
  t.is(ratedLoss({ grade: 'slip', bb: -1.5 }), 1.5)
  t.is(ratedLoss({ grade: 'costly', bb: -80 }), LOSS_CAP_BB)
})

test('each decision is named by street and by call or fold', (t) => {
  t.is(ratingKindOf({ street: 'preflop', folded: true }), 'preflop-fold')
  t.is(ratingKindOf({ street: 'river', folded: false }), 'river-call')
})

test('good decisions raise it, costly ones lower it', (t) => {
  t.true(ratingOf(play(emptyCore(), 100, 0)) > 1500)
  t.true(ratingOf(play(emptyCore(), 100, 2)) < 700)
})

test('recent play counts for more than old play', (t) => {
  const reformed = play(play(emptyCore(), 600, 1.5), 600, 0.05)
  const slipped = play(play(emptyCore(), 600, 0.05), 600, 1.5)
  t.true(ratingOf(reformed) > ratingOf(slipped) + 500)
})

test('the kinds that cost points are named, largest first', (t) => {
  let c = emptyCore()
  for (let i = 0; i < 200; i++) {
    c = applyDecision(c, 'river-call', 2, 20)
    c = applyDecision(c, 'preflop-fold', 0.2, 4)
    c = applyDecision(c, 'flop-fold', 0, 8)
  }
  const costs = kindCosts(c)
  t.is(costs[0].kind, 'river-call')
  t.is(costs[1].kind, 'preflop-fold')
  t.false(costs.some((k) => k.kind === 'flop-fold'))
})

test('the top bands open only after enough decisions', (t) => {
  t.is(experienceCap(0), 1599)
  t.is(experienceCap(299), 1599)
  t.is(experienceCap(300), 1999)
  t.is(experienceCap(999), 1999)
  t.is(experienceCap(1_000), 2399)
  t.is(experienceCap(2_500), RATING_CEILING)
  // Flawless play is held under each band until its count, then let through.
  const short = play(emptyCore(), 100, 0)
  t.is(ratingOf(short), 1599)
  t.true(isCapped(short))
  t.true(rawRatingOf(short) > 1599)
  const long = play(emptyCore(), EXPERIENCE_CAPS[EXPERIENCE_CAPS.length - 1].before, 0.05)
  t.false(isCapped(long))
  t.is(ratingOf(long), rawRatingOf(long))
})

test('a cap lifting is not a jump the server clamps', (t) => {
  // 299 strong decisions: shown at 1599, earned well above it.
  const strong = play(emptyCore(), 299, 0.05)
  t.is(ratingOf(strong), 1599)
  const { rating, clamped } = applySubmission(strong, hands(1, 0.05))
  t.false(clamped)
  t.is(rating, Math.min(1999, rawRatingOf(play(strong, 1, 0.05))))
})

// --- what the server accepts ----------------------------------------------------

test('a plausible submission passes', (t) => {
  const r = validateHands(hands(10, 0.5), 0, NOW)
  t.true(r.ok)
})

test('every malformed value is refused, and refuses the whole submission', (t) => {
  const bad: [unknown, Rejection][] = [
    [{}, 'not-a-list'],
    [[], 'empty'],
    [hands(201, 0), 'too-many-hands'],
    [[{ at: NOW, decisions: [] }], 'too-many-decisions'],
    [
      [{ at: NOW, decisions: Array(9).fill({ kind: 'flop-call', loss: 0, stake: 5 }) }],
      'too-many-decisions',
    ],
    [[{ at: NOW, decisions: [{ kind: 'flop-bet', loss: 0, stake: 5 }] }], 'bad-kind'],
    [[{ at: NOW, decisions: [{ kind: 'flop-call', loss: -1, stake: 5 }] }], 'bad-loss'],
    [[{ at: NOW, decisions: [{ kind: 'flop-call', loss: 21, stake: 50 }] }], 'bad-loss'],
    [[{ at: NOW, decisions: [{ kind: 'flop-call', loss: 6, stake: 5 }] }], 'bad-loss'],
    [[{ at: NOW, decisions: [{ kind: 'flop-call', loss: Number.NaN, stake: 5 }] }], 'bad-loss'],
    [[{ at: NOW, decisions: [{ kind: 'flop-call', loss: 0, stake: 0.5 }] }], 'bad-stake'],
    [[{ at: NOW, decisions: [{ kind: 'flop-call', loss: 0, stake: 900 }] }], 'bad-stake'],
    [[{ at: 'soon', decisions: [] }], 'bad-hand'],
    [hands(2, 0, 10, NOW + 10 * 60_000), 'from-the-future'],
    [hands(2, 0, 10, NOW - 30 * 24 * 3_600_000), 'too-old'],
  ]
  for (const [input, reason] of bad) {
    const r = validateHands(input, 0, NOW)
    t.false(r.ok, reason)
    if (!r.ok) t.is(r.reason, reason)
  }
  const good = hands(5, 0)
  const badLast = [...good, { at: NOW, decisions: [{ kind: 'flop-call', loss: 99, stake: 100 }] }]
  t.false(validateHands(badLast, 0, NOW).ok)
})

test('hands must finish in order, a plausible time apart, and only once', (t) => {
  const two = (gap: number) => [
    { at: NOW - 60_000, decisions: [{ kind: 'flop-call', loss: 0, stake: 5 }] },
    { at: NOW - 60_000 + gap, decisions: [{ kind: 'flop-call', loss: 0, stake: 5 }] },
  ]
  const fast = validateHands(two(MIN_HAND_GAP_MS - 1), 0, NOW)
  t.false(fast.ok)
  if (!fast.ok) t.is(fast.reason, 'too-fast')
  const backwards = validateHands(two(-10_000), 0, NOW)
  t.false(backwards.ok)
  if (!backwards.ok) t.is(backwards.reason, 'out-of-order')
  const again = validateHands(two(5_000), NOW - 30_000, NOW)
  t.false(again.ok)
  if (!again.ok) t.is(again.reason, 'already-counted')
})

test('an established rating moves at most 60 points a submission', (t) => {
  const settled = play(emptyCore(), 300, 0.45)
  const before = ratingOf(settled)
  const { rating, clamped } = applySubmission(settled, hands(150, 0, 10))
  t.true(clamped)
  t.is(rating, before + MAX_CHANGE_PER_SUBMIT)
  const down = applySubmission(settled, hands(150, 10, 10))
  t.is(down.rating, before - MAX_CHANGE_PER_SUBMIT)
})

test('a provisional rating is free to find its level', (t) => {
  const { rating, clamped } = applySubmission(emptyCore(), hands(40, 0, 10))
  t.false(clamped)
  t.true(rating > 1000 + MAX_CHANGE_PER_SUBMIT)
})

test('the server replays decisions itself and enforces its rate limits', (t) => {
  const first = decideSubmission(hands(20, 0.5), null, null, NOW)
  t.true(first.ok)
  if (!first.ok) return
  t.is(first.numbers.ratedDecisions, 20)
  t.is(first.numbers.rating, ratingOf(first.state.core))
  t.is(first.numbers.weekStart, '2026-11-02')

  const soon = decideSubmission(
    hands(2, 0, 10, NOW + 1_000),
    first.state,
    first.numbers,
    NOW + MIN_SUBMIT_GAP_MS - 1,
  )
  t.false(soon.ok)
  if (!soon.ok) t.is(soon.reason, 'too-soon')

  const replay = decideSubmission(hands(20, 0), first.state, first.numbers, NOW + MIN_SUBMIT_GAP_MS)
  t.false(replay.ok)
  if (!replay.ok) {
    t.is(replay.reason, 'already-counted')
    t.is(replay.state.rejected, 1)
  }

  // Past the hour's allowance: 900 decisions is a hand every four seconds for an hour.
  const many = { ...first.state, hourDecisions: MAX_DECISIONS_PER_HOUR, hourStart: NOW }
  const limited = decideSubmission(hands(5, 0, 10, NOW + 20_000), many, first.numbers, NOW + 60_000)
  t.false(limited.ok)
  if (!limited.ok) t.is(limited.reason, 'hourly-limit')
})

test('a record better than anyone measured is flagged off the board', (t) => {
  const perfect = { ...freshState(), core: play(emptyCore(), FLAG_AFTER, 0) }
  const r = decideSubmission(hands(5, 0), perfect, null, NOW)
  t.true(r.ok)
  if (r.ok) t.true(r.numbers.flagged)
  const honest = { ...freshState(), core: play(emptyCore(), FLAG_AFTER, 0.4) }
  const h = decideSubmission(hands(5, 0.4), honest, null, NOW)
  if (h.ok) t.false(h.numbers.flagged)
})

test('the week starts on Monday, UTC', (t) => {
  t.is(weekStartOf(Date.parse('2026-11-08T23:59:00Z')), '2026-11-02')
  t.is(weekStartOf(Date.parse('2026-11-09T00:00:00Z')), '2026-11-09')
})

test('a stored core is read back defensively', (t) => {
  t.deepEqual(parseCore(null), emptyCore())
  t.deepEqual(parseCore({ sum: -1, weight: 1, decisions: 1 }), emptyCore())
  const c = play(emptyCore(), 10, 0.3)
  t.deepEqual(parseCore(JSON.parse(JSON.stringify(c))), c)
})

test('names and faces on the board are cleaned', (t) => {
  t.is(cleanName('  Will\u0000 '), 'Will')
  t.is(cleanName(''), 'Player')
  t.is(cleanName(42), 'Player')
  t.is(cleanName('x'.repeat(40)).length, 24)
  t.is(cleanAvatar({ seed: 'a', backgroundColor: 'red' }), null)
  t.deepEqual(cleanAvatar({ seed: 'a', backgroundColor: 'b6e3f4', extra: 1 }), {
    seed: 'a',
    backgroundColor: 'b6e3f4',
  })
})

// --- the table behind the board --------------------------------------------------

const migration = readFileSync(
  new URL('../supabase/migrations/20261104090000_ratings.sql', import.meta.url),
  'utf-8',
).replace(/^\s*--.*$/gm, ' ')

test('the board is readable by anyone and writable by no client', (t) => {
  t.regex(migration, /create policy[^;]*on public\.ratings for select/i)
  t.notRegex(migration, /for (insert|update|delete|all)/i)
  // The arithmetic and the rate limits are not readable at all.
  t.notRegex(migration, /create policy[^;]*on public\.rating_state/i)
  t.regex(migration, /not hidden and not flagged/i)
})

test('nothing in the app writes the ratings tables', (t) => {
  const walk = (dir: string): string[] => {
    return readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap(
      (e) =>
        e.isDirectory()
          ? walk(`${dir}/${e.name}`)
          : /\.tsx?$/.test(e.name)
            ? [`${dir}/${e.name}`]
            : [],
    )
  }
  for (const path of walk('src')) {
    const code = readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')
    t.notRegex(
      code,
      /\.from\(\s*'(ratings|rating_state)'\s*\)\s*\.(insert|update|upsert|delete)\b/,
      path,
    )
    t.notRegex(code, /\.from\(\s*'rating_state'\s*\)/, path)
  }
})

test('bands are plain names that do not reuse the Roll titles', async (t) => {
  const { RATING_BANDS, bandFor } = await import('@/lib/rating')
  const { RANKS } = await import('@/config/ranks')
  const titles = new Set(RANKS.map((r) => r.name))
  for (const band of RATING_BANDS) t.false(titles.has(band.name), band.name)
  t.is(bandFor(1000), 'Steady')
  t.is(bandFor(2600), 'Master')
  t.is(bandFor(100), 'Learning')
})

// --- on the device ---------------------------------------------------------------

test('a hand moves the device rating, its day, its peak and its graph', async (t) => {
  const { emptyRating, recordRatedHand, ratingToday } = await import('@/lib/rating/local')
  let r = emptyRating()
  for (let i = 0; i < PROVISIONAL_DECISIONS; i++) {
    // Ordinary play, well under the experience cap, so one bad call shows.
    r = recordRatedHand(r, [{ kind: 'flop-fold', loss: 0.3, stake: 10 }], '2026-11-03')
  }
  t.truthy(r.peak)
  r = recordRatedHand(r, [{ kind: 'river-call', loss: 8, stake: 30 }], '2026-11-04')
  t.true(ratingToday(r, '2026-11-04') < 0)
  t.is(ratingToday(r, '2026-11-05'), 0)
  t.deepEqual(
    r.history.map((p) => p.date),
    ['2026-11-03', '2026-11-04'],
  )
  t.true((r.peak ?? 0) > ratingOf(r.core))
  t.is(recordRatedHand(r, [], '2026-11-04'), r)
})

test('two devices: the busier rating wins whole, and hiding sticks', async (t) => {
  const { emptyRating, mergeRatings, recordRatedHand } = await import('@/lib/rating/local')
  const busy = recordRatedHand(
    emptyRating(),
    [
      { kind: 'flop-call', loss: 0, stake: 5 },
      { kind: 'flop-call', loss: 0, stake: 5 },
    ],
    '2026-11-04',
  )
  const hidden = { ...emptyRating(), hidden: true }
  const merged = mergeRatings(hidden, busy)
  t.is(merged.core.decisions, 2)
  t.true(merged.hidden)
  t.is(mergeRatings(null, undefined).core.decisions, 0)
  t.is(mergeRatings({ junk: true } as never, busy).core.decisions, 2)
})

test('only Hold’em the player could fully see is rated', async (t) => {
  const { ALL_VENUES, MYSTERY_TABLE, ratedVenue } = await import('@/config/venues')
  t.false(ratedVenue(MYSTERY_TABLE), 'Mystery Card hides one of your own cards')
  for (const v of ALL_VENUES) {
    if (v.mystery) t.false(ratedVenue(v), `${v.id} hides a card and must not be rated`)
    if (v.variant && v.variant !== 'holdem') t.false(ratedVenue(v), v.id)
  }
  t.true(ratedVenue(ALL_VENUES.find((v) => v.id === 'garage')!))
})

test('the Edge Function runs exactly the rule the device runs', (t) => {
  // The browser may not import from supabase/functions (tests/billing.test.ts),
  // so the function keeps a copy. Byte for byte, or the board and the device
  // disagree about the same decisions.
  const device = readFileSync(new URL('../src/lib/rating/maths.ts', import.meta.url), 'utf-8')
  const server = readFileSync(
    new URL('../supabase/functions/_shared/rating.ts', import.meta.url),
    'utf-8',
  )
  t.is(server, device, 'copy src/lib/rating/maths.ts to supabase/functions/_shared/rating.ts')
  t.notRegex(device, /^import /m, 'the shared rule must stay import-free to run under Deno')
})
