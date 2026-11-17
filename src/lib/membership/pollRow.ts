// How long to keep asking for a membership row after a payment. Pure, so the
// schedule is tested without a store, a clock or Supabase.

/** Back from Checkout: Stripe's redirect usually beats its webhook by seconds. */
export const FIRST_CHECKS: readonly number[] = [0, 1000, 1500, 2000, 3000, 4000, 4000]

/**
 * After those ~15 seconds the page says it is still confirming, and keeps
 * asking every 10 seconds for two more minutes. A webhook that slow still
 * lands, and the player should not have to reload to see it.
 */
export const LATE_CHECKS: readonly number[] = Array.from({ length: 12 }, () => 10_000)

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Wait each step in `waits`, then `check()`; true as soon as one says yes.
 * Stops early, false, once `wanted()` turns false (the page was left).
 */
export async function pollRow(
  check: () => Promise<boolean>,
  waits: readonly number[],
  wanted: () => boolean = () => true,
  sleep: (ms: number) => Promise<void> = wait,
): Promise<boolean> {
  for (const ms of waits) {
    if (ms) await sleep(ms)
    if (!wanted()) return false
    if (await check()) return true
  }
  return false
}
