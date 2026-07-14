'use client'

/**
 * Returns the chip formatter: `money(1200)` → "1,200". Balances are play-money
 * chips, never a real currency — no fiat symbols anywhere (see docs/brand.md).
 */
export function useMoney() {
  return (amount: number) => Math.round(amount).toLocaleString()
}
