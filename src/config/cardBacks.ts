// Card backs — a curated set of designs rather than free-form colour × pattern.
// Each is a deliberate pairing of a muted tone and a fine pattern, so every
// choice looks considered (iOS-grade restraint). The profile persists a design
// id; components look the design up with `cardBackById`.

export type CardPattern =
  | 'solid'
  | 'pinstripe'
  | 'crosshatch'
  | 'waves'
  | 'rings'
  | 'pips'
  | 'checker'
  | 'diamonds'
  | 'dots'

export interface CardBackDesign {
  id: string
  name: string
  color: string
  pattern: CardPattern
  /** Pattern + keyline ink. Light backs need dark ink. Defaults to 'light'. */
  ink?: 'light' | 'dark'
}

export const CARD_BACKS: readonly CardBackDesign[] = [
  { id: 'pip', name: 'Pip', color: '#7E89D0', pattern: 'pips' },
  { id: 'midnight', name: 'Midnight', color: '#232936', pattern: 'pinstripe' },
  { id: 'slate', name: 'Slate', color: '#5C6672', pattern: 'crosshatch' },
  { id: 'graphite', name: 'Graphite', color: '#3E434B', pattern: 'dots' },
  { id: 'ocean', name: 'Ocean', color: '#57779B', pattern: 'waves' },
  { id: 'ivy', name: 'Ivy', color: '#5F8A72', pattern: 'pinstripe' },
  { id: 'sage', name: 'Sage', color: '#7D9583', pattern: 'waves' },
  { id: 'burgundy', name: 'Burgundy', color: '#82505A', pattern: 'diamonds' },
  { id: 'rose', name: 'Dusty Rose', color: '#B08A92', pattern: 'rings' },
  { id: 'gold', name: 'Monte Carlo', color: '#B3924C', pattern: 'crosshatch' },
  { id: 'sand', name: 'Sand', color: '#C7B292', pattern: 'checker', ink: 'dark' },
  { id: 'cream', name: 'Cream', color: '#E7DFCE', pattern: 'pips', ink: 'dark' },
] as const

export const DEFAULT_CARD_BACK: CardBackDesign = CARD_BACKS[0]

const byId = new Map(CARD_BACKS.map((d) => [d.id, d]))

/** Look up a design by persisted id — unknown ids fall back to the default. */
export function cardBackById(id: string): CardBackDesign {
  return byId.get(id) ?? DEFAULT_CARD_BACK
}

/**
 * The closest curated design to an arbitrary colour (RGB distance) — used to
 * migrate profiles from the old free-form colour × pattern picker.
 */
export function nearestCardBack(color: string | undefined): CardBackDesign {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return DEFAULT_CARD_BACK
  const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
  const [r, g, b] = rgb(color)
  let best = DEFAULT_CARD_BACK
  let bestDist = Infinity
  for (const design of CARD_BACKS) {
    const [dr, dg, db] = rgb(design.color)
    const dist = (r - dr) ** 2 + (g - dg) ** 2 + (b - db) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = design
    }
  }
  return best
}
