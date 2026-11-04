// Free against the membership, row by row, for `/membership`.
//
// Here rather than in config/membership.ts because the counts come from the
// configs that themselves import that file (drills, lessons), and a cycle
// between them would hand one side an undefined list at load. Every number is
// counted from the thing it describes, and a row tied to a feature shows only
// when that feature is for sale in this build, the same rule as the page.

import { DRILL_KINDS } from '@/config/drills'
import { COURSE } from '@/config/lessons'
import { sellableFeatures } from '@/config/membership'
import { FREE_REPORT_COPY } from '@/lib/membership/freeReport'
import { FREE_SLOW_GAMES } from '@/lib/multiplayer/freeRoom'
import { FREE_ROOM_SEATS, MAX_ROOM_SEATS } from '@/lib/multiplayer/room'

/** One row: what it is, what a free player gets, what a member gets. `true` is a plain yes. */
export interface CompareRow {
  thing: string
  free: string | boolean
  member: string | boolean
  /** The features the row stands for. Shown only if every one of them is sellable. */
  ids: readonly string[]
}

const WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']
const say = (n: number) => WORDS[n] ?? String(n)

/** The rows, in the order the page shows them. */
export function comparisonRows(): CompareRow[] {
  const drills = DRILL_KINDS.length
  const freeDrills = DRILL_KINDS.filter((k) => !k.membersOnly).length
  const levels = COURSE.length
  const rows: CompareRow[] = [
    {
      thing: 'The ladder, the Rail, the Daily and the freeroll',
      free: true,
      member: true,
      ids: [],
    },
    { thing: 'The read on every hand', free: true, member: true, ids: [] },
    {
      thing: 'Your report',
      free: FREE_REPORT_COPY.short,
      member: 'Whenever you like',
      ids: ['coaching'],
    },
    { thing: 'Session review', free: false, member: 'Every session', ids: ['review'] },
    {
      thing: 'Drills',
      free: `${freeDrills} of ${drills}`,
      member: `All ${drills}`,
      ids: ['drills'],
    },
    {
      thing: 'Lessons with Webb',
      free: 'Level 1',
      member: `All ${levels} levels`,
      ids: ['lessons'],
    },
    { thing: 'Host a private room', free: 'One a day', member: 'No limit', ids: ['multiplayer'] },
    {
      thing: 'Seats in a room you host',
      free: `Up to ${say(FREE_ROOM_SEATS).toLowerCase()}`,
      member: `Up to ${say(MAX_ROOM_SEATS).toLowerCase()}`,
      ids: ['multiplayer'],
    },
    { thing: 'Camera and voice', free: false, member: true, ids: ['multiplayer'] },
    { thing: 'Quick match', free: 'One a day', member: 'No limit', ids: ['multiplayer'] },
    {
      thing: 'Host a slow game',
      free: `${say(FREE_SLOW_GAMES)} at a time`,
      member: 'No limit',
      ids: ['multiplayer'],
    },
    {
      thing: 'Side tables and the other games',
      free: 'One game a day',
      member: 'Every table',
      ids: ['side-tables', 'omaha'],
    },
    {
      thing: 'Quick games',
      free: 'One round of each a day',
      member: 'No limit',
      ids: ['quick-games'],
    },
    { thing: 'Daily reward', free: true, member: 'Double', ids: ['daily-reward'] },
  ]
  const sellable = new Set(sellableFeatures().map((f) => f.id))
  return rows.filter((row) => row.ids.every((id) => sellable.has(id)))
}
