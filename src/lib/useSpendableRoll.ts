'use client'

import { deviceId } from '@/lib/sync/client'
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
