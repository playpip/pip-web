// Chips that are out of the Roll and sitting on a table, told to the account.
//
// The bug this exists for (technology#90). The table lives in its own
// localStorage key, `pip.table`, which sync has never touched and should not:
// it holds a hand in progress, every seat's stack and the cards, and two
// devices cannot be at one table. But sitting down debits the Roll, and the
// Roll *is* synced. So device A sat down, pushed a Roll a thousand chips
// lighter, and device B pulled a Roll with nothing to show for the difference.
// The chips were not lost, exactly: they came back if you went back to A and
// finished. They were lost the moment you did not.
//
// The fix is one field on the profile saying which device is holding how much,
// and it is deliberately not the other option. Folding the table snapshot into
// the synced profile would need a merge rule for "both devices are sat down",
// and there is no answer to that which does not throw away somebody's
// tournament.
//
// **The two decisions here happen at different times, and that is the whole
// design.** Taking the chips back is the aggressive one: it ends the other
// device's table. So it happens when the player sits down somewhere else, which
// is them asking for exactly that, and never on a pull. Opening the app on a
// second device, looking at your stats and going back to the first must leave
// the first device's tournament alone, and it does.

/** Chips a device has taken out of the Roll and not yet returned. */
export interface Escrow {
  /** Which browser is holding them. Not a claim about a person or a session. */
  deviceId: string
  /**
   * How many. This is what was bought in, not what the stack is worth now: a
   * tournament chip is not a Roll chip and `cashOutValue` is the only thing
   * that converts between them.
   */
  chips: number
  /** Which table, so a device that drops one can say what it dropped. */
  venueId: string
}

/**
 * What the Roll is worth to this device right now.
 *
 * Chips held by *another* device are spendable here, because spending them is
 * what takes them back (see {@link reclaimable}). Chips held by this device are
 * not: they are on the table in the next tab, and counting them twice is how
 * you buy into two tournaments with one buy-in.
 */
export function spendableRoll(
  roll: number,
  escrow: Escrow | null | undefined,
  deviceId: string,
): number {
  return roll + reclaimable(escrow, deviceId)
}

/**
 * How many chips sitting down here would take back first, if any.
 *
 * Only ever another device's. Our own escrow is settled by finishing, busting
 * or leaving the table it is on, all of which go through the same clear.
 */
export function reclaimable(escrow: Escrow | null | undefined, deviceId: string): number {
  if (!escrow) return 0
  return escrow.deviceId === deviceId ? 0 : escrow.chips
}

/**
 * Is the table this device is holding still backed by chips?
 *
 * Read on a pull, against the profile that just arrived. False means some other
 * device has since taken the buy-in back into the Roll, which only happens
 * because the player sat down over there, so the table here is a screen with no
 * money behind it: finishing it would pay a prize out of a Roll that has
 * already been given the buy-in back.
 *
 * **A missing escrow answers true, not false**, and that asymmetry is on
 * purpose. It is what an account looks like when it was last written by a build
 * older than this field, which is every account on the day this ships and
 * includes everybody who is sat at a table right now. Reading "unclaimed" as
 * "not yours" would end their tournament on the first pull after the upgrade.
 * An unclaimed table is claimed rather than dropped ({@link claimEscrow}); the
 * cost of being wrong that way round is the bug we already have, and the cost
 * of being wrong the other way is somebody's run.
 */
export function tableIsBacked(
  escrow: Escrow | null | undefined,
  deviceId: string,
  venueId: string,
): boolean {
  if (!escrow) return true
  return escrow.deviceId === deviceId && escrow.venueId === venueId
}

/**
 * The escrow a device should be recording for the table it is sat at, or null
 * if the account already has it right.
 *
 * Two callers, one rule. A device that has just sat down states what it took;
 * a device resuming a table nobody has claimed states the same thing, which is
 * how a player who was mid-tournament when this shipped gets covered without a
 * migration that would have to read localStorage to know.
 */
export function claimEscrow(escrow: Escrow | null | undefined, next: Escrow): Escrow | null {
  if (
    escrow &&
    escrow.deviceId === next.deviceId &&
    escrow.venueId === next.venueId &&
    escrow.chips === next.chips
  ) {
    return null
  }
  return next
}
