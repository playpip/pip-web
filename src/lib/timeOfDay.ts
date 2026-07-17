// Time-of-day awareness — the app noticing you, the way a bartender does.
// Two or three touches total, never a mechanic: nothing is time-gated, nothing
// rewards showing up at an hour. Pure functions of the local hour so the copy
// is testable; callers read the clock (presentation layer only).

export type DayPeriod = 'late' | 'morning' | 'afternoon' | 'evening'

/** Which stretch of the day this hour belongs to (drives copy + icon). */
export function periodFor(hour: number): DayPeriod {
  if (hour < 5) return 'late'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

const GREETINGS: Record<DayPeriod, string> = {
  late: 'Late one',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

/** The quiet greeting above the Roll. Composed as `${greeting}, ${name}.` */
export function greetingFor(hour: number): string {
  return GREETINGS[periodFor(hour)]
}

/** The Ladder's broke-player hint — the Kitchen Table keeps odd hours too. */
export function kitchenHintFor(hour: number): string {
  if (hour < 5) return "Broke? The Kitchen Table's open all night."
  return 'Broke? Win your way back at the Kitchen Table.'
}
