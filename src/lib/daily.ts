// The Daily Deal — pure date → seed plumbing. One UTC day, one seed, one
// tournament: everyone who plays today gets the identical shuffle, provably
// (the engine is open and deterministic). No streaks, no history pressure —
// yesterday's daily is simply gone.

/** Daily #1 was 16 July 2026 (UTC). */
export const DAILY_EPOCH_UTC = Date.UTC(2026, 6, 16)

const DAY_MS = 86_400_000

/** The UTC day key, e.g. "2026-07-16". Pass a date for testability. */
export function dailyDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Which daily this is — #1 on the epoch day. */
export function dailyNumber(dateKey: string): number {
  const t = Date.UTC(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)) - 1,
    Number(dateKey.slice(8, 10)),
  )
  return Math.floor((t - DAILY_EPOCH_UTC) / DAY_MS) + 1
}

/** Deterministic 32-bit seed for a day key (FNV-1a over the string). */
export function dailySeed(dateKey: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Per-hand seed so a mid-tournament refresh re-deals hand N identically. */
export function handSeed(base: number, handIndex: number): number {
  return (base ^ Math.imul(handIndex + 1, 0x9e3779b9)) >>> 0
}

/** The copyable result — calm, no emoji grid, no streak brag. */
export function dailyShareText(
  dayNo: number,
  place: number | null,
  seats: number,
  hands: number,
): string {
  const finish = place === 1 ? 'won it' : place ? `${ordinal(place)} of ${seats}` : 'played'
  return `pip daily #${dayNo} · ${finish} · ${hands} ${hands === 1 ? 'hand' : 'hands'} · playpip.io`
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
