'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MotionConfig, motion } from 'framer-motion'
import { ChevronRight, Lock } from 'lucide-react'
import { SectionScreen } from '@/components/menu/SectionScreen'
import { DRILL_KINDS, type DrillKind, canPlayDrill } from '@/config/drills'
import { nextDrill, randomSeed } from '@/lib/drills'
import { PlayingCard } from '@/components/PlayingCard'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'

/**
 * The drills room: one tile per kind, the same shape as the venue browsers.
 *
 * It exists with one kind on it because it is where the kinds land, and because
 * "Drills" on the menu going straight into one kind would have to be rewired
 * the day there are two.
 *
 * A tile carries your rating for that kind once you have answered one, which is
 * what makes this room worth walking back into. It carries no cap, no
 * countdown and nothing you can be behind on — see the note at the top of
 * lib/drills/rating.ts.
 *
 * **A kind that comes with the membership stays on the shelf, locked.** This
 * used to filter them out, with a note saying the honest surface was the tile
 * still being here and that it was waiting on `/membership` to exist to point
 * at. That page exists now, so the filter is gone: you cannot buy what you
 * cannot see, and hiding a paid kind is dishonest by omission.
 *
 * What a locked tile is allowed to be is the narrow part. It is a plain line
 * saying what the thing is and one text link — not a prompt, not a button, no
 * CTA styling, and nothing that appears over what the player was doing or comes
 * back after being closed. The landing page ships "no forced pop-ups, no
 * nagging… Ever." and this screen is inside that sentence (technology#52
 * item 1).
 */
export function DrillIndex() {
  const member = useEntitlement()
  // Everything, in registry order, so the shelf does not reshuffle itself the
  // moment somebody joins. `canPlayDrill` decides what each tile does, not
  // whether it exists.
  const kinds = DRILL_KINDS

  // The tiles stagger in on a delay, which is the one thing on this screen a
  // player who asked for less motion would notice most. Honoured once here for
  // the whole subtree, the way Tutorial.tsx does it.
  return (
    <MotionConfig reducedMotion="user">
      <SectionScreen
        title="Drills"
        subtitle="Short spots with a right answer. Your rating moves with every one, and there is no limit on how many you play."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {kinds.map((kind, i) => (
            <DrillTile
              key={kind.id}
              kind={kind}
              gated={!canPlayDrill(kind, member)}
              delay={i * 0.05}
            />
          ))}
        </div>
      </SectionScreen>
    </MotionConfig>
  )
}

/**
 * A kind's tile, with a real spot from that kind drawn on it: a window into the
 * thing rather than an illustration of it, and a different board every time the
 * room is opened. The board mounts as a client-only child for the reason the
 * runner's does — generated during render it would be generated once, at build
 * time, and this tile would show the same five cards forever.
 */
function DrillTile({ kind, gated, delay }: { kind: DrillKind; gated: boolean; delay: number }) {
  const router = useRouter()
  const hydrated = useHydrated()

  // A gated tile is a div, not a disabled button. Nothing here is clickable
  // except the one text link below it, so a tap on the artwork does nothing
  // rather than doing something salesy.
  const Frame = gated ? 'div' : 'button'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <Frame
        {...(gated
          ? {}
          : {
              onClick: () => {
                sound.play('tap')
                router.push(`/game/drills/${kind.id}`)
              },
            })}
        className={
          gated
            ? 'flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left'
            : 'group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100'
        }
      >
        <div className="relative flex w-full items-center justify-center gap-1.5 bg-foreground/[0.04] px-4 py-6">
          {/* A locked tile shows card backs rather than a real spot. Dealing a
              genuine board behind a lock would be showing the thing while
              refusing it, which reads worse than not showing it. */}
          {hydrated && !gated ? (
            <TileBoard kind={kind} />
          ) : (
            Array.from({ length: kind.boardCards }, (_, i) => <PlayingCard key={i} size="sm" />)
          )}
          <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/30 backdrop-blur-sm">
            {gated ? (
              <Lock className="size-3.5 text-white/85" />
            ) : (
              <ChevronRight className="size-4 text-white/85 transition group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
            )}
          </span>
        </div>
        <div className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">{kind.title}</h3>
            {hydrated && !gated && <Standing kind={kind} />}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{kind.blurb}</p>
          {gated && (
            // The whole of the "prompt". A sentence and a link, in the body
            // text's own colour and size, with no button around it.
            <p className="mt-2 text-sm text-muted-foreground">
              Comes with the membership.{' '}
              <Link
                href="/membership"
                className="underline underline-offset-2 hover:text-foreground"
              >
                What that is
              </Link>
              .
            </p>
          )}
        </div>
      </Frame>
    </motion.div>
  )
}

/**
 * Where you stand on this kind, or nothing at all.
 *
 * Client-only for the same reason the board is: the profile hydrates after
 * first paint, so a prerendered rating would be a stranger's zero flashing on
 * every visit. Absent until the first answer, because "0%" is not a fact about
 * a player who has not played.
 */
function Standing({ kind }: { kind: DrillKind }) {
  const record = useProfile((s) => s.drills[kind.id])
  if (!record || record.answered === 0) return null
  return (
    <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
      {record.rating}
    </span>
  )
}

/** One real board from the kind, dealt on mount. Held so it is stable. */
function TileBoard({ kind }: { kind: DrillKind }) {
  const [drill] = useState(() => nextDrill(kind.id, randomSeed()))
  return (
    <>
      {drill.board.map((card) => (
        <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="sm" />
      ))}
    </>
  )
}
