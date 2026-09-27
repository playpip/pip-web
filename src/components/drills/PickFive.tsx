'use client'

// "Which five play?" — the one kind whose answer is the cards themselves.
//
// **The interaction is the lesson.** Every other kind asks you to read the
// board and then press a word about it; this one asks you to put your finger on
// the five cards that count, which is the thing a beginner has actually got to
// learn to do. Picking a sentence off a list of five-card descriptions would
// teach reading descriptions.
//
// Five taps and it grades itself. No submit button, and that is deliberate
// rather than clever: the fifth tap *is* the answer, the count says how many
// are still to pick, and a sixth tap swaps rather than refusing — so there is
// nothing to undo, no second press to make it count, and no state a player can
// get stuck in. Tapping a chosen card takes it back.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import { DealtCard } from '@/components/PlayingCard'
import { PICKED_RING } from './felt'
import { PLAYS, selectionId } from '@/lib/drills/whichFivePlay'
import type { Drill } from '@/lib/drills/types'
import { type Card, cardName, cardToString } from '@/lib/poker/cards'
import { haptics } from '@/lib/haptics'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/** The cards of a spot, in the order they are drawn: hole first, then board. */
export function sevenOf(drill: Drill): { hole: Card[]; board: Card[] } {
  return { hole: [...(drill.hands?.[0]?.cards ?? [])], board: [...drill.board] }
}

/**
 * The five a player has picked, as the id the grader compares against.
 *
 * `selectionId` is the generator's own spelling of a set of cards, which is
 * what makes the order of the taps irrelevant: the same five come to the same
 * id whether the ace was spotted first or last.
 */
export function pickedId(picked: readonly Card[]): string {
  return selectionId(picked)
}

/**
 * A card you can tap, on the felt.
 *
 * Three states and they are all physical: untouched sits flat, chosen lifts
 * toward you and wears a ring, and — once it is over — a card that should have
 * been in the five is ringed green whether or not it was picked. The lift is
 * the whole reason this is nicer than a checkbox, and it is the first thing to
 * go under `prefers-reduced-motion`.
 */
function TappableCard({
  card,
  index,
  size,
  chosen,
  settled,
  plays,
  onToggle,
}: {
  card: Card
  index: number
  size: 'board' | 'hero'
  chosen: boolean
  settled: boolean
  plays: boolean
  onToggle: () => void
}) {
  const wrong = settled && chosen && !plays
  return (
    // A part cannot assume what it is mounted inside, and the lift below is the
    // first thing somebody who asked for less motion would notice. Nesting this
    // inside the screen's own wrapper costs nothing and renders no DOM — the
    // same trade ./felt.tsx makes, and `tests/drillsMotion.test.ts` holds it.
    <MotionConfig reducedMotion="user">
      <motion.button
        type="button"
        onClick={onToggle}
        disabled={settled}
        aria-pressed={chosen}
        aria-label={`${cardName(card)}${chosen ? ', picked' : ''}`}
        animate={{ y: chosen && !settled ? -10 : 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className={cn(
          'rounded-xl motion-reduce:transform-none',
          !settled && 'active:scale-[0.97] motion-reduce:active:scale-100',
          wrong && 'opacity-40',
          settled && !plays && !chosen && 'opacity-40',
        )}
      >
        {/* The ring goes on the card, inside its own edge — see PLAYS_RING in
            ./felt.tsx for why an outside ring cannot work on a board this
            wide. */}
        <DealtCard
          card={card}
          index={index}
          size={size}
          className={cn(
            'transition',
            chosen && !settled && PICKED_RING,
            settled && plays && 'ring-2 ring-inset ring-emerald-500',
          )}
        />
      </motion.button>
    </MotionConfig>
  )
}

/**
 * The whole interaction: seven tappable cards, and how many are left to pick.
 *
 * The parent owns the grading and the reveal, the way every other kind's parent
 * does — this reports a selection of five and nothing else.
 */
export function usePickFive({
  drill,
  settled,
  onFive,
}: {
  drill: Drill
  settled: boolean
  onFive: (id: string) => void
}) {
  /**
   * What has been tapped, and which spot it was tapped on.
   *
   * **The seed is in the state, and that is the whole of the bug it fixes**
   * (Will, 2026-09-21: "I can choose the first hand, then the second hand comes
   * along and I select one card and it's like I've selected all 5"). This hook
   * lives in a screen that swaps the spot underneath it rather than remounting,
   * so a plain `Card[]` survived the deal: the next hand opened with the last
   * hand's five still held, the first tap rolled the oldest one off the front,
   * the count hit five, and it graded a set of cards from two different boards.
   *
   * Carrying the seed means a selection belongs to the spot it was made on, and
   * a spot that has moved on reads as untouched — during render, with no effect
   * to fire and no `setState` in one (the rule in docs/development.md). There is
   * no frame in which the old five are on screen, because they are never
   * returned.
   */
  const [tapped, setTapped] = useState<{ seed: number; cards: Card[] }>({
    seed: drill.seed,
    cards: [],
  })
  const picked = tapped.seed === drill.seed ? tapped.cards : []
  const { hole, board } = useMemo(() => sevenOf(drill), [drill])

  // The five that play, for the reveal. Read off the spot's own choices, where
  // the generator marked them — not worked out again here, which would be a
  // second reading of the hand free to disagree with the first.
  const plays = useMemo(
    () => new Set(drill.choices.filter((c) => c.winning).map((c) => c.id)),
    [drill],
  )

  const toggle = useCallback(
    (card: Card) => {
      if (settled) return
      const id = cardToString(card)
      const has = picked.some((c) => cardToString(c) === id)
      // A sixth tap drops the card picked longest ago rather than refusing.
      // Refusing would make the player undo something before they could say
      // what they meant, and there is nothing here worth protecting them from.
      const next = has
        ? picked.filter((c) => cardToString(c) !== id)
        : [...picked.slice(picked.length >= PLAYS ? 1 : 0), card]
      // Stamped with the spot it belongs to, so it cannot be read on the next
      // one. See the note on `tapped`.
      setTapped({ seed: drill.seed, cards: next })
      sound.play(has ? 'tap' : 'check')
      haptics.fire('deal')
      if (next.length === PLAYS) onFive(pickedId(next))
    },
    [picked, settled, onFive, drill.seed],
  )

  // The digits pick cards, the way they pick answers on every other kind: 1 and
  // 2 are yours, 3 to 7 are the board, left to right, which is the order they
  // are drawn in.
  const seven = useMemo(() => [...hole, ...board], [hole, board])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || settled) return
      const digit = Number(event.key)
      if (!Number.isInteger(digit) || digit < 1 || digit > seven.length) return
      event.preventDefault()
      toggle(seven[digit - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seven, toggle, settled])

  const isChosen = (card: Card) => picked.some((c) => cardToString(c) === cardToString(card))

  return {
    picked,
    left: PLAYS - picked.length,
    /** The board, with every card a control. */
    renderBoardCard: (card: Card, index: number) => (
      <TappableCard
        key={`${card.rank}${card.suit}`}
        card={card}
        index={index}
        size="board"
        chosen={isChosen(card)}
        settled={settled}
        plays={plays.has(cardToString(card))}
        onToggle={() => toggle(card)}
      />
    ),
    /** Your two, at hero size, equally tappable — they are two of the seven. */
    heroCards: (
      <div className="flex gap-1.5">
        {hole.map((card, i) => (
          <TappableCard
            key={`${card.rank}${card.suit}`}
            card={card}
            index={i}
            size="hero"
            chosen={isChosen(card)}
            settled={settled}
            plays={plays.has(cardToString(card))}
            onToggle={() => toggle(card)}
          />
        ))}
      </div>
    ),
  }
}

/**
 * How many are still to pick, in the action bar where the answers go.
 *
 * A count rather than a progress bar, and it counts *down*: what a player wants
 * to know is how many more taps this is, not how far through they are. It sits
 * in the bar so the place the answer is made is the same place on every kind.
 */
export function PickCounter({ left }: { left: number }) {
  return (
    <div className="flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/20 px-4 text-sm text-muted-foreground">
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: PLAYS }, (_, i) => (
          <span
            key={i}
            className={cn(
              'size-2 rounded-full transition-colors',
              i < PLAYS - left ? 'bg-primary' : 'bg-foreground/15',
            )}
          />
        ))}
      </span>
      <span>
        {left === 0
          ? 'Reading the hand…'
          : `${left} more card${left === 1 ? '' : 's'} — tap the ones that play`}
      </span>
    </div>
  )
}
