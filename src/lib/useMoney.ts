'use client'

/**
 * The chip formatter: `formatChips(1200)` → "1,200". Balances are play-money
 * chips, never a real currency — no fiat symbols anywhere (see docs/brand.md).
 * Plain function so store-built strings (hand summaries) can use it too.
 */
export function formatChips(amount: number): string {
  return Math.round(amount).toLocaleString()
}

/** Hook form for components — the one formatting seam for anything money. */
export function useMoney() {
  return formatChips
}
