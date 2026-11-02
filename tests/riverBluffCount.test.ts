// The counts /blog/calling-a-river-bet prints, recounted from the pack's own
// deals. About twenty seconds: it deals every seed the post names.

import test from 'ava'
import { ASKED, BY_BET, DECISIONS, HANDS, SHUFFLES } from '@/config/riverBluffs'
import { riverBluffCount } from '@/lib/drills/riverBluffCount'

test('the post’s river counts are the pack’s', (t) => {
  const counted = riverBluffCount(SHUFFLES)
  t.is(counted.hands, HANDS)
  t.is(counted.asked, ASKED)
  t.deepEqual(counted.decisions, { ...DECISIONS })
  t.deepEqual(
    counted.rows.map(({ label, call, fold, depends }) => ({ label, call, fold, depends })),
    BY_BET.map((row) => ({ ...row })),
  )
})

test('every bet is counted once a hand, on one side', (t) => {
  const counted = riverBluffCount(500)
  for (const row of counted.rows) {
    t.is(row.call + row.fold + row.depends, counted.hands, row.label)
  }
})
