// Customizable card-back designs: a colour + a pattern. Kept as plain data so
// the preference persists cleanly and renders identically everywhere.

export type CardPattern =
  | 'solid'
  | 'hatch'
  | 'stripes'
  | 'grid'
  | 'dots'
  | 'rings'
  | 'diamonds'
  | 'plus'

export interface CardBackDesign {
  color: string
  pattern: CardPattern
}

export const CARD_PATTERNS: { id: CardPattern; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'hatch', label: 'Hatch' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'grid', label: 'Grid' },
  { id: 'dots', label: 'Dots' },
  { id: 'rings', label: 'Rings' },
  { id: 'diamonds', label: 'Diamonds' },
  { id: 'plus', label: 'Plus' },
]

// Muted, Notion-style palette — earthy and desaturated rather than neon.
export const CARD_COLORS: { id: string; value: string }[] = [
  { id: 'denim', value: '#4E6E99' },
  { id: 'sage', value: '#5B8A63' },
  { id: 'teal', value: '#3F8A8A' },
  { id: 'clay', value: '#B96D46' },
  { id: 'ochre', value: '#C39A3E' },
  { id: 'plum', value: '#8A5FA6' },
  { id: 'mauve', value: '#A85D7E' },
  { id: 'stone', value: '#6B7280' },
]

export const DEFAULT_CARD_BACK: CardBackDesign = { color: '#4E6E99', pattern: 'hatch' }
