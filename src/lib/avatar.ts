// notionists avatars via DiceBear, rendered locally to SVG (no network, works
// offline). We persist a small spec (seed + a couple of options), never an image.

import { createAvatar } from '@dicebear/core'
import { notionists } from '@dicebear/collection'

export interface AvatarSpec {
  seed: string
  /** Background swatch behind the character. */
  backgroundColor: string
}

export const AVATAR_BG_SWATCHES = [
  'b6e3f4', // sky
  'c0aede', // lilac
  'd1f4d0', // mint
  'ffd5dc', // blush
  'ffdfbf', // peach
  'f4e7b6', // sand
] as const

/** Render an AvatarSpec to an SVG string (for dangerouslySetInnerHTML or data URI). */
export function renderAvatar(spec: AvatarSpec, size = 96): string {
  return createAvatar(notionists, {
    seed: spec.seed,
    size,
    backgroundColor: [spec.backgroundColor],
    radius: 50,
  }).toString()
}

/** Render to a data URI usable as an <img src>. */
export function avatarDataUri(spec: AvatarSpec, size = 96): string {
  const svg = renderAvatar(spec, size)
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * A vivid, darker accent derived from the player's avatar swatch — the same
 * hue, pushed to a mid lightness and lifted saturation so it reads on both the
 * light and dark themes. Used to tint the stats charts in the player's own
 * colour instead of the brand periwinkle. Falls back to the pip accent for a
 * malformed swatch.
 */
export function accentFromSwatch(swatch: string): string {
  const hex = swatch.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#7c8cf0' // --color-pip
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l0 = (max + min) / 2
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l0 - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
  }

  // Darker, hue preserved. Saturation is floored so pale swatches don't read
  // drab, and capped so near-white ones (blush, peach) don't snap to neon.
  const L = 0.55
  const S = Math.min(0.72, Math.max(s, 0.45))
  const c = (1 - Math.abs(2 * L - 1)) * S
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = L - c / 2
  const [rr, gg, bb] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(rr)}${to(gg)}${to(bb)}`
}

/** A fresh random seed string for the avatar creator's shuffle. */
export function freshSeed(): string {
  return `pip-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}
