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
