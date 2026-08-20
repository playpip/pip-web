import { readdirSync, readFileSync, statSync } from 'node:fs'
import test from 'ava'
import { COPIED_MS, createCopiedTimer, type CopiedTimers } from '@/lib/useCopied'

// A clock the test drives. Real timers would make "a second click restarts the
// window" a race with the scheduler, and that assertion is the whole point of
// the file: the bug in #20 was a flag that never came back, and the obvious
// fix (setTimeout with no clear) has a second bug in it where two quick clicks
// leave a stale timer that closes the window early.
function fakeClock() {
  let now = 0
  let nextId = 1
  const due = new Map<number, { at: number; fn: () => void }>()

  const timers: CopiedTimers = {
    set(fn, ms) {
      const id = nextId++
      due.set(id, { at: now + ms, fn })
      return id
    },
    clear(handle) {
      due.delete(handle as number)
    },
  }

  return {
    timers,
    /** Move time forward, running anything that comes due on the way. */
    advance(ms: number) {
      const target = now + ms
      // Re-read each pass: a callback is allowed to schedule another timer.
      for (;;) {
        const next = [...due.entries()]
          .filter(([, t]) => t.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        const [id, timer] = next
        due.delete(id)
        now = timer.at
        timer.fn()
      }
      now = target
    },
    get pending() {
      return due.size
    },
  }
}

test('the flag goes up on copy and comes back down on its own', (t) => {
  const clock = fakeClock()
  const seen: boolean[] = []
  const timer = createCopiedTimer((v) => seen.push(v), COPIED_MS, clock.timers)

  timer.fire()
  t.deepEqual(seen, [true])

  clock.advance(COPIED_MS - 1)
  t.deepEqual(seen, [true], 'still confirming a millisecond before the window ends')

  clock.advance(1)
  t.deepEqual(seen, [true, false], 'and back to the resting label')
})

test('a second copy restarts the window rather than stacking a stale timer', (t) => {
  const clock = fakeClock()
  const seen: boolean[] = []
  const timer = createCopiedTimer((v) => seen.push(v), COPIED_MS, clock.timers)

  timer.fire()
  clock.advance(COPIED_MS - 100)
  timer.fire()
  t.is(clock.pending, 1, 'the first timer was cleared, not left to fire early')

  // The moment the first window would have closed. Without the clear, this is
  // where the label snaps back while the second confirmation is still young.
  clock.advance(100)
  t.deepEqual(seen, [true, true], 'still showing the second confirmation')

  clock.advance(COPIED_MS - 100)
  t.deepEqual(seen, [true, true, false], 'which then closes a full window after the second click')
})

test('cancelling drops the pending reset, so unmounting cannot set state later', (t) => {
  const clock = fakeClock()
  const seen: boolean[] = []
  const timer = createCopiedTimer((v) => seen.push(v), COPIED_MS, clock.timers)

  timer.fire()
  timer.cancel()
  t.is(clock.pending, 0)

  clock.advance(COPIED_MS * 10)
  t.deepEqual(seen, [true], 'nothing fired after the cancel')
})

test('cancelling twice, or before anything was copied, is harmless', (t) => {
  const clock = fakeClock()
  const timer = createCopiedTimer(() => {}, COPIED_MS, clock.timers)

  t.notThrows(() => timer.cancel())
  timer.fire()
  timer.cancel()
  t.notThrows(() => timer.cancel())
  t.is(clock.pending, 0)
})

test('the confirmation window is short enough to read as temporary', (t) => {
  // A guard on the number rather than the mechanism. Much past a couple of
  // seconds and the button reads as stuck again, which is the bug this fixes.
  t.true(COPIED_MS >= 1000, 'long enough to notice')
  t.true(COPIED_MS <= 3000, 'short enough not to read as a disabled button')
})

// ---------------------------------------------------------------------------

const SRC = new URL('../src/', import.meta.url)

function sourceFiles(dir: URL): URL[] {
  return readdirSync(dir).flatMap((name) => {
    const entry = new URL(name, dir)
    if (statSync(entry).isDirectory()) return sourceFiles(new URL(`${name}/`, dir))
    return /\.tsx?$/.test(name) ? [entry] : []
  })
}

test('no component keeps its own copied flag, so the bug cannot come back', (t) => {
  // #20 was reported against one button and was live in three places, because
  // `useState(false)` plus `setCopied(true)` is four keystrokes and the missing
  // reset is invisible until someone waits. The hook is the only way to hold
  // this flag now, and a fourth copy button gets the timing for free.
  const offenders: string[] = []
  for (const file of sourceFiles(SRC)) {
    const where = file.pathname.split('/src/')[1]
    if (where === 'lib/useCopied.ts') continue
    const source = readFileSync(file, 'utf-8')
    if (/\bsetCopied\b/.test(source)) offenders.push(`${where}: rolls its own copied flag`)
  }
  t.deepEqual(
    offenders,
    [],
    `use useCopied() from @/lib/useCopied instead:\n${offenders.join('\n')}`,
  )
})
