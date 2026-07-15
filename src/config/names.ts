// Name pool for AI opponents, matching the friendly first-name style in the
// Offsuit screenshots.

export const AI_NAMES = [
  'Sarah',
  'Eli',
  'Simon',
  'Akash',
  'Anna',
  'Mia',
  'Leo',
  'Nadia',
  'Kai',
  'Priya',
  'Marco',
  'Zoe',
  'Omar',
  'Ivy',
  'Dario',
  'Nina',
  'Theo',
  'Lena',
  'Ravi',
  'Cleo',
  'Hugo',
  'Yara',
  'Finn',
  'Rosa',
] as const

/** Pick `count` distinct names, shuffled. */
export function pickNames(count: number): string[] {
  const pool = [...AI_NAMES]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}
