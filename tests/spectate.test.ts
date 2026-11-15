import { readFileSync, readdirSync } from 'node:fs'
import test, { type ExecutionContext } from 'ava'

// Watching it out after you bust (pip-web#120).
//
// There is no browser here, so what can be checked is the shape of the thing
// rather than the screen: that the spectator view cannot be reached while a
// hand is live, that it changes nothing about the run, and that the table still
// does not know what a membership is. The store itself runs in Node, so the
// tests at the end of the file play a watched table out for real.
//
// What this cannot cover, and what still needs somebody to sit down and bust:
// that the pause between hands reads as a pause rather than a freeze, that six
// seats playing down to one is watchable rather than long, and that the cards
// going face up feels like the reward it is meant to be.

// An in-memory `localStorage` so the table snapshot has somewhere to go,
// installed before the stores are imported, as in tests/ladderSeats.test.ts.
const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  },
})
// lib/handTally reads the room server's address when it loads, and counts
// nothing without one. The watched-table test below needs it to count.
process.env.NEXT_PUBLIC_ROOMS_URL = 'https://rooms.test'

const { useGame, loadTableSnapshot } = await import('@/store/game')
const { useProfile } = await import('@/store/profile')
const { dailyFor } = await import('@/config/venues')
const { isHandComplete, legalActions } = await import('@/lib/poker/engine')
const { dailyDateKey } = await import('@/lib/daily')
const { loadReview } = await import('@/lib/review/session')

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

const STORE = 'src/store/game.ts'
const TABLE = 'src/components/table/Table.tsx'
const DIALOG = 'src/components/table/PlayerDialog.tsx'

// The three refusals, in the store, where both callers have to go through them.
// A screen deciding for itself is the `lib/sitDown` bug one room over.
test('watching is refused to non-members, at cash tables, and before you are out', (t) => {
  const source = code(STORE)
  const body = source.slice(source.indexOf('watchItOut: () =>'))
  t.regex(body, /if \(!venue \|\| venue\.cash\) return/, 'a cash table has no finish to watch')
  t.regex(body, /if \(status !== 'busted'\) return/, 'watching is reachable before busting')
  t.regex(body, /if \(!member\) return/, 'watching is not gated on the membership')
})

// The equity readout is the part that would be a cheat if it leaked. The guard
// belongs upstream of the component, so that a prop nobody passed is not the
// only thing standing between a live opponent and their hole cards.
test('the spectator readout answers nothing while a hand is live', (t) => {
  const source = code(STORE)
  const body = source.slice(source.indexOf('spectatorEquity: (playerId)'))
  t.regex(
    body,
    /if \(status !== 'watching' \|\| !hand\) return null/,
    'spectatorEquity answers outside the spectator view',
  )
  t.regex(
    body,
    /status === 'folded' \|\| player\.status === 'out'/,
    'a folded player still returns an equity',
  )
})

// Busting already records the place, the venue result, the challenge result and
// the recap. Watching afterwards is a spectator seat at a game that is over, so
// the recording path must not be reachable a second time.
//
// This reads the branch; it cannot tell whether the branch is ever reached. For
// a long time it was not (the deal put the status back to `playing`), so the
// tests at the end of the file play a watched table out to prove it is.
test('watching records nothing — the run was settled when the chips went', (t) => {
  // Bounded by two pieces of *code*, not by a comment: `code()` strips comments
  // before this runs, so slicing to a `//` marker silently ran to the end of the
  // file and scanned the whole store. The end marker is the human-outcome
  // branch the watching branch sits immediately above.
  const source = code(STORE)
  const start = source.indexOf("if (get().status === 'watching') {")
  const end = source.indexOf('if (!humanAlive) {', start)
  t.true(start > 0, 'the watching branch is gone from finishHand')
  t.true(end > start, 'the watching branch is no longer above the human-outcome branch')
  const watchBlock = source.slice(start, end)
  for (const forbidden of [
    'recordVenueResult',
    'recordChallengeResult',
    'recordDailyResult',
    'recordRollPoint',
    'adjustRoll',
    'makeRecap',
    'mergeStats',
  ]) {
    t.false(watchBlock.includes(forbidden), `the watching branch calls ${forbidden}`)
  }
})

// The rule from tests/membershipSurfaces.test.ts, restated from the other side:
// the table is *told* whether this is a member's table when it opens, and never
// asks. This is the test that fails if somebody "simplifies" it to a hook.
test('the table is handed its membership and never looks it up', (t) => {
  const store = code(STORE)
  t.regex(store, /member: human\.member/, 'sitDown does not carry the membership onto the table')
  t.notRegex(
    store,
    /useEntitlement|useMembership/,
    'the game store reaches for the entitlement store',
  )
  t.notRegex(
    code(TABLE),
    /useEntitlement|useMembership/,
    'the table reaches for the entitlement store',
  )
})

// Nothing may be revealed by the spectator view that a live table would keep
// back. The reveal flag is one expression and it is worth pinning, because
// widening it by accident shows a live opponent's cards.
test('cards go face up for a spectator and for a showdown, and nothing else', (t) => {
  const source = code(TABLE)
  t.regex(source, /const spectating = status === 'watching'/)
  t.regex(source, /const revealAll = showdownReveal \|\| spectating/)
  // Every seat's reveal reads the combined flag, so there is one rule rather
  // than one per render site. Since the table was drawn as a table (2026-10-07)
  // phone and desktop seat their opponents through the same site; at least one
  // has to exist, or this test is checking nothing.
  const reveals = source.match(/reveal=\{[^}]*\}/g) ?? []
  t.true(reveals.length >= 1, `found ${reveals.length} reveal sites, expected at least one`)
  for (const site of reveals) {
    t.true(site.includes('revealAll'), `a reveal site does not use the shared rule: ${site}`)
  }
})

// The dialog takes the cards and the number as props it can only be given, and
// never reaches for them itself.
test('the player dialog cannot find a hole card on its own', (t) => {
  const source = code(DIALOG)
  t.notRegex(source, /useGame/, 'the dialog reads the game store directly')
  t.regex(source, /hole\?: readonly Card\[\] \| null/)
  t.regex(source, /equity\?: number \| null/)
})

// A spectated table still has to clean up after itself. The pause between hands
// is a timer, and a timer that outlives the table deals a hand into a store
// that has moved on.
test('leaving cancels the pause between spectated hands', (t) => {
  const source = code(STORE)
  const clear = source.slice(source.indexOf('function clearTimers()'))
  t.regex(clear.slice(0, 200), /watchTimer/, 'clearTimers does not cancel the spectator pause')
  t.regex(source, /let watchTimer/, 'the spectator pause is not held anywhere it can be cancelled')
})

// Sanity: the files this test reasons about all still exist and are the ones
// named. A test that silently reads nothing passes for the wrong reason.
test('the files this test reads are really there', (t) => {
  for (const path of [STORE, TABLE, DIALOG]) {
    t.true(read(path).length > 500, `${path} is missing or suspiciously small`)
  }
  t.true(readdirSync(new URL('../src/components/table', import.meta.url)).includes('Table.tsx'))
})

// --- a watched table, played out ---------------------------------------------
//
// The store driven for real, at the Daily because it is the table with a prize
// below first. A busted player who watched used to be settled again on every
// watched hand: one place higher each time somebody else went, the runner-up
// prize if that came to second, and every hand they were not in counted as one
// they played. One press of "Watch it out" has to carry the table all the way
// down to one, as a spectator, with the player's record exactly as it stood at
// the bust.

const MEMBER = { name: 'Hero', avatar: { seed: 'hero', backgroundColor: 'b6e3f4' }, member: true }

/**
 * The day the table is dealt on. The Daily seeds everything that decides a hand
 * from its date: the cast and their forms, the deck and the opponents' draws.
 * So the clock is pinned for these tests, and every run on every machine on
 * every day plays the same deals. Midday UTC, so no timezone moves the day.
 * What is left to `Math.random` is flavour that decides nothing at the felt:
 * table talk and the bankrolls on the profile cards.
 *
 * If a change to the AI means this day's deals no longer end the way a test
 * needs, the test says so; pick another day that does.
 */
const PINNED_DAY = '2026-10-01'
const PINNED_NOW = Date.parse(`${PINNED_DAY}T12:00:00Z`)

/** Four short stacks, so the table plays down in a few dozen hands. */
const FOUR_LEFT = [60, 60, 60, 60]
/** One opponent with chips: busting here leaves nobody to watch. */
const ONE_LEFT = [60, 0, 0, 0]

/** The store's id for the player's seat, which it does not export. */
const HERO = 'hero'

/**
 * The store's pacing timers, queued and run by hand instead of waited for, in
 * the order they were set. That is sound because the store never has two of
 * its own pending at once: an opponent's turn, or the pause between watched
 * hands, and each is set by the one before.
 */
const queued = new Map<number, () => void>()
let nextTimer = 1
function runNextTimer(): boolean {
  const next = queued.entries().next()
  if (next.done) return false
  const [id, fn] = next.value
  queued.delete(id)
  fn()
  return true
}

/**
 * Pin the clock and take over the timers for one test, and give both back.
 * The globals are swapped for the whole test, which is safe only because `run`
 * is synchronous from start to finish: nothing else runs until it returns.
 */
function onThePinnedDay(t: ExecutionContext, run: () => void) {
  const RealDate = Date
  class PinnedDate extends RealDate {
    constructor(...args: unknown[]) {
      super(...((args.length > 0 ? args : [PINNED_NOW]) as [number]))
    }
    static now() {
      return PINNED_NOW
    }
  }
  const realSetTimeout = globalThis.setTimeout
  const realClearTimeout = globalThis.clearTimeout
  globalThis.Date = PinnedDate as DateConstructor
  globalThis.setTimeout = ((fn: () => void) => {
    const id = nextTimer++
    queued.set(id, fn)
    return id
  }) as unknown as typeof setTimeout
  globalThis.clearTimeout = ((id: number) => void queued.delete(id)) as typeof clearTimeout
  try {
    t.is(dailyDateKey(), PINNED_DAY, 'the clock is not pinned')
    run()
  } finally {
    useGame.getState().leave()
    queued.clear()
    globalThis.setTimeout = realSetTimeout
    globalThis.clearTimeout = realClearTimeout
    globalThis.Date = RealDate
  }
}

/** Check when it is free, fold when it is not: the player never wins a pot on purpose. */
function heroGivesUp(): boolean {
  const { hand, status } = useGame.getState()
  if (status !== 'playing' || !hand || isHandComplete(hand)) return false
  if (hand.players[hand.toActIndex]?.id !== HERO) return false
  const legal = legalActions(hand)
  if (!legal) return false
  useGame.getState().act({ type: legal.canCheck ? 'check' : 'fold' })
  return true
}

/** Sit at the Daily with one chip against `opponents`, and play until it is gone. */
function bustAtTheDaily(opponents: readonly number[]): boolean {
  const venue = dailyFor(0)
  useGame.getState().sitDown(venue, MEMBER)
  const snapshot = loadTableSnapshot()
  if (!snapshot) return false
  let next = 0
  useGame.getState().resumeTable(
    venue,
    {
      ...snapshot,
      live: undefined,
      seats: snapshot.seats.map((s) => ({ ...s, stack: s.isHuman ? 1 : (opponents[next++] ?? 0) })),
    },
    true,
  )
  for (let step = 0; step < 5_000; step++) {
    const { status } = useGame.getState()
    if (status === 'busted') return true
    if (status === 'won') return false
    if (status === 'handover') useGame.getState().nextHand()
    else if (!heroGivesUp() && !runNextTimer()) return false
  }
  return false
}

/**
 * The whole profile, so a field added later is covered without touching this,
 * plus the review session, which lives beside it. The one thing left out is the
 * cast's career reads (`castRecords`): whether watching should teach the player
 * about the regulars is a question for the product, not this test.
 */
function playerRecord() {
  const { castRecords, ...profile } = useProfile.getState()
  return { profile, review: loadReview() }
}

test.serial('one press watches the table down to one, and the player record stays put', (t) => {
  onThePinnedDay(t, () => {
    t.true(bustAtTheDaily(FOUR_LEFT), `the ${PINNED_DAY} deal no longer busts the player`)
    const atBust = playerRecord()
    const place = useGame.getState().place
    t.true(place !== null && place > 2, `busted in place ${place}, nothing to watch for`)
    t.not(useGame.getState().recap, null, 'busting built no recap')
    t.is(loadTableSnapshot(), null, 'busting left a table snapshot behind')

    // The landing page's hand count (lib/handTally) counts only in a browser,
    // so the watch is given one: a `window`, and a `fetch` that keeps whatever
    // the count would have sent instead of sending it.
    const pendingAtBust = localStorage.getItem('pip.handsToReport')
    const sent: unknown[] = []
    const realFetch = globalThis.fetch
    Object.assign(globalThis, {
      window: globalThis,
      fetch: (...args: unknown[]) => {
        sent.push(args)
        return Promise.resolve(new Response())
      },
    })

    const statuses = new Set<string>()
    const handsSeen = new Set<number>()
    let answered = 0
    try {
      useGame.getState().watchItOut()
      for (let step = 0; step < 50_000; step++) {
        const { status, hand, handIndex, heroEquity, spectatorEquity } = useGame.getState()
        statuses.add(status)
        if (hand && !isHandComplete(hand) && !handsSeen.has(handIndex)) {
          handsSeen.add(handIndex)
          t.is(loadTableSnapshot(), null, `watched hand ${handIndex} wrote a table snapshot`)
          t.is(heroEquity, null, 'an equity for a player who is out')
          const live = hand.players.find((p) => p.status === 'active' || p.status === 'allin')
          if (live && spectatorEquity(live.id) !== null) answered++
        }
        if (!runNextTimer()) break
      }
    } finally {
      Reflect.deleteProperty(globalThis, 'window')
      globalThis.fetch = realFetch
    }

    t.is(
      localStorage.getItem('pip.handsToReport'),
      pendingAtBust,
      'a watched hand went on the landing page count',
    )
    t.deepEqual(sent, [], 'a watched hand reported to the landing page count')
    t.deepEqual([...statuses], ['watching'], 'the table stopped being a spectated one')
    t.true(handsSeen.size > 1, `only ${handsSeen.size} hand was watched`)
    t.true(answered > 0, 'the spectator readout never answered during a watched hand')
    const { seats, message } = useGame.getState()
    t.is(seats.filter((s) => s.stack > 0).length, 1, 'one press did not play the table down')
    t.regex(message ?? '', /takes it\.$/)

    t.is(useGame.getState().place, place, 'the place moved after the bust')
    t.is(useGame.getState().recap, null, 'a second recap was built')
    t.deepEqual(playerRecord(), atBust, 'watching wrote to the player record')
    t.is(loadTableSnapshot(), null)

    // A second press has nothing left to start.
    useGame.getState().watchItOut()
    t.is(useGame.getState().status, 'watching')
    t.is(queued.size, 0, 'a second press dealt again')
    t.deepEqual(playerRecord(), atBust)

    // And the next table is an ordinary one: dealt in, and snapshotted.
    useGame.getState().sitDown(dailyFor(0), MEMBER)
    t.is(useGame.getState().status, 'playing')
    t.true(useGame.getState().hand?.players.some((p) => p.id === HERO))
    t.not(loadTableSnapshot(), null, 'the next table is not snapshotted')
  })
})

test.serial('leaving a watched table stops it, mid-hand or between hands', (t) => {
  onThePinnedDay(t, () => {
    for (const when of ['mid-hand', 'between hands'] as const) {
      t.true(bustAtTheDaily(FOUR_LEFT), `the ${PINNED_DAY} deal no longer busts the player`)
      const atBust = playerRecord()
      useGame.getState().watchItOut()
      let there = false
      for (let step = 0; step < 50_000 && !there; step++) {
        const { hand, status } = useGame.getState()
        const live = hand !== null && !isHandComplete(hand)
        there = status === 'watching' && queued.size > 0 && (when === 'mid-hand' ? live : !live)
        if (!there && !runNextTimer()) break
      }
      t.true(there, `the watched table never got to ${when}`)

      useGame.getState().leave()
      t.is(queued.size, 0, `a timer outlived leaving ${when}`)
      t.is(useGame.getState().status, 'idle')
      t.deepEqual(playerRecord(), atBust, `leaving ${when} wrote to the player record`)
      t.is(loadTableSnapshot(), null)
    }
  })
})

test.serial('busting with one opponent left leaves nothing to watch', (t) => {
  onThePinnedDay(t, () => {
    t.true(bustAtTheDaily(ONE_LEFT), `the ${PINNED_DAY} heads-up deal no longer busts the player`)
    useGame.getState().watchItOut()
    t.is(useGame.getState().status, 'busted')
    t.is(queued.size, 0, 'a table of one was dealt')
  })
})
