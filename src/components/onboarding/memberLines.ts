// What the welcome flow's Membership step says the membership adds.
//
// Three short lines on the membership's card, because the step fits one
// screen and a card says the few things most likely to matter, but each one is tied to the
// features it summarises and shows only if every one of them is for sale. The
// list was hand-typed until 2026-10-12 and missed multiplayer the day after it
// shipped: a new player choosing a plan was not told about the headline.

import { sellableFeatures } from '@/config/membership'

/** One line on the step, and the feature ids it stands for. */
interface MemberLine {
  text: string
  ids: readonly string[]
}

export const MEMBER_LINES: readonly MemberLine[] = [
  // The report leads (2026-11-02): it is the locked thing tapped most.
  { text: 'A report on your own play, and every session to review', ids: ['coaching', 'review'] },
  { text: 'Host friends and quick matches with no limits', ids: ['multiplayer'] },
  {
    text: 'Every drill, lesson and side table, Omaha included',
    ids: ['drills', 'lessons', 'side-tables', 'omaha'],
  },
]

/** The lines this build may show: every feature behind a line is sellable. */
export function memberLines(): string[] {
  const sellable = new Set(sellableFeatures().map((f) => f.id))
  return MEMBER_LINES.filter((line) => line.ids.every((id) => sellable.has(id))).map((l) => l.text)
}
