// Deleting an account also clears what the room server keeps for it: the
// devices it may push to, its notification switches and quiet hours, and its
// slow games list (`rooms/src/player.ts`). /privacy promises that once an
// account is gone we keep nothing.
//
// The room server checks the session with Supabase, so it has to be asked
// while the account still exists: before the delete. If the delete then fails,
// the switches the player chose go back, so a failed delete never turns a
// notification they had switched off back on. Devices register again by
// themselves on the next visit (`refreshPush`).

export interface DeleteAccountSteps<Kept> {
  /** What the room server holds now, or null when it could not be read. */
  readNotify: () => Promise<Kept | null>
  /** Ask the room server to forget the account. True when it did. */
  forgetNotify: () => Promise<boolean>
  /** Delete the account itself. True when it is gone. */
  deleteAccount: () => Promise<boolean>
  /** Put back what `readNotify` returned. */
  restoreNotify: (kept: Kept) => Promise<unknown>
}

/** Forget on the room server, then delete; put the switches back if the delete fails. */
export async function deleteWithNotify<Kept>(steps: DeleteAccountSteps<Kept>): Promise<boolean> {
  const kept = await steps.readNotify()
  const forgot = await steps.forgetNotify()
  const deleted = await steps.deleteAccount()
  if (!deleted && forgot && kept !== null) await steps.restoreNotify(kept)
  return deleted
}
