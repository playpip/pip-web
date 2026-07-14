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

/** A fresh random seed string for the avatar creator's shuffle. */
export function freshSeed(): string {
  return `pip-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

let counter = 0
/**
 * A pseudo-random avatar spec. Deterministic-ish per call via an incrementing
 * counter + provided entropy, so opponents get varied looks without pulling in
 * Math.random at module scope.
 */
export function randomAvatar(entropy: string | number = ''): AvatarSpec {
  counter += 1
  const seed = `pip-${entropy}-${counter}-${Math.floor(Math.random() * 1e9)}`
  const backgroundColor =
    AVATAR_BG_SWATCHES[Math.floor(Math.random() * AVATAR_BG_SWATCHES.length)]
  return { seed, backgroundColor }
}
