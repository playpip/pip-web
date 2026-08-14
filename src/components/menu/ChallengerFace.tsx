'use client'

import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Character } from '@/config/cast'
import { cn } from '@/lib/utils'

/**
 * A challenger as cover art: their face on the dark tile frame, lit from below
 * in the challenge accent. The same panel serves the menu tile and the info
 * dialog's header, so the face you tap is the face you sit down opposite.
 *
 * The portrait is sized in percentages of the frame and bleeds off the bottom
 * edge, because the tile is fluid — half a phone at 320px, a fifth of a wide
 * desktop column — and a fixed avatar size would swim in one and burst the
 * other. `bg-black` rather than a token: this is art, and it stays dark in both
 * themes like the rest of the menu art (docs/design.md).
 */
export function ChallengerFace({
  character,
  accent,
  className,
}: {
  character: Character
  accent: string
  className?: string
}) {
  return (
    <div className={cn('relative overflow-hidden bg-[#0A0A0A]', className)}>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(85% 65% at 50% 112%, ${accent}, transparent 70%)`,
          opacity: 0.5,
        }}
      />
      <PlayerAvatar
        spec={character.avatar}
        size={192}
        className="absolute bottom-0 left-1/2 h-[88%] w-auto -translate-x-1/2 translate-y-[12%]"
      />
    </div>
  )
}
