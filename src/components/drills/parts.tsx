'use client'

import { MotionConfig, motion } from 'framer-motion'
import { PlayingCard } from '@/components/PlayingCard'
import type { DrillHand, DrillStakes } from '@/lib/drills/types'
import { type Card, cardName } from '@/lib/poker/cards'
import { formatChips } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

// The pieces both drills screens draw with.
//
// Two screens ask the same question in different shapes (a spot on its own in
// DrillRunner, a hand played street by street in PlayItOut), and a player
// moving between them should be reading the same furniture: the same score
// line, the same price line, the same hand panel. They were one file until the
// second screen existed; they are here so that changing what a price looks like
// changes it in both places rather than in the one somebody remembered.

/**
 * The title and the score.
 *
 * One line of numbers under the title rather than a panel: a scoreboard that
 * takes a quarter of a phone screen is competing with the cards, and the cards
 * are the drill. The rating sits opposite the title where the eye lands on
 * arriving, and everything else is one muted line of facts.
 *
 * The delta is the reason the rating is worth showing at all. A number that
 * only ever appears in its settled state is furniture; a number you watch move
 * is the thing you came back for.
 */
export function Header({
  title,
  rating,
  delta = null,
  run = 0,
  answered = 0,
  correct = 0,
  bestRun = 0,
}: {
  title: string
  rating?: number
  delta?: number | null
  run?: number
  answered?: number
  correct?: number
  bestRun?: number
}) {
  // Facts, in the order they change. Nothing is shown before it means
  // something: a first-timer gets a title and a rating to move, not a row of
  // zeros telling them how little they have done.
  const facts = [
    run > 1 ? `${run} in a row` : null,
    bestRun > 1 ? `best ${bestRun}` : null,
    answered > 0 ? `${Math.round((correct / answered) * 100)}% of ${answered}` : null,
  ].filter(Boolean)

  return (
    <div className="mb-6 flex items-start justify-between gap-3 px-1">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {facts.length > 0 && (
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">{facts.join(' · ')}</p>
        )}
      </div>

      {rating !== undefined && (
        <div className="flex shrink-0 items-baseline gap-1.5">
          {/* A shared part cannot assume what it is mounted inside, and this one
              is now mounted inside two screens. The wrapper is what makes the
              delta honour the motion setting wherever it lands; nesting it
              inside a screen's own MotionConfig costs nothing and renders no
              DOM. */}
          {delta !== null && delta !== 0 && (
            <MotionConfig reducedMotion="user">
              <motion.span
                // Keyed by the value so a second answer worth the same as the
                // first still animates rather than sitting there.
                key={`${rating}-${delta}`}
                initial={{ opacity: 0, y: delta > 0 ? 6 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'text-sm font-medium tabular-nums',
                  delta > 0 ? 'text-emerald-500' : 'text-muted-foreground',
                )}
              >
                {delta > 0 ? '+' : ''}
                {delta}
              </motion.span>
            </MotionConfig>
          )}
          <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-sm font-semibold tabular-nums">
            {rating}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * The money, on a kind whose question is about a price.
 *
 * Two numbers, in the order the decision needs them, and in the same words the
 * table uses. Nothing here is a hint: what the pot is charging as a percentage
 * is the thing being asked for, so it appears in the sentence after the answer
 * and never before it.
 */
export function Stakes({ stakes }: { stakes: DrillStakes }) {
  const pot = formatChips(stakes.pot)
  const toCall = formatChips(stakes.toCall)
  return (
    <p className="mt-1.5 text-center text-sm tabular-nums text-muted-foreground">
      <span className="sr-only">{`Pot ${pot} chips, ${toCall} to call.`}</span>
      <span aria-hidden>
        Pot <span className="font-semibold text-foreground">{pot}</span>
        {' · '}
        <span className="font-semibold text-foreground">{toCall}</span> to call
      </span>
    </p>
  )
}

/**
 * A holding the spot shows and does not ask about.
 *
 * Deliberately not a button and deliberately not styled like one: on a kind
 * where the answer is a number, a hand panel that looks pressable is an
 * invitation to answer the wrong question. Same card sizes as the choice
 * panels so the two read as one row of information.
 *
 * What each hand *is* right now is shown from the start rather than at the
 * reveal. You cannot count what beats you without being told what you are up
 * against, so hiding it would make counting outs a guess about the opponent.
 */
export function ShownHand({ hand }: { hand: DrillHand }) {
  return (
    <div className="rounded-2xl border border-foreground/10 p-3">
      {/* `PlayingCard` is aria-hidden, so the cards do not read at all. The
          pickable panels solve that with an aria-label on the button; there is
          no button here, so the readout is a visually hidden line and the
          visual half is hidden from the reader to stop it being said twice. */}
      <span className="sr-only">
        {`${hand.label}: ${hand.cards.map(cardName).join(' and ')}${
          hand.detail ? `, ${hand.detail}` : ''
        }`}
      </span>
      <span className="flex items-center gap-3" aria-hidden>
        <span className="flex gap-1.5">
          {hand.cards.map((card) => (
            <PlayingCard key={cardKey(card)} card={card} size="md" />
          ))}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">{hand.label}</span>
          {hand.detail && <span className="text-xs text-muted-foreground">{hand.detail}</span>}
        </span>
      </span>
    </div>
  )
}

export const cardKey = (card: Card): string => `${card.rank}${card.suit}`
