'use client'

import { motion } from 'framer-motion'
import { ChevronRight, Lock } from 'lucide-react'
import { CategoryArt } from './CategoryArt'
import { cn } from '@/lib/utils'

/**
 * Either the built-in scene for an art id, or a bespoke panel. The challenge
 * tile draws a face rather than a scene, and it is the only caller that does —
 * the union is here so it cannot pass both and quietly get one.
 */
type TileArt =
  | { art: string; accent: string; artNode?: never }
  | { artNode: React.ReactNode; art?: never; accent?: never }

/**
 * A main-menu tile: an art panel over a title and hint. Taps into one corner of
 * the game. When `locked` it dims the label and shows a padlock in the art
 * corner, so it never reads as a dead button.
 *
 * Lives in its own file because the challenge tile uses it too, and importing
 * it back out of `Home` would be a cycle.
 */
export function CategoryCard(
  props: TileArt & {
    title: string
    badge?: string
    subtitle: string
    onClick: () => void
    locked?: boolean
    delay?: number
  },
) {
  const { title, badge, subtitle, onClick, locked = false, delay = 0 } = props
  // Read off `props` rather than a destructured copy, and branch on the art id
  // rather than the node: that is what lets the union above narrow. (A
  // `ReactNode` can legally be undefined, so testing `artNode` narrows
  // nothing.)
  const panel = props.art ? (
    <CategoryArt id={props.art} accent={props.accent} className="absolute inset-0 size-full" />
  ) : (
    props.artNode
  )

  return (
    // The rise animates a plain wrapper, not the card itself: animating
    // opacity/transform on an element that also clips (overflow-hidden +
    // rounded) makes iOS WebKit re-rasterise the rounded mask each frame and
    // flicker. Keeping the clipped card a static child sidesteps it — the same
    // structure the venue tiles use.
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <button
        onClick={onClick}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]"
      >
        <div className="relative aspect-[16/10] w-full">
          {panel}
          <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/40 backdrop-blur-sm">
            {locked ? (
              <Lock className="size-3.5 text-white/85" />
            ) : (
              <ChevronRight className="size-4 text-white/85 transition group-hover:translate-x-0.5" />
            )}
          </span>
        </div>
        <div className={cn('p-3 md:p-4', locked && 'opacity-60')}>
          <h3 className="flex items-center gap-1.5 font-semibold">
            {title}
            {badge && (
              <span className="text-xs font-medium tabular-nums text-muted-foreground/70">
                {badge}
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </button>
    </motion.div>
  )
}
