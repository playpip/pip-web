import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** A chance to win as a whole percentage, e.g. `0.424` → `"42%"`. `—` when unknown. */
export function formatWinPct(equity: number | null | undefined): string {
  return equity === null || equity === undefined ? '—' : `${Math.round(equity * 100)}%`
}
