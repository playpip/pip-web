import test from 'ava'
import { MEMBERSHIP_FEATURES } from '@/config/membership'
import { MEMBER_LINES, memberLines } from '@/components/onboarding/memberLines'

// The welcome flow's Membership step summarises the membership in a few short
// lines. Each line names the features it stands for, so a renamed feature
// fails here instead of the line quietly dropping off the step.

test('every line names features that exist', (t) => {
  const ids = new Set(MEMBERSHIP_FEATURES.map((f) => f.id))
  for (const line of MEMBER_LINES) {
    t.true(line.ids.length > 0, `"${line.text}" stands for nothing`)
    for (const id of line.ids) t.true(ids.has(id), `"${line.text}" names unknown feature ${id}`)
  }
})

test('the report leads, and the friends line shows exactly when the build sells it', (t) => {
  const rooms = Boolean(process.env.NEXT_PUBLIC_ROOMS_URL)
  const lines = memberLines()
  t.regex(lines[0], /report/)
  t.is(lines.includes('Host friends and quick matches with no limits'), rooms)
  t.is(lines.length, MEMBER_LINES.length - (rooms ? 0 : 1), 'only multiplayer depends on the build')
})
