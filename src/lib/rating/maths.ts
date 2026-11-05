// The Pip Rating's arithmetic, in one place (docs/rating.md).
//
// Plain TypeScript with no imports at all, so the same file runs in the browser
// (src/lib/rating), under Node in the tests, and under Deno in the
// `submit-rating` Edge Function, which keeps an exact copy in its own
// `_shared/rating.ts` because nothing the browser loads may import from the
// functions folder (tests/billing.test.ts). tests/rating.test.ts fails the
// build if the two copies differ by a single character, so edit this one and
// copy it across. The function does not take the client's number:
// it replays the decisions it is sent through these functions from its own
// stored state, so there is one rule and nobody can bring their own.
//
// **It rates decisions, not results.** Every input is the chip cost Pip already
// works out for the read on every hand (`scoreDecisions` in src/lib/coach.ts):
// what a call or a fold gave up against the other choice, priced from the
// cards the player could see when they made it. A call that was right and lost
// to a two-outer costs nothing here, because the river is not in the arithmetic.

/**
 * The kinds of decision a rating is made of: a call or a fold facing a bet, by
 * street, and the first move when it folds round to you before the flop, graded
 * off the opening chart (`preflop-open`) or, at 15 big blinds or fewer, the
 * shove chart (`preflop-shove`). See src/lib/rating/preflop.ts.
 */
export const RATING_KINDS = [
  'preflop-call',
  'preflop-fold',
  'flop-call',
  'flop-fold',
  'turn-call',
  'turn-fold',
  'river-call',
  'river-fold',
  'preflop-open',
  'preflop-shove',
] as const

export type RatingKind = (typeof RATING_KINDS)[number]

export function isRatingKind(value: unknown): value is RatingKind {
  return typeof value === 'string' && (RATING_KINDS as readonly string[]).includes(value)
}

/**
 * The most one decision can cost, in big blinds. Calling off a deep stack can
 * give away fifty blinds in one go; counted in full, a single spot would move a
 * rating further than a hundred good ones. Twenty is still a heavy mark.
 */
export const LOSS_CAP_BB = 20

/**
 * The most one decision weighs, in big blinds at stake. A pot past this counts
 * as this big, so one huge hand cannot outweigh a session.
 */
export const STAKE_CAP_BB = 200

/**
 * How fast old decisions fade. Each new decision multiplies the weight of every
 * one before it by this, so the last ~300 carry most of the rating (the
 * effective window is `1 / (1 - DECAY)` decisions) and a player who has got
 * better is not held to last month.
 */
export const DECAY = 1 - 1 / 300

/**
 * Where a new player starts: the share a sound beginner gives away, which the
 * scale puts at 1000. It counts as this many big blinds at stake (about twenty
 * decisions), so the first few hands move the number without throwing it to
 * either end of the scale.
 */
export const PRIOR_WEIGHT = 100

/** Rated decisions before the rating stops being provisional. */
export const PROVISIONAL_DECISIONS = 50

/** The bottom and the top of the scale. Nobody can be rated outside them. */
export const RATING_FLOOR = 100
export const RATING_CEILING = 3000

/**
 * The scale, from the share of the pot given away to a rating.
 *
 * "Loss" here is big blinds given up per big blind at stake: every decision's
 * cost, summed, over the pots those decisions were made in (the pot plus the
 * price), both exponentially weighted. A call that gave away 2 blinds in a
 * 20-blind pot is a loss of 0.1.
 *
 * `rating = ANCHOR_RATING − STEP × log2(loss / ANCHOR_LOSS)`, clamped to
 * 100..3000, and then held under the experience cap (`experienceCap`).
 *
 * So `ANCHOR_RATING` is a player who gives away `ANCHOR_LOSS` of what is at
 * stake, and every halving of that is `STEP` points. The numbers are measured
 * (`pnpm rating-calibrate`, docs/rating.md), and set so that 2000 sits above
 * the strongest proxy Pip has: like 2000 in chess, most players never get
 * there.
 */
export const ANCHOR_RATING = 1000
export const ANCHOR_LOSS = 0.025
export const STEP = 350

export function ratingFromLoss(loss: number): number {
  if (!Number.isFinite(loss) || loss <= 0) return RATING_CEILING
  const raw = ANCHOR_RATING - STEP * Math.log2(loss / ANCHOR_LOSS)
  return Math.round(Math.min(RATING_CEILING, Math.max(RATING_FLOOR, raw)))
}

/** The inverse, for setting the prior, holding a change to its limit, and the tests. */
export function lossForRating(rating: number): number {
  return ANCHOR_LOSS * 2 ** ((ANCHOR_RATING - rating) / STEP)
}

/** The loss a new player is assumed to have until they show otherwise. */
export const PRIOR_LOSS = lossForRating(1000)

/** What one decision cost, in big blinds: never negative, never past the cap. */
export function decisionLoss(bbGivenUp: number): number {
  if (!Number.isFinite(bbGivenUp) || bbGivenUp <= 0) return 0
  return Math.min(LOSS_CAP_BB, bbGivenUp)
}

/** What one decision weighs: the big blinds at stake, never past the cap. */
export function decisionStake(bbAtStake: number): number {
  if (!Number.isFinite(bbAtStake) || bbAtStake <= 0) return 0
  return Math.min(STAKE_CAP_BB, bbAtStake)
}

/**
 * Everything a rating is worked out from. Small, and the same shape on the
 * device and on the server.
 *
 * `sum / weight` is big blinds given away per big blind at stake, both
 * exponentially weighted per decision. Both start at the prior and decay
 * together, so the prior fades exactly as an old decision would.
 */
export interface RatingCore {
  sum: number
  weight: number
  /** Rated decisions, ever. Counts up; never decays. */
  decisions: number
  /** Each kind's share of `sum`, decayed in step with it. */
  kinds: Record<RatingKind, number>
  /** Rated decisions of each kind, ever. */
  counts: Record<RatingKind, number>
}

function zeroKinds(): Record<RatingKind, number> {
  return Object.fromEntries(RATING_KINDS.map((k) => [k, 0])) as Record<RatingKind, number>
}

export function emptyCore(): RatingCore {
  return {
    sum: PRIOR_LOSS * PRIOR_WEIGHT,
    weight: PRIOR_WEIGHT,
    decisions: 0,
    kinds: zeroKinds(),
    counts: zeroKinds(),
  }
}

/**
 * One decision in. `loss` is the big blinds it gave up and `stake` the big
 * blinds in the pot it was made in, price included.
 */
export function applyDecision(
  core: RatingCore,
  kind: RatingKind,
  loss: number,
  stake: number,
): RatingCore {
  const w = decisionStake(stake)
  const l = Math.min(decisionLoss(loss), w)
  const kinds = { ...core.kinds }
  for (const k of RATING_KINDS) kinds[k] *= DECAY
  kinds[kind] += l
  return {
    sum: core.sum * DECAY + l,
    weight: core.weight * DECAY + w,
    decisions: core.decisions + 1,
    kinds,
    counts: { ...core.counts, [kind]: core.counts[kind] + 1 },
  }
}

export function lossOf(core: RatingCore): number {
  return core.weight > 0 ? core.sum / core.weight : PRIOR_LOSS
}

/**
 * How high a rating can be until it has been earned over enough decisions:
 * under 300 rated decisions it stays under Strong, under 1,000 under Expert,
 * under 2,500 under Master. A good week is not a career, and in chess nobody
 * reaches 2000 in a month either. The play underneath still counts in full,
 * so the number catches up the moment the cap lifts.
 */
export const EXPERIENCE_CAPS: readonly { before: number; cap: number }[] = [
  { before: 300, cap: 1599 },
  { before: 1_000, cap: 1999 },
  { before: 2_500, cap: 2399 },
]

/** The highest rating `decisions` rated decisions can show. */
export function experienceCap(decisions: number): number {
  for (const step of EXPERIENCE_CAPS) if (decisions < step.before) return step.cap
  return RATING_CEILING
}

/** The rating the play alone earns, before the experience cap. */
export function rawRatingOf(core: RatingCore): number {
  return ratingFromLoss(lossOf(core))
}

/** The rating: what the play earns, held under the experience cap. */
export function ratingOf(core: RatingCore): number {
  return Math.min(rawRatingOf(core), experienceCap(core.decisions))
}

/** Is the rating being held down by the experience cap right now? */
export function isCapped(core: RatingCore): boolean {
  return rawRatingOf(core) > experienceCap(core.decisions)
}

export function isProvisional(decisions: number): boolean {
  return decisions < PROVISIONAL_DECISIONS
}

/**
 * How many points each kind of decision is costing, largest first: the rating
 * with that kind's losses taken out, minus the rating as it is. Kinds that cost
 * nothing are left out.
 */
export function kindCosts(core: RatingCore): { kind: RatingKind; points: number }[] {
  const now = rawRatingOf(core)
  return RATING_KINDS.map((kind) => ({
    kind,
    points: ratingFromLoss((core.sum - core.kinds[kind]) / core.weight) - now,
  }))
    .filter((k) => k.points > 0)
    .sort((a, b) => b.points - a.points)
}

// --- What the server accepts ---------------------------------------------------

/** One rated decision, as sent: which kind, the big blinds it gave up, and the big blinds at stake. */
export interface SubmittedDecision {
  kind: RatingKind
  loss: number
  stake: number
}

/** One hand's rated decisions, and when the hand finished (ms since the epoch). */
export interface SubmittedHand {
  at: number
  decisions: SubmittedDecision[]
}

/** The most hands one submission may carry. The client sends far fewer. */
export const MAX_HANDS_PER_SUBMIT = 200

/** The most rated decisions one hand can carry (`MAX_REVIEWED_DECISIONS` in the store). */
export const MAX_DECISIONS_PER_HAND = 8

/**
 * Hands finish no faster than this, in milliseconds. The quickest hand at a
 * Pip table (fold preflop, the table folds round) still waits on the AI's
 * pause for every seat and the deal, which is several seconds.
 */
export const MIN_HAND_GAP_MS = 2_000

/** How far ahead of the server's clock a hand may claim to have finished. */
export const CLOCK_SKEW_MS = 120_000

/** How old a hand may be when it arrives. A device offline for a week still counts. */
export const MAX_HAND_AGE_MS = 14 * 24 * 60 * 60 * 1000

/** Submissions no closer together than this. */
export const MIN_SUBMIT_GAP_MS = 15_000

/** Rated decisions accepted per rolling hour, at most. */
export const MAX_DECISIONS_PER_HOUR = 900

/** Once established, the most one submission may move the rating, either way. */
export const MAX_CHANGE_PER_SUBMIT = 60

/**
 * Below this share given away (what 2600 is), over at least `FLAG_AFTER`
 * decisions, a record is better than any player Pip has measured: the best
 * proxy rates about 2150 at its best table (docs/rating.md). It is flagged:
 * kept, rated, and left off the leaderboard until somebody looks at it.
 */
export const IMPLAUSIBLE_RATING = 2600
export const IMPLAUSIBLE_LOSS = lossForRating(IMPLAUSIBLE_RATING)
export const FLAG_AFTER = 200

export type Rejection =
  | 'not-a-list'
  | 'empty'
  | 'too-many-hands'
  | 'bad-hand'
  | 'too-many-decisions'
  | 'bad-kind'
  | 'bad-loss'
  | 'bad-stake'
  | 'out-of-order'
  | 'too-fast'
  | 'from-the-future'
  | 'too-old'
  | 'already-counted'
  | 'too-soon'
  | 'hourly-limit'

/**
 * Check a submission's shape and timing. Pure: `lastHandAt` is the last hand
 * the server counted for this player (0 for none), `now` the server's clock.
 * Any failure rejects the whole submission, so a client cannot slip a bad hand
 * in among good ones.
 */
export function validateHands(
  input: unknown,
  lastHandAt: number,
  now: number,
): { ok: true; hands: SubmittedHand[] } | { ok: false; reason: Rejection } {
  if (!Array.isArray(input)) return { ok: false, reason: 'not-a-list' }
  if (input.length === 0) return { ok: false, reason: 'empty' }
  if (input.length > MAX_HANDS_PER_SUBMIT) return { ok: false, reason: 'too-many-hands' }
  const hands: SubmittedHand[] = []
  let previous = lastHandAt
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return { ok: false, reason: 'bad-hand' }
    const { at, decisions } = raw as { at?: unknown; decisions?: unknown }
    if (typeof at !== 'number' || !Number.isFinite(at) || !Array.isArray(decisions))
      return { ok: false, reason: 'bad-hand' }
    if (decisions.length === 0 || decisions.length > MAX_DECISIONS_PER_HAND)
      return { ok: false, reason: 'too-many-decisions' }
    if (at > now + CLOCK_SKEW_MS) return { ok: false, reason: 'from-the-future' }
    if (at < now - MAX_HAND_AGE_MS) return { ok: false, reason: 'too-old' }
    if (at <= lastHandAt) return { ok: false, reason: 'already-counted' }
    if (at <= previous && hands.length > 0) return { ok: false, reason: 'out-of-order' }
    if (previous > 0 && at - previous < MIN_HAND_GAP_MS) return { ok: false, reason: 'too-fast' }
    const out: SubmittedDecision[] = []
    for (const d of decisions) {
      const { kind, loss, stake } = (d ?? {}) as { kind?: unknown; loss?: unknown; stake?: unknown }
      if (!isRatingKind(kind)) return { ok: false, reason: 'bad-kind' }
      // A pot is at least the blinds (1.5) and a stake is never past the cap.
      if (typeof stake !== 'number' || !Number.isFinite(stake) || stake < 1 || stake > STAKE_CAP_BB)
        return { ok: false, reason: 'bad-stake' }
      // A decision cannot give away more than the pot it was made in.
      if (
        typeof loss !== 'number' ||
        !Number.isFinite(loss) ||
        loss < 0 ||
        loss > LOSS_CAP_BB ||
        loss > stake
      )
        return { ok: false, reason: 'bad-loss' }
      out.push({ kind, loss, stake })
    }
    hands.push({ at, decisions: out })
    previous = at
  }
  return { ok: true, hands }
}

/** Rated decisions in a validated submission. */
export function decisionCount(hands: readonly SubmittedHand[]): number {
  return hands.reduce((n, h) => n + h.decisions.length, 0)
}

/**
 * The server's whole update, given a submission that passed `validateHands`
 * and the rate limits: replay every decision onto the stored core, then hold
 * an established rating to `MAX_CHANGE_PER_SUBMIT` of where it was.
 *
 * The clamp moves the core, not just the number shown, by blending the new
 * mean loss back towards the old one until the rating sits at the limit. That
 * keeps the next submission starting from the number the board showed.
 */
export function applySubmission(
  core: RatingCore,
  hands: readonly SubmittedHand[],
): { core: RatingCore; rating: number; clamped: boolean } {
  // Held on the rating the play earns, not the capped one: a cap lifting is
  // not a jump the play made, and clamping it would rewrite the play.
  const before = rawRatingOf(core)
  let next = core
  for (const hand of hands)
    for (const d of hand.decisions) next = applyDecision(next, d.kind, d.loss, d.stake)
  const after = rawRatingOf(next)
  if (isProvisional(core.decisions) || Math.abs(after - before) <= MAX_CHANGE_PER_SUBMIT) {
    return { core: next, rating: ratingOf(next), clamped: false }
  }
  const target = before + Math.sign(after - before) * MAX_CHANGE_PER_SUBMIT
  const loss = lossForRating(target)
  const scale = next.sum > 0 ? (loss * next.weight) / next.sum : 1
  const kinds = { ...next.kinds }
  for (const k of RATING_KINDS) kinds[k] *= scale
  const clampedCore = { ...next, sum: loss * next.weight, kinds }
  return { core: clampedCore, rating: ratingOf(clampedCore), clamped: true }
}

/** Should this record be kept off the board until somebody looks at it? */
export function looksImplausible(core: RatingCore): boolean {
  return core.decisions >= FLAG_AFTER && lossOf(core) < IMPLAUSIBLE_LOSS
}

/**
 * A stored core, read back defensively: anything malformed starts again from
 * the prior rather than throwing.
 */
export function parseCore(value: unknown): RatingCore {
  const fresh = emptyCore()
  if (!value || typeof value !== 'object') return fresh
  const v = value as Partial<RatingCore>
  const num = (n: unknown, min = 0) =>
    typeof n === 'number' && Number.isFinite(n) && n >= min ? n : null
  const sum = num(v.sum)
  const weight = num(v.weight, 1e-9)
  const decisions = num(v.decisions)
  if (sum === null || weight === null || decisions === null) return fresh
  const kinds = zeroKinds()
  const counts = zeroKinds()
  for (const k of RATING_KINDS) {
    kinds[k] = num(v.kinds?.[k]) ?? 0
    counts[k] = Math.floor(num(v.counts?.[k]) ?? 0)
  }
  return { sum, weight, decisions: Math.floor(decisions), kinds, counts }
}

// --- The server's decision, start to finish ------------------------------------

/** What the server keeps per player, privately (`rating_state`). */
export interface ServerState {
  core: RatingCore
  lastHandAt: number
  lastSubmitAt: number | null
  hourStart: number | null
  hourDecisions: number
  rejected: number
}

/** The public row's numbers (`ratings`). */
export interface PublicNumbers {
  rating: number
  peak: number
  ratedDecisions: number
  weekStart: string
  weekStartRating: number
  flagged: boolean
}

export function freshState(): ServerState {
  return {
    core: emptyCore(),
    lastHandAt: 0,
    lastSubmitAt: null,
    hourStart: null,
    hourDecisions: 0,
    rejected: 0,
  }
}

/** The Monday of this UTC week, as `YYYY-MM-DD`: when "this week's climbers" starts. */
export function weekStartOf(now: number): string {
  const d = new Date(now)
  const back = (d.getUTCDay() + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back))
    .toISOString()
    .slice(0, 10)
}

const HOUR = 60 * 60 * 1000

/** Refusals that say "later", not "never": the client keeps those hands and tries again. */
export const RETRYABLE: readonly Rejection[] = ['too-soon', 'hourly-limit']

/**
 * Everything `submit-rating` decides, without the network or the database.
 *
 * Rate limits first (one submission per `MIN_SUBMIT_GAP_MS`, at most
 * `MAX_DECISIONS_PER_HOUR` decisions an hour), then the shape and timing of
 * every hand (`validateHands`), then the replay (`applySubmission`, which
 * holds an established rating to `MAX_CHANGE_PER_SUBMIT`). A record better
 * than anybody measured is flagged off the board, never sent back down.
 */
export function decideSubmission(
  input: unknown,
  stored: ServerState | null,
  row: PublicNumbers | null,
  now: number,
):
  | { ok: false; reason: Rejection; state: ServerState }
  | { ok: true; state: ServerState; numbers: PublicNumbers; clamped: boolean } {
  const state = stored ?? freshState()
  if (state.lastSubmitAt !== null && now - state.lastSubmitAt < MIN_SUBMIT_GAP_MS)
    return { ok: false, reason: 'too-soon', state }

  const checked = validateHands(input, state.lastHandAt, now)
  if (!checked.ok) {
    return { ok: false, reason: checked.reason, state: { ...state, rejected: state.rejected + 1 } }
  }

  const inHour = state.hourStart !== null && now - state.hourStart < HOUR
  const hourDecisions = (inHour ? state.hourDecisions : 0) + decisionCount(checked.hands)
  if (hourDecisions > MAX_DECISIONS_PER_HOUR) return { ok: false, reason: 'hourly-limit', state }

  const { core, rating, clamped } = applySubmission(state.core, checked.hands)
  const week = weekStartOf(now)
  const before = row?.rating ?? ratingOf(state.core)
  const numbers: PublicNumbers = {
    rating,
    // The peak is an established rating's best; a provisional number is not one.
    peak: isProvisional(core.decisions) ? (row?.peak ?? rating) : Math.max(row?.peak ?? 0, rating),
    ratedDecisions: core.decisions,
    weekStart: week,
    weekStartRating: row && row.weekStart === week ? row.weekStartRating : before,
    // A flag stays until somebody clears it by hand.
    flagged: (row?.flagged ?? false) || looksImplausible(core),
  }
  return {
    ok: true,
    clamped,
    numbers,
    state: {
      core,
      lastHandAt: checked.hands[checked.hands.length - 1].at,
      lastSubmitAt: now,
      hourStart: inHour ? state.hourStart : now,
      hourDecisions,
      rejected: state.rejected,
    },
  }
}

/**
 * The name the board shows: the synced display name, trimmed, with control
 * characters taken out and cut to 24. Anything unusable reads "Player".
 */
export function cleanName(value: unknown): string {
  if (typeof value !== 'string') return 'Player'
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, '').trim()
  return name.length > 0 ? name.slice(0, 24) : 'Player'
}

/**
 * The face the board shows, kept only if it is the shape an avatar has: a seed,
 * a six-digit background and, optionally, an object of picked parts, all small.
 * The client still draws it through its own parser.
 */
export function cleanAvatar(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (typeof v.seed !== 'string' || v.seed.length > 64) return null
  if (typeof v.backgroundColor !== 'string' || !/^[0-9a-f]{6}$/i.test(v.backgroundColor))
    return null
  const out: Record<string, unknown> = { seed: v.seed, backgroundColor: v.backgroundColor }
  if (v.features && typeof v.features === 'object' && !Array.isArray(v.features)) {
    const features: Record<string, string> = {}
    for (const [k, f] of Object.entries(v.features as Record<string, unknown>).slice(0, 16)) {
      if (/^[a-zA-Z]{1,16}$/.test(k) && typeof f === 'string' && /^[\w-]{1,32}$/.test(f))
        features[k] = f
    }
    if (Object.keys(features).length > 0) out.features = features
  }
  return out
}
