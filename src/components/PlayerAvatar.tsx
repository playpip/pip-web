'use client'

import { useMemo } from 'react'
import type { AvatarRing } from '@/config/cosmetics'
import { avatarDataUri, type AvatarSpec } from '@/lib/avatar'
import { cn } from '@/lib/utils'

export function PlayerAvatar({
  spec,
  size = 48,
  className,
  dimmed = false,
  ring,
}: {
  spec: AvatarSpec
  size?: number
  className?: string
  dimmed?: boolean
  /**
   * An avatar ring (config/cosmetics), or nothing for a bare avatar.
   *
   * Only ever the player's own: the cast wear their own faces and a ring on
   * Doris would be the app claiming she bought one.
   */
  ring?: AvatarRing
}) {
  const src = useMemo(() => avatarDataUri(spec, size), [spec, size])
  return (
    // Data-URI SVG avatar — next/image adds no value for inline SVG.
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={cn(
        'rounded-full bg-foreground/5 transition-opacity',
        dimmed && 'opacity-35 grayscale',
        className,
      )}
      // **The ring is padding, not a wrapper.** Tailwind's preflight puts every
      // box on `border-box`, so 2px of padding eats into the picture and leaves
      // the element exactly `size` across — which means a ring can be switched
      // on and off without moving a single seat on the felt. A wrapping span
      // would have grown every avatar it was applied to by four pixels, on the
      // one screen where the seats are laid out on a fixed arc.
      style={ring ? { padding: 2, background: ring.ring } : undefined}
    />
  )
}
