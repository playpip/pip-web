'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AppBar } from '@/components/AppBar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CountUp } from '@/components/CountUp'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { DealtCard, PlayingCard, type CardSize } from '@/components/PlayingCard'
import { useTheme } from '@/components/theme-provider'
import { LeaveDialog } from '@/components/table/LeaveDialog'
import {
  type BlackjackHand,
  type BlackjackState,
  deal,
  handNet,
  handValue,
  hit,
  newGame,
  options,
  stand,
} from '@/lib/blackjack/engine'
import type { HouseRules } from '@/lib/blackjack/rules'
import { betLadder, minimumBet } from '@/lib/blackjack/session'
import { mulberry32 } from '@/lib/poker/cards'
import { characterById } from '@/config/cast'
import { tableFinishById } from '@/config/shop'
import { avatarRingById } from '@/config/cosmetics'
import { useMoney } from '@/lib/useMoney'
import { useIsMobile } from '@/lib/useMediaQuery'
import { useProfile } from '@/store/profile'
import { sound, type Cue } from '@/lib/sound'
import { cn } from '@/lib/utils'

/**
 * The blackjack table.
 *
 * **It is the poker table's room, dealt a different game** (Will, 2026-09-20).
 * The first version was a form on a white page — labelled sections, a stack
 * figure in the corner, a row of pill buttons — and beside the felt, the seats
 * and the faces everywhere else in the app it read as a settings screen. So
 * this one borrows the whole language: the same full-height surface tinted by
 * whichever table finish you own, the same `AppBar`, a dealer sitting opposite
 * with an avatar and a name, hero cards fanned at the bottom, and an action row
 * with `ActionBar`'s exact metrics.
 *
 * It does **not** share `Table.tsx` itself. That component is wired to the
 * poker game store from top to bottom — seats, blinds, a button that moves, a
 * pot with side pots in it — and teaching it that sometimes none of those exist
 * is how one screen quietly becomes two screens in a trench coat. What is
 * shared is the vocabulary, which is the part a player actually sees.
 *
 * **Vic deals and never speaks.** The cast turns up everywhere else, so an
 * empty chair opposite reads as unfinished — but the dry copy stays true, and a
 * dealer with table talk would imply there is something to read. There is not.
 * Vic draws to seventeen.
 *
 * **Two buttons.** Hit and stand, and that is the whole interface (Will,
 * 2026-09-20). Doubling, splitting and surrender were built, tested and then
 * taken back out: five buttons was a lot of screen for a game whose only
 * question is "another card or not". The cost is in the odds rather than the
 * code and it is stated on the picker — see `lib/blackjack/rules.ts`.
 */
export function BlackjackTable({
  rules,
  boughtIn,
  initialStack,
}: {
  rules: HouseRules
  boughtIn: number
  initialStack: number
}) {
  const router = useRouter()
  const money = useMoney()
  const isMobile = useIsMobile()
  const { resolvedTheme } = useTheme()
  const adjustRoll = useProfile((s) => s.adjustRoll)
  const setSession = useProfile((s) => s.setBlackjack)
  const avatar = useProfile((s) => s.avatar)
  // The player's own ring. Vic deals in his own face and wears nothing.
  const ring = avatarRingById(useProfile((s) => s.avatarRing))
  const finish = tableFinishById(useProfile((s) => s.tableFinish))
  const dealer = characterById('vic')

  // One Rng for the session. Seeded at mount rather than calling Math.random
  // per draw, so the shoe is a shoe: the engine is pure and this is the single
  // point where entropy enters it.
  const rng = useMemo(
    () => mulberry32((Date.now() ^ (initialStack * 2654435761)) >>> 0),
    [initialStack],
  )
  const [game, setGame] = useState<BlackjackState>(() => newGame(rules, initialStack, rng))
  const [bet, setBet] = useState(() => minimumBet(boughtIn))
  const [sizerOpen, setSizerOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  /**
   * Every move goes through here, so the persisted stack can never lag it —
   * and so the table makes a noise, which it did not until somebody played it
   * next to the poker one and noticed the silence (Will, 2026-09-20).
   *
   * The cues are the poker table's, mapped to the nearest thing that happens
   * here rather than invented: a card arriving is `deal`, declining one is
   * `check` (standing is a check — you are done without putting anything in),
   * and the result is `win` / `lose` / `tap`, exactly as `store/game.ts` plays
   * them at a showdown.
   *
   * **The result cue is delayed by a beat.** A hand can settle in the same tick
   * as the action that ended it — stand, and the dealer plays out immediately —
   * so firing both at once lands two tones on top of each other and reads as a
   * glitch rather than as a result. Poker gets this spacing for free from its
   * AI timers; here it has to be asked for.
   */
  const play = useCallback(
    (next: BlackjackState, cue?: Cue) => {
      if (cue) sound.play(cue)
      setGame(next)
      setSession({ table: rules.id, stack: next.stack, boughtIn })
      if (next.phase !== 'settled') return
      const outcome = next.hand?.outcome
      const result: Cue =
        outcome === 'blackjack' || outcome === 'win' ? 'win' : outcome === 'push' ? 'tap' : 'lose'
      setTimeout(() => sound.play(result), RESULT_CUE_DELAY)
    },
    [rules.id, boughtIn, setSession],
  )

  const opts = options(game)
  const minBet = minimumBet(boughtIn)
  // The old row of four fixed stakes, now the quick-picks inside the sizer.
  const ladder = betLadder(boughtIn).filter((b) => b <= game.stack)
  const settled = game.phase === 'settled'
  const dealerValue = handValue(game.dealer)
  const net = settled ? handNet(game) : 0
  const staked = game.hand?.bet ?? 0
  const broke = game.stack < minimumBet(boughtIn) && game.phase !== 'player'

  // The same gradient the poker felt uses, from the same owned finish, so the
  // two rooms are recognisably the same building.
  const finishStyle = finish
    ? resolvedTheme === 'light'
      ? {
          background: `radial-gradient(120% 90% at 50% 42%, color-mix(in srgb, ${finish.swatch} 26%, white), color-mix(in srgb, ${finish.swatch} 12%, white) 78%)`,
        }
      : {
          background: `radial-gradient(120% 90% at 50% 42%, ${finish.swatch}66, ${finish.swatch}24 78%), linear-gradient(${finish.swatch}1a, ${finish.swatch}1a)`,
        }
    : undefined

  const standUp = () => {
    sound.play('call')
    // The stack goes back whole. It left the Roll as chips and returns as the
    // same chips, so there is no rate and nothing to round.
    if (game.stack > 0) adjustRoll(game.stack)
    setSession(null)
    router.push('/game/side')
  }

  // The poker table's own card size, not an approximation of it: `board` is
  // 18vw on a phone and w-20 h-28 from `sm` up, which is exactly what the
  // community cards and the desktop hero cards use over on Table.tsx.
  const cardSize = 'board' as const

  const openSizer = () => {
    sound.play('tap')
    // Reopening on a bet you can no longer cover would show a slider already
    // past its own maximum, so it is clamped on the way in rather than on the
    // way out.
    setBet(clamp(bet, minBet, game.stack))
    setSizerOpen(true)
  }
  const confirmBet = () => {
    setSizerOpen(false)
    play(deal(game, clamp(bet, minBet, game.stack), rng), 'deal')
  }

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden" style={finishStyle}>
      <AppBar
        className="z-20"
        leading="back"
        backLabel="Cash out"
        showWordmark={false}
        onBack={() => {
          sound.play('tap')
          setLeaveOpen(true)
        }}
        title={
          <>
            <span className="text-sm font-medium text-muted-foreground">
              Blackjack · {rules.name}
            </span>
            <span className="text-2xs tabular-nums text-muted-foreground/60">
              {rules.decks === 1 ? 'Single deck' : `${rules.decks} decks`} ·{' '}
              {rules.blackjackPays === 1.5 ? '3:2' : '6:5'} · {rules.hitsSoft17 ? 'hits' : 'stands'}{' '}
              soft 17
            </span>
          </>
        }
      />

      {/* the felt */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-evenly px-3 pb-2">
        {/* the dealer, opposite */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative">
            <motion.div
              animate={game.phase === 'dealer' ? { scale: 1.08 } : { scale: 1 }}
              className={cn('rounded-full', game.phase === 'dealer' && 'ring-2 ring-foreground/80')}
            >
              {dealer && <PlayerAvatar spec={dealer.avatar} size={isMobile ? 48 : 52} />}
            </motion.div>
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.5625rem] font-bold text-primary-foreground">
              D
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{dealer?.name ?? 'Dealer'}</span>
          {/* Reserved height, so the total appearing at showdown never nudges
              the felt — the same trick the poker seat uses for its bet chip. */}
          <span className="flex h-[18px] items-center justify-center">
            {game.dealer.length > 0 && settled && (
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-3xs font-medium tabular-nums">
                {dealerValue.bust ? 'Bust' : dealerValue.total}
              </span>
            )}
          </span>
          <div className="mt-1 flex min-h-[7rem] items-end gap-2">
            {game.dealer.map((card, i) =>
              // The hole card stays down until the dealer plays — the one piece
              // of information the house is entitled to keep.
              i === 1 && !settled ? (
                <PlayingCard key="hole" faceDown size={cardSize} />
              ) : (
                <DealtCard key={`${card.rank}${card.suit}`} index={i} card={card} size={cardSize} />
              ),
            )}
          </div>
        </div>

        {/* the middle: what is on the table, and how it went */}
        <AnimatePresence mode="wait">
          {settled ? (
            <motion.span
              key="result"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-base font-medium"
            >
              {net > 0
                ? `You take ${money(net)}`
                : net < 0
                  ? `${money(-net)} to the house`
                  : 'Push. Nobody moved.'}
            </motion.span>
          ) : (
            <motion.span
              key="staked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-baseline gap-2"
            >
              <span className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
                On the table
              </span>
              <CountUp
                value={staked}
                format={money}
                className="text-2xl font-semibold tabular-nums md:text-3xl"
              />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* hero zone — cards, then you, then the actions */}
      <div className="z-20 flex flex-col items-center gap-3 px-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <div className="flex min-h-[8rem] flex-wrap items-end justify-center gap-4">
          {game.hand ? (
            <HeroHand hand={game.hand} size={cardSize} />
          ) : (
            <span className="self-center text-sm text-muted-foreground">
              Pick a bet and Vic will deal.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {avatar && <PlayerAvatar spec={avatar} size={32} ring={ring} />}
          <CountUp
            value={game.stack}
            format={money}
            className="text-sm font-semibold tabular-nums"
          />
        </div>

        <div className="w-full max-w-xl">
          {game.phase === 'player' ? (
            <div className="flex items-stretch gap-2">
              {/* A card arriving is the same event the poker table calls
                  `deal`; standing is a check by another name. */}
              <Action
                onClick={() => play(hit(game, rng), 'deal')}
                disabled={!opts.canHit}
                tone="primary"
              >
                Hit
              </Action>
              <Action onClick={() => play(stand(game, rng), 'check')} disabled={!opts.canStand}>
                Stand
              </Action>
            </div>
          ) : broke ? (
            <p className="flex h-[56px] items-center justify-center text-center text-sm text-muted-foreground">
              That is the stack gone. There is no top-up here and there never will be.
            </p>
          ) : (
            // The flex row is not decoration: `Action` is `flex-1`, copied from
            // ActionBar where it always sits in one, and outside a flex parent
            // it collapses to a pill the width of the word.
            <div className="flex items-stretch gap-2">
              <Action tone="primary" onClick={openSizer}>
                Deal
              </Action>
            </div>
          )}
        </div>
      </div>

      {/* The poker table's own leave dialog, in its `cash` shape — which is
          already exactly right here: no prize to forfeit, no conversion rate,
          just "every chip in front of you is yours to keep" and the session
          P/L. It is pure presentation, so reusing it costs nothing and means
          standing up reads the same in both rooms rather than nearly the same.

          **Standing up mid-hand leaves the stake on the table.** That is not a
          special case in the code — the stake left the stack when the hand was
          dealt, so the number this dialog offers is already the honest one. */}
      <LeaveDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        cash
        buyIn={boughtIn}
        stack={game.stack}
        cashOut={game.stack}
        onConfirm={standUp}
      />

      {/* The poker table's raise sizer, dealing a different game.
          `ActionBar`'s shape exactly: the number big enough to read across a
          room, a slider, quick-picks, and a confirm that says the amount again
          so the last thing you tap is the last thing you see. The quick-picks
          are the bet ladder the bottom row used to be — four stakes scaled to
          what you sat down with — plus the whole stack, which is the closest
          blackjack has to poker's "Max". */}
      <Dialog open={sizerOpen} onOpenChange={setSizerOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Your bet</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-1">
            <div className="text-center text-4xl font-semibold tabular-nums">
              {bet >= game.stack ? 'Everything' : money(bet)}
            </div>

            <input
              type="range"
              min={minBet}
              max={Math.max(minBet, game.stack)}
              step={minBet}
              value={bet}
              onChange={(e) => setBet(Number(e.target.value))}
              aria-label="Bet size"
              // Without this the slider reads out a bare chip count. Say what
              // the big number above it says.
              aria-valuetext={bet >= game.stack ? 'Everything' : money(bet)}
              className="w-full accent-foreground"
            />

            <div className="flex gap-2">
              {ladder.map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    sound.play('tap')
                    setBet(amount)
                  }}
                  className="flex-1 rounded-xl bg-foreground/5 py-2 text-sm font-medium tabular-nums transition hover:bg-foreground/10"
                >
                  {money(amount)}
                </button>
              ))}
              <button
                onClick={() => {
                  sound.play('tap')
                  setBet(game.stack)
                }}
                className="flex-1 rounded-xl bg-foreground/5 py-2 text-sm font-medium transition hover:bg-foreground/10"
              >
                All
              </button>
            </div>

            <button
              onClick={confirmBet}
              className="w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
            >
              Deal — {bet >= game.stack ? money(game.stack) : money(bet)}
            </button>

            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Table minimum {money(minBet)}. The house keeps about {rules.edgePercent}% of it.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * How long to wait before the result tone, in ms.
 *
 * Roughly the length of the `deal` cue, so the two do not overlap. Short enough
 * that it still reads as the consequence of the tap rather than as a second
 * event.
 */
const RESULT_CUE_DELAY = 260

/** Keep a number inside a range. ActionBar has the same three lines. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Your hand: cards, total, stake, and how it finished. */
function HeroHand({ hand, size }: { hand: BlackjackHand; size: CardSize }) {
  const money = useMoney()
  const value = handValue(hand.cards)

  return (
    <div className="flex flex-col items-center gap-1.5 px-3 py-2">
      {/* Laid out flat like the poker hero's, until a hand runs long. Blackjack
          is the one game here where a holding can reach five or six cards, and
          at that point a phone has to overlap them or they leave the screen. */}
      <div className={cn('flex items-end', hand.cards.length > 3 ? '-space-x-6' : 'gap-2')}>
        {hand.cards.map((card, i) => (
          <DealtCard
            key={`${card.rank}${card.suit}`}
            index={i}
            card={card}
            size={size}
            // The tilt only comes out when the cards are overlapping, for the
            // same reason the poker hero's does: it reads as a fan held in a
            // hand, and on a flat row it just looks crooked.
            className={cn(
              hand.cards.length > 3 && (i % 2 === 0 ? '-rotate-3' : 'translate-y-1 rotate-2'),
            )}
          />
        ))}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {value.bust ? 'Bust' : value.soft ? `Soft ${value.total}` : value.total}
        {hand.outcome && ` · ${OUTCOME_WORDS[hand.outcome]}`}
      </span>
      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-3xs font-medium tabular-nums">
        {money(hand.bet)}
      </span>
    </div>
  )
}

const OUTCOME_WORDS: Record<string, string> = {
  blackjack: 'Blackjack',
  win: 'Won',
  push: 'Push',
  lose: 'Lost',
  surrender: 'Gave up',
}

/**
 * The poker table's action button, copied rather than approximated.
 *
 * The first version used outlined buttons, and that one difference was most of
 * why the screen read as a form: `ActionBar`'s are filled tonal with no border
 * at all. The classes below are `Pill`'s, line for line — `flex-1 rounded-2xl
 * py-4 text-base font-semibold`, `active:scale-[0.97]`, and the same three
 * tones. `disabled` is the only addition, because blackjack can offer an action
 * that is momentarily illegal and poker's bar simply unmounts instead.
 *
 * Not imported from `ActionBar` because that component is bound to the poker
 * game store and its `Pill` is private to it. Two buttons that must look
 * identical and cannot share a file is a real cost; `tests/blackjack.test.ts`
 * cannot catch them drifting, so this comment is the only thing that will.
 */
function Action({
  children,
  onClick,
  disabled,
  tone = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'primary' | 'ghost'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 rounded-2xl py-4 text-base font-semibold transition active:scale-[0.97] disabled:opacity-40',
        tone === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        tone === 'default' && 'bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.14]',
        tone === 'ghost' && 'bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.08]',
      )}
    >
      {children}
    </button>
  )
}
