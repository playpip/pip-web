'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import { ChevronRight, Lock } from 'lucide-react'
import { SectionScreen } from '@/components/menu/SectionScreen'
import { PremiumStar } from '@/components/menu/venueCard'
import { DRILL_KINDS, type DrillKind, canPlayDrill } from '@/config/drills'
import { nextDrill, randomSeed } from '@/lib/drills'
import { DIFFICULTY_LEVELS, kindDifficulty } from '@/lib/drills/standing'
import { PlayingCard } from '@/components/PlayingCard'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { cn } from '@/lib/utils'

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
 * **A kind that comes with the membership stays on the shelf, and it shows its
 * spot.** This used to filter them out; then it showed them with card backs and
 * one text link, on the argument that dealing a real board behind a lock was
 * showing the thing while refusing it.
 *
 * Both are now wrong (Will, 2026-09-21: "we shouldn't hide drills we don't have
 * access to, we should tease the membership, like side tables does"). The side
 * tables settled the same question on 2026-09-20 and this follows them exactly:
 * a real spot on the artwork, a padlock and the member star in the corners, and
 * a deliberate tap goes to `/membership` rather than nowhere. Card backs told a
 * reader nothing about what they were being offered, which is a strange way to
 * sell something.
 *
 * The line this stays on is **invited versus uninvited**. Nothing here
 * interrupts, nothing appears over what anybody was doing, nothing comes back
 * after being dismissed, and nothing is styled as a sales button — the tile
 * still wears a padlock and still says *Comes with the membership*. The landing
 * page ships "no forced pop-ups, no nagging… Ever." and this screen is inside
 * that sentence (technology#52 item 1, and docs/membership.md).
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <button
        type="button"
        onClick={() => {
          sound.play('tap')
          // **A locked tap goes to the page, not nowhere** — the same move every
          // locked card on the side-tables shelf makes. Answering a deliberate
          // tap with the page that explains the thing is the least we owe
          // somebody for asking.
          router.push(gated ? '/membership' : `/game/drills/${kind.id}`)
        }}
        aria-label={gated ? `${kind.title} — what the membership is` : undefined}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <div className="relative flex w-full items-center justify-center gap-1.5 bg-foreground/[0.04] px-4 py-6">
          {/* A real spot, locked or not. Card backs behind a padlock told a
              reader nothing about the thing they were being offered. */}
          {hydrated ? (
            <TileBoard kind={kind} dim={gated} />
          ) : (
            Array.from({ length: kind.boardCards }, (_, i) => <PlayingCard key={i} size="sm" />)
          )}
          {gated && (
            <span className="absolute left-2 top-2">
              <PremiumStar accent={MEMBER_ACCENT} />
            </span>
          )}
          <span className="absolute bottom-2 left-2">
            <Difficulty kind={kind} />
          </span>
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
            // The tile's own line, at the body text's size and colour, with no
            // button around it: the whole tile is already the control.
            <p className="mt-2 text-sm text-muted-foreground">Comes with the membership.</p>
          )}
        </div>
      </button>
    </motion.div>
  )
}

/**
 * The colour the member star wears here.
 *
 * The drills have no venue art and therefore no accent of their own, so the
 * star borrows the one the builder's tile uses on the side-tables shelf — the
 * other member thing on a shelf with no painting behind it.
 */
const MEMBER_ACCENT = '#8A8F98'

/**
 * How hard this kind is, as pips on the artwork.
 *
 * **A fact about the kind, where the rating beside the title is a fact about
 * you** (Will, 2026-09-21). The room is a ladder now and the order of the tiles
 * says so, but order is a weak signal on a two-column grid — the second tile on
 * a phone is the second row, and nothing on it said it was harder than the one
 * above.
 *
 * The number comes from `kindDifficulty`, which reads the ratings the spots
 * already carry rather than anybody's opinion of them. Pips rather than a word
 * because there are five levels and no honest one-word name for the middle
 * three; the reader who wants the real number has it on the screen itself, on
 * the same scale.
 */
function Difficulty({ kind }: { kind: DrillKind }) {
  const level = kindDifficulty(kind.id)
  return (
    <span
      className="flex items-center gap-1 rounded-md bg-black/30 px-1.5 py-1 backdrop-blur-sm"
      role="img"
      aria-label={`Difficulty ${level} of ${DIFFICULTY_LEVELS}`}
      title={`Difficulty ${level} of ${DIFFICULTY_LEVELS}`}
    >
      {Array.from({ length: DIFFICULTY_LEVELS }, (_, i) => (
        <span
          key={i}
          className={cn('size-1.5 rounded-full', i < level ? 'bg-white/90' : 'bg-white/25')}
        />
      ))}
    </span>
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

/**
 * One real board from the kind, dealt on mount. Held so it is stable.
 *
 * A locked tile draws the same board played down rather than a different thing
 * entirely: it is a window into the kind, and a window you have not paid for is
 * still a window.
 */
function TileBoard({ kind, dim = false }: { kind: DrillKind; dim?: boolean }) {
  const [drill] = useState(() => nextDrill(kind.id, randomSeed()))
  return (
    <span className={cn('flex items-center gap-1.5', dim && 'opacity-60')}>
      {drill.board.map((card) => (
        <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="sm" />
      ))}
    </span>
  )
}
