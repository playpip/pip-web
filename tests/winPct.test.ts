import test from 'ava'
import { formatWinPct } from '@/lib/utils'

// The hero panel shows the chance to win on both pages: big on the odds page,
// small under the stack on the profile page. Both read it through this one
// formatter, so the two can never disagree.

test('formatWinPct rounds a share to a whole percentage', (t) => {
  t.is(formatWinPct(0.424), '42%')
  t.is(formatWinPct(0.425), '43%')
  t.is(formatWinPct(0), '0%')
  t.is(formatWinPct(1), '100%')
})

test('formatWinPct shows a dash when the odds are unknown', (t) => {
  t.is(formatWinPct(null), '—')
  t.is(formatWinPct(undefined), '—')
})
