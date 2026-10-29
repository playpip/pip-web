import test from 'ava'

// Tonight's form (config/cast `Form`): one draw per seating that scales each
// character's own delta, 0.4 / 1 / 1.6 at 25 / 50 / 25. Pinned here: `usual`
// is the profile every caller had before forms existed, a form never turns a
// nudge around or touches the difficulty, every rung's regulars still average
// what they did, and the Daily, the welcome table and a challenge seat the
// forms they promise.

// Install storage before importing the stores, as in ladderSeats.test.ts.
const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  },
})

const { useGame } = await import('@/store/game')
const { useProfile } = await import('@/store/profile')
const {
  CAST,
  FORM_SCALE,
  FORM_WEIGHTS,
  characterById,
  formFor,
  homeRungFor,
  profileFor,
  rosterFor,
} = await import('@/config/cast')
const { DEFAULT_CUSTOM, customVenue } = await import('@/config/customTable')
const { ALL_VENUES, CHALLENGE_TABLES, VENUES, WELCOME_TABLE, dailyFor, venueById } = await import(
  '@/config/venues'
)
const { dailyAiRng, dailyDateKey, dailyFormRng, dailySeed, handSeed } = await import('@/lib/daily')
const { mulberry32 } = await import('@/lib/poker/cards')

type Form = keyof typeof FORM_SCALE
type Dial = 'tightness' | 'aggression' | 'bluff'

const FORMS = Object.keys(FORM_SCALE) as Form[]
const DIALS: readonly Dial[] = ['tightness', 'aggression', 'bluff']
const HERO = { name: 'Hero', avatar: { seed: 'hero', backgroundColor: 'b6e3f4' }, member: false }

// A built table with an invited guest, so the home-rung path is covered too.
const BUILT = customVenue({ ...DEFAULT_CUSTOM, seats: 3, castIds: ['celeste', 'frank'] })
const TABLES = [...ALL_VENUES, BUILT]

/** The formula before forms, written out so `usual` is held to it. */
function before(venue: (typeof TABLES)[number], ch: (typeof CAST)[number]) {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
  const home = homeRungFor(ch).ai
  const invited = venue.guests?.includes(ch.id) && (home.skill ?? 1) > (venue.ai.skill ?? 1)
  const base = invited ? home : venue.ai
  return {
    ...base,
    tightness: clamp01(base.tightness + (ch.delta?.tightness ?? 0)),
    aggression: clamp01(base.aggression + (ch.delta?.aggression ?? 0)),
    bluff: clamp01(base.bluff + (ch.delta?.bluff ?? 0)),
    habit: ch.habit,
  }
}

test('the forms average to exactly the delta as written', (t) => {
  const weights = FORMS.reduce((sum, f) => sum + FORM_WEIGHTS[f], 0)
  const scale = FORMS.reduce((sum, f) => sum + FORM_WEIGHTS[f] * FORM_SCALE[f], 0)
  t.is(weights, 1)
  t.is(scale, 1)
  t.is(FORM_SCALE.usual, 1)
})

test('usual, and no form at all, is the profile every caller had before', (t) => {
  for (const venue of TABLES) {
    for (const ch of CAST) {
      const old = before(venue, ch)
      t.deepEqual(profileFor(venue, ch), old, `${venue.id} × ${ch.id}`)
      t.deepEqual(profileFor(venue, ch, 'usual'), old, `${venue.id} × ${ch.id}`)
    }
  }
})

test('a form changes how much, never which way, and never the difficulty', (t) => {
  for (const venue of TABLES) {
    for (const ch of CAST) {
      const plain = profileFor(venue, { ...ch, delta: undefined })
      const usual = profileFor(venue, ch)
      for (const form of FORMS) {
        const p = profileFor(venue, ch, form)
        const at = `${venue.id} × ${ch.id} (${form})`
        for (const dial of DIALS) {
          const lean = Math.sign(p[dial] - plain[dial])
          // Zero only where the clamp ate the whole nudge.
          t.true(lean === Math.sign(ch.delta?.[dial] ?? 0) || lean === 0, `${at}: ${dial}`)
          t.true(p[dial] >= 0 && p[dial] <= 1, `${at}: ${dial}`)
        }
        t.is(p.skill, usual.skill, at)
        t.is(p.iterations, usual.iterations, at)
        t.is(p.habit, usual.habit, at)
        // No delta, no form.
        if (!ch.delta) t.deepEqual(p, usual, at)
      }
    }
  }
})

test('every rung’s regulars average the profile they always did, clamping included', (t) => {
  for (const venue of TABLES) {
    const roster = rosterFor(venue)
    for (const dial of DIALS) {
      const usual = roster.reduce((sum, ch) => sum + profileFor(venue, ch)[dial], 0) / roster.length
      const tonight =
        roster.reduce(
          (sum, ch) =>
            sum + FORMS.reduce((s, f) => s + FORM_WEIGHTS[f] * profileFor(venue, ch, f)[dial], 0),
          0,
        ) / roster.length
      t.true(Math.abs(tonight - usual) < 0.01, `${venue.id}: ${dial} ${tonight} vs ${usual}`)
    }
  }
})

test('a quiet Frank still bluffs more than the room, a loud one more still', (t) => {
  const frank = characterById('frank')!
  for (const room of VENUES.filter((v) => rosterFor(v).includes(frank))) {
    const [quiet, usual, loud] = (['quiet', 'usual', 'loud'] as const).map(
      (f) => profileFor(room, frank, f).bluff,
    )
    t.true(room.ai.bluff < quiet && quiet < usual && usual < loud, room.id)
    // The lesson's "still checks most of his air" holds on his loudest night.
    t.true(loud < 0.5, room.id)
  }
})

test('formFor is reproducible and draws 25 / 50 / 25', (t) => {
  const rngA = mulberry32(7)
  const rngB = mulberry32(7)
  t.deepEqual(
    Array.from({ length: 50 }, () => formFor(rngA)),
    Array.from({ length: 50 }, () => formFor(rngB)),
  )
  const rng = mulberry32(11)
  const n = 10_000
  const seen: Record<Form, number> = { quiet: 0, usual: 0, loud: 0 }
  for (let i = 0; i < n; i++) seen[formFor(rng)]++
  for (const form of FORMS) t.true(Math.abs(seen[form] / n - FORM_WEIGHTS[form]) < 0.02, form)
})

// --- the Daily's stream -------------------------------------------------------

test('the Daily’s forms are the same all day and differ between days', (t) => {
  const draws = (day: string) => {
    const rng = dailyFormRng(dailySeed(day))
    return Array.from({ length: 12 }, () => formFor(rng))
  }
  t.deepEqual(draws('2026-10-27'), draws('2026-10-27'))
  t.notDeepEqual(draws('2026-10-27'), draws('2026-10-28'))
})

test('the form stream is neither the deck’s nor the AI’s', (t) => {
  const base = dailySeed('2026-07-16')
  const forms = dailyFormRng(base)()
  t.not(forms, mulberry32(base ^ 0x9e3779b9)(), 'the seating draw')
  t.not(forms, mulberry32(handSeed(base, 0))(), 'the first deal')
  t.not(forms, dailyAiRng(base, 0)(), 'the first hand’s AI')
})

// --- the store ------------------------------------------------------------------
// Math.random is pinned to a seeded stream rather than a constant: the odds
// panel's card sampler (lib/poker/equity) redraws until it finds an unused
// card, which a constant never does, and a heads-up hero acts first.

type SitVenue = Parameters<ReturnType<typeof useGame.getState>['sitDown']>[0]

/** Sit down on one seeded stream, and hand back the opponents and the opener. */
function seat(venue: SitVenue, seed: number) {
  const random = Math.random
  Math.random = mulberry32(seed)
  try {
    useGame.getState().sitDown(venue, HERO)
    const { seats, talk } = useGame.getState()
    return { opponents: seats.filter((s) => !s.isHuman), talk }
  } finally {
    Math.random = random
    useGame.getState().leave()
  }
}

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1)
const FRANK_ALONE = customVenue({ ...DEFAULT_CUSTOM, seats: 2, castIds: ['frank'] })

test.serial('a table draws its forms and plays them', (t) => {
  const pub = venueById('pub')!
  const seen = new Set<string>()
  for (const seed of SEEDS) {
    for (const s of seat(pub, seed).opponents) {
      const ch = characterById(s.characterId!)!
      t.deepEqual(s.ai, profileFor(pub, ch, s.form), `${seed}: ${ch.id}`)
      seen.add(s.form ?? 'none')
    }
  }
  t.deepEqual([...seen].sort(), ['loud', 'quiet', 'usual'])
})

test.serial('the welcome table and a challenge play everybody as written', (t) => {
  // The same streams draw every form at a heads-up table that is neither.
  const control = new Set(SEEDS.map((seed) => seat(FRANK_ALONE, seed).opponents[0].form))
  t.deepEqual([...control].sort(), ['loud', 'quiet', 'usual'])
  for (const venue of [WELCOME_TABLE, CHALLENGE_TABLES[0]]) {
    for (const seed of SEEDS) {
      const { opponents } = seat(venue, seed)
      t.is(opponents.length, 1, venue.id)
      for (const s of opponents) {
        t.is(s.form, 'usual', `${venue.id}: ${seed}`)
        t.deepEqual(s.ai, profileFor(venue, characterById(s.characterId!)!), venue.id)
      }
    }
  }
})

test.serial('everyone at today’s Daily meets the same forms, off the day’s seed', (t) => {
  const daily = dailyFor(0)
  const first = seat(daily, 1).opponents
  const again = seat(daily, 2).opponents
  t.deepEqual(
    again.map((s) => [s.characterId, s.form, s.ai]),
    first.map((s) => [s.characterId, s.form, s.ai]),
  )
  const rng = dailyFormRng(dailySeed(dailyDateKey()))
  t.deepEqual(
    first.map((s) => s.form),
    first.map(() => formFor(rng)),
  )
})

test.serial('Frank opens a quiet or a loud night with its own line', (t) => {
  const frank = characterById('frank')!
  const tableTalk = useProfile.getState().tableTalk
  const heard = new Set<string>()
  try {
    useProfile.getState().setTableTalk(true)
    for (const seed of SEEDS) {
      const { opponents, talk } = seat(FRANK_ALONE, seed)
      if (!talk) continue
      const form = opponents[0].form ?? 'usual'
      const lines = form === 'usual' ? frank.lines.seat : frank.lines[form]
      t.true(lines?.includes(talk), `${seed}: “${talk}” on a ${form} night`)
      heard.add(form)
    }
  } finally {
    useProfile.getState().setTableTalk(tableTalk)
  }
  t.deepEqual([...heard].sort(), ['loud', 'quiet', 'usual'])
})
