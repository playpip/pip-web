// The placeholder name a player has until they choose one. Players normally
// choose one in the welcome flow; a placeholder player is only made for a
// scanned transfer QR (onboarding/firstSeat). Two places read the name as a
// placeholder: the lobby, which offers to change it, and the sync merge, which
// never lets it overwrite a name somebody actually chose on another device.
//
// Pure, no store or browser imports, so the sync merge can use it and the
// tests can read it.

/** The name a player has until they choose one. */
export const DEFAULT_PLAYER_NAME = 'Player'

/** Has this player still got the name they were given rather than one they chose? */
export function hasPlaceholderName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed === '' || trimmed === DEFAULT_PLAYER_NAME
}

// The name the welcome flow fills in (2026-11-04). In the week to 1 November
// 167 tabs opened "Make your player" and 113 made one: an empty name box held
// the only button shut. Now the step arrives with a face and one of these, so
// one tap carries on, and both can be changed there or later. Two words that
// read as a nickname, so nobody mistakes a newcomer for one of the regulars,
// who all have first names (config/cast).
const NAME_FIRST = [
  'Lucky',
  'Quiet',
  'Steady',
  'Bold',
  'Sunny',
  'Clever',
  'Calm',
  'Brave',
  'Sly',
  'Merry',
  'Swift',
  'Patient',
] as const
const NAME_SECOND = [
  'Otter',
  'Heron',
  'Fox',
  'Badger',
  'Owl',
  'Hare',
  'Robin',
  'Moth',
  'Wren',
  'Toad',
  'Seal',
  'Lynx',
] as const

/** Every name `suggestName` can give, for the tests. */
export const SUGGESTED_NAMES: readonly string[] = NAME_FIRST.flatMap((a) =>
  NAME_SECOND.map((b) => `${a} ${b}`),
)

/** A name to start with, chosen at random. `random` is there for the tests. */
export function suggestName(random: () => number = Math.random): string {
  return SUGGESTED_NAMES[Math.floor(random() * SUGGESTED_NAMES.length)] ?? SUGGESTED_NAMES[0]
}
