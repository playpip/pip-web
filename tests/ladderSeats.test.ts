import { readFileSync } from 'node:fs'
import test from 'ava'
import { draftCast, profileFor } from '@/config/cast'
import {
  ALL_VENUES,
  LADDER_SEATS,
  RAIL_SEATS,
  THE_DAILY,
  VENUES,
  playPath,
  seatChoices,
  venueById,
  withSeats,
} from '@/config/venues'
import { mulberry32 } from '@/lib/poker/cards'

// The top of the ladder can be sat down at six, seven or eight. A ladder prize
// is priced on the count, so what is pinned here is that the prize follows it
// one buy-in per chair, that the count only ever goes up from the rung's own,
// and that nothing below The Riverboat, and nothing that is not the ladder,
// can be re-sized at all.
//
// What this cannot cover: the screen. That the picker shows on the dialog of a
// top rung and not on a lower one is held below by reading the dialog's source;
// that eight seats fit the felt on a phone is the custom table's layout (#222)
// and still wants looking at.

/**
 * An in-memory `localStorage` so the table snapshot has somewhere to go.
 * Installed before the store is imported, which is why that import is dynamic.
 */
const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  },
})

const { useGame, loadTableSnapshot } = await import('@/store/game')

const HERO = {
  name: 'Hero',
  avatar: { seed: 'hero', backgroundColor: 'b6e3f4' },
  member: false,
}

const FROM = VENUES.findIndex((v) => v.id === 'riverboat')
const TOP = VENUES.slice(FROM)
const LOWER = VENUES.slice(0, FROM)

test('the choice starts at The Riverboat, the sixth rung', (t) => {
  t.is(FROM, 5)
  t.deepEqual(
    TOP.map((v) => v.id),
    ['riverboat', 'penthouse', 'montecarlo', 'vegas', 'mainevent'],
  )
  for (const rung of TOP) t.deepEqual(seatChoices(rung), LADDER_SEATS, rung.id)
})

test('below The Riverboat the size is not a choice', (t) => {
  for (const rung of LOWER) {
    t.is(seatChoices(rung), null, rung.id)
    for (const n of RAIL_SEATS) t.is(withSeats(rung, n), rung, `${rung.id} took ${n} seats`)
  }
})

test('nothing off the ladder or the Rail is re-sized', (t) => {
  const ladder = new Set(TOP.map((v) => v.id))
  for (const venue of ALL_VENUES.filter((v) => !v.cash && !ladder.has(v.id))) {
    t.is(seatChoices(venue), null, venue.id)
    t.is(withSeats(venue, 8), venue, `${venue.id} took a new size`)
  }
  t.is(withSeats(THE_DAILY, 8), THE_DAILY)
})

test("a top rung's own six is the prize it always was", (t) => {
  for (const rung of TOP) {
    t.is(rung.seats, 6, rung.id)
    // The rule the bigger tables follow is the one the rung was priced on.
    t.is(rung.prize, rung.buyIn * rung.seats, rung.id)
    t.is(withSeats(rung, 6), rung)
    t.is(withSeats(rung, null), rung)
  }
})

test('at seven and eight the prize is one more buy-in per chair', (t) => {
  for (const rung of TOP) {
    for (const n of [7, 8]) {
      const table = withSeats(rung, n)
      t.is(table.seats, n)
      t.is(table.prize, rung.buyIn * n, `${rung.id} at ${n}`)
      // What each opponent is worth does not move: the winner nets one buy-in
      // per player beaten, at any size on offer.
      t.is((table.prize - table.buyIn) / (n - 1), rung.buyIn)
      // Nothing else about the rung moves either.
      t.deepEqual({ ...table, seats: rung.seats, prize: rung.prize }, rung)
    }
  }
})

test('a top rung cannot be made smaller, or bigger than the felt', (t) => {
  for (const rung of TOP) {
    for (const n of [0, 1, 2, 3, 4, 5, 9, 40, 6.5, Number.NaN]) {
      t.is(withSeats(rung, n), rung, `${rung.id} took ${n}`)
    }
  }
})

test('going back to six takes the prize back with it', (t) => {
  for (const rung of TOP) {
    const back = withSeats(withSeats(rung, 8), 6)
    t.is(back.seats, 6)
    t.is(back.prize, rung.prize)
  }
})

test('only a changed size reaches the route', (t) => {
  const rung = venueById('mainevent')!
  t.is(playPath(rung), '/play/mainevent')
  t.is(playPath(withSeats(rung, 6)), '/play/mainevent')
  t.is(playPath(withSeats(rung, 7)), '/play/mainevent?seats=7')
  t.is(playPath(withSeats(rung, 8)), '/play/mainevent?seats=8')
  // A lower rung has no size to carry, even when handed one.
  t.is(playPath({ ...VENUES[0], seats: 8 }), `/play/${VENUES[0].id}`)
})

test('every top rung seats a full eight with seven different faces at its own game', (t) => {
  for (const rung of TOP) {
    const full = withSeats(rung, 8)
    for (let seed = 1; seed <= 5; seed++) {
      const drawn = draftCast(full, full.seats - 1, mulberry32(seed))
      t.is(drawn.length, 7, rung.id)
      t.is(new Set(drawn.map((ch) => ch.id)).size, 7, `${rung.id}: a face drawn twice`)
      t.true(
        drawn.every((ch) => !ch.only),
        `${rung.id}: a pinned character left their table`,
      )
      // A face topped up from below the band still plays the rung's profile.
      for (const ch of drawn) {
        const { tightness, aggression, bluff, iterations, skill } = profileFor(full, ch)
        t.is(iterations, rung.ai.iterations, `${rung.id}: ${ch.id} thinks less`)
        t.is(skill, rung.ai.skill, `${rung.id}: ${ch.id} plays a cheaper game`)
        t.true([tightness, aggression, bluff].every((x) => x >= 0 && x <= 1))
      }
    }
  }
})

// The store, driven for real: a table sat down at eight writes a snapshot of
// eight, and the route's resume (`PlayClient`: `withSeats(venue,
// snapshot.seats.length)`) hands back the eight-seat prize.
test.serial('a refresh resumes at the size picked, prize included', (t) => {
  const rung = venueById('riverboat')!
  useGame.getState().sitDown(withSeats(rung, 8), HERO)
  try {
    t.is(useGame.getState().seats.length, 8)
    t.is(useGame.getState().venue?.prize, rung.buyIn * 8)

    const snapshot = loadTableSnapshot()
    t.truthy(snapshot, 'sitting down wrote no snapshot')
    if (!snapshot) return
    t.is(snapshot.venueId, 'riverboat')
    t.is(snapshot.seats.length, 8)

    // Mid-hand, as the snapshot was written.
    useGame.getState().resumeTable(withSeats(rung, snapshot.seats.length), snapshot, false)
    t.is(useGame.getState().venue?.seats, 8)
    t.is(useGame.getState().venue?.prize, rung.buyIn * 8)

    // Between hands, two chairs already busted: they still count. They bought
    // in, so their chips are in the prize, and the store keeps their chairs.
    const between = {
      ...snapshot,
      live: undefined,
      seats: snapshot.seats.map((s, i) => (!s.isHuman && i < 3 ? { ...s, stack: 0 } : s)),
    }
    useGame.getState().resumeTable(withSeats(rung, between.seats.length), between, false)
    t.is(useGame.getState().venue?.prize, rung.buyIn * 8)
  } finally {
    useGame.getState().leave()
  }
})

test.serial('a six-seat snapshot from before the choice resumes as it was', (t) => {
  const rung = venueById('penthouse')!
  useGame.getState().sitDown(rung, HERO)
  try {
    const snapshot = loadTableSnapshot()
    t.is(snapshot?.seats.length, 6)
    if (!snapshot) return
    t.is(withSeats(rung, snapshot.seats.length), rung)
  } finally {
    useGame.getState().leave()
  }
})

// --- what the store and the screens must keep doing --------------------------

const code = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

test('a busted seat keeps its chair, so the snapshot counts the table it sat down at', (t) => {
  t.regex(
    code('src/store/game.ts'),
    /const nextSeats = seats\.map\(/,
    'finishHand drops busted chairs; a resumed table would shrink, and its prize with it',
  )
})

test('the dialog offers a size only where `seatChoices` has one', (t) => {
  const dialog = code('src/components/menu/VenueInfoDialog.tsx')
  t.regex(dialog, /const choices = seatChoices\(venue\)/)
  t.regex(dialog, /\{choices \? \(\s*<SeatPicker/)
  // The prize row and the button read the table as it will be sat down at.
  t.regex(dialog, /label="Winner takes" value=\{money\(table\.prize\)\}/)
  t.regex(dialog, /onClick=\{\(\) => onPlay\(table\)\}/)
})

test('every way into a ladder rung goes through playPath', (t) => {
  for (const path of [
    'src/components/menu/VenueBrowser.tsx',
    'src/components/menu/NextUpCard.tsx',
  ]) {
    t.regex(code(path), /router\.push\(playPath\(/, path)
  }
  t.regex(code('src/app/play/[venue]/PlayClient.tsx'), /sitDown\(withSeats\(venue, seats\)/)
  t.regex(
    code('src/app/play/[venue]/PlayClient.tsx'),
    /resumeTable\(withSeats\(venue, snapshot\.seats\.length\)/,
  )
})
