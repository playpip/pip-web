// Private rooms opened, a UTC week at a time, split by whether the host is a
// member. Weekly totals only: nothing about who opened them. The room server
// keeps the count (`rooms/src/tally.ts`) and shows it at `GET /rooms-opened`,
// to see whether the free room a week costs more hosting than it earns.

import { utcWeek } from './freeRoom'

export interface RoomsOpened {
  member: number
  free: number
}

/** The storage key for the week `now` falls in, named by its Monday. */
export function roomsOpenedKey(now: number): string {
  return `rooms:${utcWeek(now)}`
}

/** One more room opened this week. */
export function addRoomOpened(week: RoomsOpened | undefined, member: boolean): RoomsOpened {
  const next = { member: week?.member ?? 0, free: week?.free ?? 0 }
  if (member) next.member++
  else next.free++
  return next
}
