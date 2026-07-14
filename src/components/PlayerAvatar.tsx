'use client'

import { useMemo } from 'react'
import { avatarDataUri, type AvatarSpec } from '@/lib/avatar'
import { cn } from '@/lib/utils'

export function PlayerAvatar({
  spec,
  size = 48,
  className,
  dimmed = false,
}: {
  spec: AvatarSpec
  size?: number
  className?: string
  dimmed?: boolean
}) {
  const src = useMemo(() => avatarDataUri(spec, size), [spec, size])
  return (
    // Data-URI SVG avatar — next/image adds no value for inline SVG.
    // eslint-disable-next-line @next/next/no-img-element
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
    />
  )
}
