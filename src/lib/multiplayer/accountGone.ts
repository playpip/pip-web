// Whether the account behind a player's notices still exists.
//
// Deleting from Settings empties the player's index on the room server first
// (`POST /notify/forget`). Deleting by email request (Will, by hand in
// Supabase) cannot: nothing tells the room server, so the devices, switches
// and quiet hours stayed, and a slow game could still push to the phone of
// somebody whose account was gone. `/privacy` says we keep nothing.
//
// So whenever the player's index wakes, at most once a day, it asks Supabase
// whether the account is still there, and forgets everything if it is not.
// Only a definite "no such user" counts: an outage, a bad key or anything
// else unexpected reads as still there, because forgetting a live player
// loses their phones and settings.

/** How often a waking index asks. */
export const ACCOUNT_CHECK_EVERY_MS = 24 * 60 * 60 * 1000

/** Whether it is time to ask again. Never asked counts as due. */
export function accountCheckDue(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= ACCOUNT_CHECK_EVERY_MS
}

/**
 * Whether Supabase's admin "get user" answer says the account does not exist:
 * a 404 whose body names `user_not_found`. Anything else is not proof.
 */
export function accountIsGone(status: number, body: unknown): boolean {
  if (status !== 404 || typeof body !== 'object' || body === null) return false
  return (body as { error_code?: unknown }).error_code === 'user_not_found'
}
