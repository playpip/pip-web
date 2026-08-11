// The text size setting, as pure data.
//
// WCAG 1.4.4 (Resize Text, AA) asks that text reach 200% without loss of
// content or functionality. It does not ask for pinch-zoom specifically, which
// matters here: pinch-zoom is deliberately off (technology#6) because it buys
// the native feel in the installed app, and a gesture that leaves you panned
// halfway off a poker table mid-hand is a worse answer than a setting anyway.
//
// The scale is a percentage applied to the root font size, so it multiplies the
// browser's own default rather than replacing it. Someone who has already set
// their browser to 20px keeps that as their 100%.

/** The four steps. 200 is the one WCAG 1.4.4 actually requires. */
export const TEXT_SCALES = [100, 125, 150, 200] as const

export type TextScale = (typeof TEXT_SCALES)[number]

export const DEFAULT_TEXT_SCALE: TextScale = 100

/** localStorage key. Namespaced like `pip.profile`; `theme` predates the convention. */
export const TEXT_SCALE_KEY = 'pip.textScale'

/** A stored value, or anything else, resolved to a scale we actually support. */
export function parseTextScale(raw: string | null | undefined): TextScale {
  const n = Number(raw)
  return (TEXT_SCALES as readonly number[]).includes(n) ? (n as TextScale) : DEFAULT_TEXT_SCALE
}

/**
 * What to put on `html { font-size }`.
 *
 * A percentage, never a px value: px would silently override the reader's own
 * browser font size, which is the setting people with low vision reach for
 * first. This one multiplies it.
 */
export function rootFontSize(scale: TextScale): string {
  return `${scale}%`
}

/** The Settings label for a step. */
export function textScaleLabel(scale: TextScale): string {
  return `${scale}%`
}
