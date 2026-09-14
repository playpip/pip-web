'use client'

import { deviceId } from '@/lib/sync/client'
import { freerollOnOffer } from '@/lib/sitDown'
import { spendableRoll } from '@/lib/sync/escrow'
import { useHydrated } from '@/lib/useHydrated'
import { useProfile } from '@/store/profile'

/**
 * The Roll as an affordability check should read it: `roll` plus any buy-in
 * another device is still holding, because sitting down here takes those chips
 * back first (lib/sync/escrow, technology#90). Without this a player with a
 * table open on their laptop sees the phone's lobby lock every rung the missing
 * buy-in would have covered.
 *
 * **Only for gates that go through `sitDown`.** That is the one path that
 * reclaims. Anything else spending the Roll (the shop, a rebuy at a table
 * already open here) must read `roll`, or it offers chips it will not fetch.
 *
 * Pre-hydration it is `roll`: `deviceId()` reads localStorage, and the server
 * pass has none.
 */
export function useSpendableRoll(): number {
  const hydrated = useHydrated()
  const roll = useProfile((s) => s.roll)
  const escrow = useProfile((s) => s.escrow)
  return hydrated ? spendableRoll(roll, escrow, deviceId()) : roll
}

/**
 * Whether to offer the freeroll, answered by the function the route uses.
 *
 * The same rule as above and for the same reason: the button opens a table, so
 * it is decided on the spendable Roll. A surface that asks
 * `freerollOpen(profile.roll)` instead offers the freeroll to a player whose
 * chips are on another device's table, and the route then refuses the sit-down
 * and drops them on the home screen with no message. `tests/sitDown.test.ts`
 * fails the build on a component importing `freerollOpen` directly.
 *
 * Pre-hydration it answers from `roll`, for the same localStorage reason.
 */
export function useFreerollOnOffer(): boolean {
  const hydrated = useHydrated()
  const roll = useProfile((s) => s.roll)
  const escrow = useProfile((s) => s.escrow)
  return freerollOnOffer({ roll, escrow: hydrated ? escrow : null }, hydrated ? deviceId() : '')
}
