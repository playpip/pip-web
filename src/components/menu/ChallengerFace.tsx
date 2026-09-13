'use client'

import { useMemo } from 'react'
import { VenueArt } from '@/components/menu/VenueArt'
import type { Character } from '@/config/cast'
import { avatarDataUri } from '@/lib/avatar'
import { cn } from '@/lib/utils'

/**
 * A challenger as cover art: the heads-up room behind them, blurred back into
 * scenery, and their face under the lamp. The same panel serves the menu tile
 * and the info dialog's header, so the face you tap is the face you sit down
 * opposite.
 *
 * It used to be the avatar alone on a black rectangle, sized to 88% of the
 * frame and pushed below the bottom edge. Avatars carry their own circular
 * swatch, so what bled off that edge was a pastel disc with a slice cut out of
 * it, and beside the venue tiles (which have painted rooms) it read as a
 * sticker on a blank card.
 *
 * Three changes, all borrowed rather than invented:
 *
 * - **A room, from the venue art.** `duel` is the two-chairs-one-lamp painting
 *   The Duel already uses, and a challenge is the same room: two seats, one
 *   table. Blurred and scaled the way `VenueInfoDialog` treats every other
 *   cover, because scenery is scenery. No new asset, and if the image ever
 *   fails `VenueArt` falls back to its geometric scene on its own.
 * - **The lamp retinted** to the challenge accent, so the three bands still
 *   light differently.
 * - **The swatch dropped.** Rendering the avatar on `transparent` leaves the
 *   bust as a cut-out, which is why it can bleed off the bottom edge without
 *   looking sliced: there is no disc to slice. The line art is dark enough to
 *   hold its own shape against the cone of light behind it.
 *
 * Fixed dark values rather than theme tokens throughout: this is menu art,
 * which stays dark in both themes (docs/design.md).
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
  // Not `PlayerAvatar`: that one is a round chip with a swatch behind it, which
  // is the whole thing this panel is getting away from.
  const portrait = useMemo(
    () => avatarDataUri({ ...character.avatar, backgroundColor: 'transparent' }, 256),
    [character.avatar],
  )

  return (
    <div className={cn('relative overflow-hidden bg-[#0A0A0A]', className)}>
      {/* `scale-110` hides the blur's transparent edges, the same trick the
          venue covers use. */}
      <VenueArt
        id="duel"
        accent={accent}
        className="absolute inset-0 size-full scale-110 blur-[3px]"
      />
      {/* Knocked back so the lamp's own cone cannot compete with the face. */}
      <div aria-hidden className="absolute inset-0 bg-black/55" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(62% 58% at 50% 38%, ${accent}, transparent 70%)`,
          opacity: 0.42,
        }}
      />
      {/* A drop shadow rather than a box shadow: it follows the cut-out's alpha
          instead of drawing a rectangle round it. */}
      <img
        src={portrait}
        alt=""
        draggable={false}
        className="absolute left-1/2 top-[8%] h-full w-auto -translate-x-1/2 drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)]"
      />
      {/* The dialog lays the challenger's name and their invitation over this
          edge; the tile just gets a floor to stand them on. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent"
      />
    </div>
  )
}
