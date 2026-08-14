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

// ---------------------------------------------------------------------------
// The table cap
//
// Will played a hand at 200% on his phone and the table does not hold: "150% is
// just about playable but not 200%" (technology#57). The felt is the one screen
// in the app that cannot reflow. Nine seats, a board, a pot and an action row
// all have to be visible at once and in their fixed spatial relationship, so
// type that doubles has nowhere to push the layout except off the screen.
//
// So the table stops at 150% and the rest of the app still reaches 200%. The
// alternative was to drop the 200% step altogether, which would take the WCAG
// 1.4.4 answer away from every reading surface in the app to fix one screen.
// A setting a player can pick that then breaks the main surface is worse than
// no setting at all, and capping it where it stops working is the narrower fix.
//
// The cap lives at the root, not on a container, because rem is measured
// against the root font size and the table's own dialogs render in a portal on
// <body>, outside any wrapper the table could set.

/** The table's ceiling. Above this the seats and the board stop fitting on a phone. */
export const TABLE_MAX_TEXT_SCALE = 150 satisfies TextScale

/** Route prefix for the felt. The lobby, Learn and the rest are not capped. */
export const TABLE_ROUTE_PREFIX = '/play/'

/** Is this path the table itself? `/play/kitchen`, with or without a trailing slash. */
export function isTableRoute(pathname: string | null | undefined): boolean {
  return typeof pathname === 'string' && pathname.startsWith(TABLE_ROUTE_PREFIX)
}

/**
 * The scale to actually apply, given where the reader is standing.
 *
 * Everywhere but the table this is the setting untouched. On the table it is
 * the setting or 150%, whichever is smaller. The choice is remembered at full
 * size, so walking off the table restores it.
 */
export function effectiveTextScale(
  scale: TextScale,
  pathname: string | null | undefined,
): TextScale {
  return isTableRoute(pathname) && scale > TABLE_MAX_TEXT_SCALE ? TABLE_MAX_TEXT_SCALE : scale
}
