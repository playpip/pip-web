import test from 'ava'
import { FIRST_CHECKS, LATE_CHECKS, pollRow } from '@/lib/membership/pollRow'

// A fake clock: sleeping only records how long it would have waited.
function clock() {
  const slept: number[] = []
  return { slept, sleep: async (ms: number) => void slept.push(ms) }
}

test('a row that lands on the third check ends the wait there', async (t) => {
  const { slept, sleep } = clock()
  let checks = 0
  const ok = await pollRow(
    async () => ++checks === 3,
    FIRST_CHECKS,
    () => true,
    sleep,
  )
  t.true(ok)
  t.is(checks, 3)
  t.deepEqual(slept, [1000, 1500])
})

test('no row: every check is made, and the answer is no', async (t) => {
  const { slept, sleep } = clock()
  let checks = 0
  t.false(
    await pollRow(
      async () => {
        checks++
        return false
      },
      FIRST_CHECKS,
      () => true,
      sleep,
    ),
  )
  t.is(checks, FIRST_CHECKS.length)
  t.is(
    slept.reduce((a, b) => a + b, 0),
    15_500,
  )
})

test('leaving the page stops the asking', async (t) => {
  const { sleep } = clock()
  let checks = 0
  let here = true
  const ok = await pollRow(
    async () => {
      if (++checks === 2) here = false
      return false
    },
    LATE_CHECKS,
    () => here,
    sleep,
  )
  t.false(ok)
  t.is(checks, 2)
})

// A webhook slower than the first ~15 seconds used to leave the page saying
// "reload". The late checks cover two more minutes.
test('after the first checks, the page keeps asking for two more minutes', (t) => {
  t.is(
    LATE_CHECKS.reduce((a, b) => a + b, 0),
    120_000,
  )
  t.true(
    LATE_CHECKS.every((ms) => ms >= 5000),
    'not hammering the database',
  )
})
