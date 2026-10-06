import { CardBack } from '@/components/CardBack'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { cardBackById } from '@/config/cardBacks'
import { CAST, type Character } from '@/config/cast'
import type { Drill, DrillLineStep } from '@/lib/drills/types'
import { formatChips } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import { MotionConfig, motion } from 'framer-motion'

// Who sits across a calling-the-river spot, and what they did to get there.
// Shared by the pack and by the one spot `/membership?for=river` deals, so the
// spot a player is shown before joining is drawn the way the pack draws it.

/**
 * Who can sit across the table: regulars of the low and middle tables, not
 * pinned to a room, and with no bluffing claimed in their personality.
 */
const OPPONENTS: readonly Character[] = CAST.filter(
  (ch) =>
    !ch.only &&
    ch.delta?.bluff === undefined &&
    ch.bands.some((band) => band === 'low' || band === 'mid'),
)

/** The seat for a spot, off its seed, so the same spot always has the same face. */
export const opponentFor = (drill: Drill): Character => OPPONENTS[drill.seed % OPPONENTS.length]

const STREET: Record<DrillLineStep['street'], string> = {
  flop: 'the flop',
  turn: 'the turn',
  river: 'the river',
}

/** What they did, as one sentence: "checked the flop, bet 40 into 80 on the turn, …". */
function lineSentence(line: readonly DrillLineStep[]): string {
  const parts = line.map((step) =>
    step.action === 'check'
      ? `checked ${STREET[step.street]}`
      : `bet ${formatChips(step.amount ?? 0)} into ${formatChips(step.potBefore)} on ${STREET[step.street]}`,
  )
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`
}

/**
 * Across the table: who bet, their two cards face down, and what they did on
 * each street. The line is the question as much as the cards are, so it is set
 * as three steps you can read at a glance, with the river's bet (the one you
 * are facing) lit.
 */
export function Opponent({
  character,
  line,
  cardBack,
  dim,
}: {
  character: Character
  line: readonly DrillLineStep[]
  cardBack: ReturnType<typeof cardBackById>
  dim: boolean
}) {
  // Declared here as well as by the pack, so the spot on /membership honours
  // reduce motion too (tests/drillsMotion.test.ts). One column on a phone,
  // where height is cheap and width is not; one row on a desktop, where the
  // verdict needs the height the column would take.
  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          'flex flex-col items-center gap-2 transition-opacity sm:flex-row sm:gap-4',
          dim && 'opacity-45',
        )}
      >
        <span className="sr-only">{`${character.name} ${lineSentence(line)}.`}</span>
        <div className="flex items-center gap-2" aria-hidden>
          <PlayerAvatar spec={character.avatar} size={28} />
          <span className="text-sm font-medium">{character.name}</span>
          <span className="flex gap-0.5">
            <CardBack design={cardBack} size="xs" className="-rotate-6" />
            <CardBack design={cardBack} size="xs" className="rotate-6" />
          </span>
        </div>
        <ol className="flex items-stretch gap-1.5" aria-hidden>
          {line.map((step, i) => {
            const facing = step.street === 'river'
            return (
              <motion.li
                key={step.street}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.25 + i * 0.12 }}
                className={cn(
                  'flex min-w-[4.75rem] flex-col items-center rounded-xl px-2.5 py-1.5',
                  facing ? 'bg-primary text-primary-foreground' : 'bg-foreground/[0.05]',
                )}
              >
                <span
                  className={cn(
                    'text-3xs font-medium uppercase tracking-[0.18em]',
                    facing ? 'text-primary-foreground/70' : 'text-muted-foreground',
                  )}
                >
                  {step.street}
                </span>
                <span className="text-xs font-semibold tabular-nums">
                  {step.action === 'check' ? 'Check' : `Bet ${formatChips(step.amount ?? 0)}`}
                </span>
                {step.action === 'bet' && (
                  <span
                    className={cn(
                      'text-3xs tabular-nums',
                      facing ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    into {formatChips(step.potBefore)}
                  </span>
                )}
              </motion.li>
            )
          })}
        </ol>
      </div>
    </MotionConfig>
  )
}
