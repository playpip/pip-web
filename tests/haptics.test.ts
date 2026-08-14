import { readFileSync } from 'node:fs'
import test from 'ava'
import { haptics, PATTERNS, type Buzz } from '@/lib/haptics'

const ALL: Buzz[] = ['deal', 'commit', 'win', 'finish', 'bust']

/**
 * A fake device. AVA runs in node with no `navigator` and no `window`, which
 * is also the exact shape of "a browser that cannot vibrate", so the default
 * state of the test environment is a useful case in its own right.
 */
function stub(name: string, value: unknown) {
  // Node exposes `globalThis.navigator` as a getter-only accessor, so a plain
  // assignment throws. defineProperty is the only way to stand a fake in front
  // of it, and the original descriptor is what puts it back.
  const before = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  return () => {
    if (before) Object.defineProperty(globalThis, name, before)
    else delete (globalThis as Record<string, unknown>)[name]
  }
}

function device(opts: { vibrate?: boolean; reducedMotion?: boolean } = {}) {
  const calls: (number | number[])[] = []
  const nav =
    opts.vibrate === false
      ? {}
      : {
          vibrate: (pattern: number | number[]) => {
            calls.push(pattern)
            return true
          },
        }
  const undoNav = stub('navigator', nav)
  const undoWin = stub('window', {
    matchMedia: (q: string) => ({ matches: !!opts.reducedMotion && q.includes('reduced-motion') }),
  })
  return {
    calls,
    restore: () => {
      undoWin()
      undoNav()
    },
  }
}

/** The debounce is real time, so a test firing twice has to step over it. */
function settle() {
  const until = Date.now() + 70
  while (Date.now() < until) {
    // Busy-wait. 70ms, once per test that needs it.
  }
}

test.serial('every cue is tens of milliseconds, not a buzz', (t) => {
  // The brief: if it is noticeable as buzzing rather than as a tap, it is
  // wrong. Nothing here should have a single pulse long enough to feel like a
  // phone ringing.
  for (const cue of ALL) {
    const pattern = PATTERNS[cue]
    const pulses = typeof pattern === 'number' ? [pattern] : pattern.filter((_, i) => i % 2 === 0)
    for (const ms of pulses) {
      t.true(ms > 0, `${cue} has a zero-length pulse`)
      t.true(ms <= 30, `${cue} pulses for ${ms}ms, which is long enough to read as a buzz`)
    }
    const total = typeof pattern === 'number' ? pattern : pattern.reduce((a, b) => a + b, 0)
    t.true(total <= 200, `${cue} runs for ${total}ms end to end`)
  }
})

test.serial('the deal is the lightest cue, because it fires every hand', (t) => {
  const deal = PATTERNS.deal as number
  const commit = PATTERNS.commit as number
  t.true(deal <= commit)
})

test.serial('nothing vibrates on a browser without the API', (t) => {
  const { calls, restore } = device({ vibrate: false })
  t.false(haptics.supported())
  for (const cue of ALL) haptics.fire(cue)
  restore()
  t.deepEqual(calls, [], 'an unsupported browser was asked to vibrate')
})

test.serial('reduced motion beats the setting, every cue', (t) => {
  // Vibration is motion. If the OS asks for less of it we do not buzz, and the
  // player's own toggle does not override the OS here.
  const { calls, restore } = device({ reducedMotion: true })
  t.true(haptics.supported())
  for (const cue of ALL) {
    haptics.fire(cue)
    settle()
  }
  restore()
  t.deepEqual(calls, [], 'reduced motion was ignored')
})

test.serial('a supported device gets the cue it asked for', (t) => {
  const { calls, restore } = device()
  haptics.fire('deal')
  restore()
  t.deepEqual(calls, [PATTERNS.deal])
})

test.serial('two cues in the same instant collapse to one', (t) => {
  // Two haptics landing together read as one longer buzz, not as two events.
  const { calls, restore } = device()
  settle()
  haptics.fire('deal')
  haptics.fire('commit')
  haptics.fire('win')
  restore()
  t.is(calls.length, 1, 'the debounce let a second cue through')
  t.deepEqual(calls[0], PATTERNS.deal)
})

test.serial('winning the tournament feels like the tournament, not like the pot', (t) => {
  // The hand that wins the tournament also wins a pot, so `win` and `finish`
  // fire microseconds apart. `navigator.vibrate` replaces the running pattern
  // rather than queueing, so the terminal cue has to get through the debounce
  // or the biggest moment in the app buzzes like an ordinary pot.
  const { calls, restore } = device()
  settle()
  haptics.fire('win')
  haptics.fire('finish')
  restore()
  t.is(calls.length, 2)
  t.deepEqual(calls[1], PATTERNS.finish, 'the finish was swallowed by the debounce')
})

test.serial('busting through the debounce works the same way', (t) => {
  const { calls, restore } = device()
  settle()
  haptics.fire('deal')
  haptics.fire('bust')
  restore()
  t.deepEqual(calls[calls.length - 1], PATTERNS.bust)
})

test.serial('a vibrate that throws does not take the hand down with it', (t) => {
  // Chrome refuses, and warns, when the document has never been tapped. A
  // throw from here would land inside a game-store state transition.
  const undoNav = stub('navigator', {
    vibrate: () => {
      throw new Error('user has not tapped the frame')
    },
  })
  const undoWin = stub('window', { matchMedia: () => ({ matches: false }) })
  settle()
  t.notThrows(() => haptics.fire('deal'))
  undoWin()
  undoNav()
})

// ---------------------------------------------------------------------------
// The call sites, pinned. The spec's guardrail is "never on the AI's actions,
// only on yours and on outcomes", and that is a property of where the calls
// are rather than of anything the module can check.

test.serial('the store only ever buzzes behind the profile flag', (t) => {
  const source = readFileSync(new URL('../src/store/game.ts', import.meta.url), 'utf-8')
  // One helper, and it is the only thing that reaches the engine.
  t.is(
    source.split('haptics.fire(').length - 1,
    1,
    'game.ts calls the engine somewhere other than the buzz() helper',
  )
  t.true(source.includes('if (useProfile.getState().haptics) haptics.fire(cue)'))
})

test.serial('the opponents never buzz', (t) => {
  // playActionSound runs for the AI too. The commit buzz must sit in the hero
  // branch, which is the one guarded by the HUMAN_ID check.
  const source = readFileSync(new URL('../src/store/game.ts', import.meta.url), 'utf-8')
  const heroBranch = source.split('if (!toAct || toAct.id !== HUMAN_ID) return')[1] ?? ''
  t.true(heroBranch.slice(0, 400).includes("buzz('commit')"), 'the commit buzz moved off the hero')
  const aiBranch = source.split('const seatAi = get().seats.find')[1]?.slice(0, 400) ?? ''
  t.false(aiBranch.includes('buzz('), 'an opponent action now buzzes the phone')
})

test.serial('the setting is off by default and survives a migration', (t) => {
  const source = readFileSync(new URL('../src/store/profile.ts', import.meta.url), 'utf-8')
  t.true(source.includes('haptics: false'), 'haptics no longer defaults off')
  t.true(source.includes('if (fromVersion < 14) s.haptics = false'))
})
