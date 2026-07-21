'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, History } from 'lucide-react'
import { AppBar, AppBarAction } from '@/components/AppBar'
import { AwardChip } from '@/components/AwardChip'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { DealtCard, PlayingCard, type CardSize } from '@/components/PlayingCard'
import { CardBack } from '@/components/CardBack'
import { CountUp } from '@/components/CountUp'
import { ActionBar } from './ActionBar'
import { HandHistoryDialog } from './HandHistoryDialog'
import { HandsHelpDialog } from './HandsHelpDialog'
import { LeaveDialog } from './LeaveDialog'
import { PlayerDialog } from './PlayerDialog'
import { useGame } from '@/store/game'
import { useProfile } from '@/store/profile'
import { potSize, type HandState, type Player } from '@/lib/poker/engine'
import { evaluateHand } from '@/lib/poker/handEval'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useMoney } from '@/lib/useMoney'
import { useIsMobile } from '@/lib/useMediaQuery'
import { KITCHEN_TABLE, freerollOpen } from '@/config/venues'
import { nicknameFor } from '@/config/handNames'
import { tableFinishById } from '@/config/shop'
import { cardBackById } from '@/config/cardBacks'
import type { AvatarSpec } from '@/lib/avatar'

/** Positions for N opponents spread along the top arc of an ellipse (y grows down). */
function opponentPositions(n: number): { left: string; top: string }[] {
  const RX = 41
  const RY = 34
  const CY = 56 // arc centre sits below the table midline, matching the board
  return Array.from({ length: n }, (_, k) => {
    const t = (k + 1) / (n + 1) // 0..1 across the arc
    const deg = 180 + t * 180 // 180° (left) → 360° (right), over the top
    const rad = (deg * Math.PI) / 180
    return {
      left: `${50 + RX * Math.cos(rad)}%`,
      top: `${CY + RY * Math.sin(rad)}%`,
    }
  })
}

type Point = { left: string; top: string }

export function Table() {
  const router = useRouter()
  const {
    hand,
    seats,
    venue,
    aiThinkingId,
    status,
    message,
    place,
    heroEquity,
    smallBlind,
    bigBlind,
    blindLevel,
    newAwards,
    lastBounty,
    seatStats,
    talk,
    cashInvested,
    nextHand,
    rebuy,
    leave,
  } = useGame()
  const cardBack = cardBackById(useProfile((s) => s.cardBack))
  const roll = useProfile((s) => s.roll)
  const finish = tableFinishById(useProfile((s) => s.tableFinish))
  const { resolvedTheme } = useTheme()
  const adjustRoll = useProfile((s) => s.adjustRoll)
  const money = useMoney()
  const isMobile = useIsMobile()
  const [helpOpen, setHelpOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)
  const hasHistory = useGame((s) => s.lastHand !== null)

  const metaById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats])

  if (!hand || !venue) return <div className="min-h-dvh" />

  const buttonPlayerId = hand.players[hand.buttonIndex]?.id
  const activeId = hand.players[hand.toActIndex]?.id
  const hero = hand.players.find((p) => p.id === 'hero')
  const opponents = hand.players.filter((p) => p.id !== 'hero')
  const positions = opponentPositions(opponents.length)
  const pot = potSize(hand)
  const heroMeta = hero ? metaById.get(hero.id) : undefined
  const showdownReveal = hand.result?.showdown === true

  // Winners of the just-finished hand — for the pot → winner chip animation.
  const potWinners =
    status !== 'playing' && hand.result
      ? Array.from(new Set(hand.result.potsAwarded.flatMap((p) => p.winners)))
      : []

  const goHome = () => {
    leave()
    router.push('/game')
  }
  const cashOutAndLeave = () => {
    // Freeroll stacks are the house's chips — only the winner's prize pays out,
    // so you can't enter the Kitchen Table just to walk off with the stack.
    if (hero && !venue.freeroll) adjustRoll(hero.stack)
    useProfile.getState().recordRollPoint()
    goHome()
  }
  const selectSeat = (id: string) => {
    sound.play('tap')
    setViewId(id)
  }

  const chipsTo = (id: string, to: Point) =>
    Array.from({ length: 6 }).map((_, k) => (
      <motion.span
        key={`chip-${id}-${k}`}
        className="pointer-events-none absolute z-30 -ml-[7px] -mt-[7px] size-3.5 rounded-full bg-amber-400 shadow-md shadow-black/30 ring-1 ring-amber-200/60"
        initial={{ left: '50%', top: '48%', opacity: 0, scale: 0.5 }}
        animate={{ left: to.left, top: to.top, opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.85] }}
        transition={{ duration: 0.8, delay: 0.15 + k * 0.05, ease: 'easeOut' }}
      />
    ))

  const communityCards = (
    <div className="flex items-center justify-center gap-1 sm:gap-2 lg:gap-2.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const card = hand.community[i]
        return card ? (
          <DealtCard key={i} index={i} card={card} size="board" />
        ) : (
          <CardBack key={i} design={cardBack} size="board" />
        )
      })}
    </div>
  )

  const actionArea =
    status === 'handover' ? (
      // Entrance transform lives on the wrapper; the button keeps its own CSS
      // `transition` for hover/press. Animating `y` on the same element that
      // has `transition-property: transform` makes the two fight → jitter (iOS).
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={nextHand}
          className="w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
        >
          Next hand
        </button>
      </motion.div>
    ) : (
      <ActionBar hand={hand} />
    )

  // Table talk lives with the board — under the community cards, across from
  // the pot, where table chatter belongs.
  const talkLine = (
    <AnimatePresence>
      {talk && (
        <motion.span
          key={talk}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="text-[11px] italic leading-snug text-muted-foreground/80"
        >
          {talk}
        </motion.span>
      )}
    </AnimatePresence>
  )

  // An owned table finish recolours the felt — flat, no texture, ever. The two
  // themes need different physics: on dark, translucent colour glows over the
  // near-black background; on light, translucency makes a muddy stain that
  // kills text contrast, so we mix an OPAQUE pastel toward white instead — a
  // pale, designed surface that dark ink still reads on.
  const finishStyle = finish
    ? resolvedTheme === 'light'
      ? {
          background: `radial-gradient(120% 90% at 50% 42%, color-mix(in srgb, ${finish.swatch} 26%, white), color-mix(in srgb, ${finish.swatch} 12%, white) 78%)`,
        }
      : {
          background: `radial-gradient(120% 90% at 50% 42%, ${finish.swatch}66, ${finish.swatch}24 78%), linear-gradient(${finish.swatch}1a, ${finish.swatch}1a)`,
        }
    : undefined

  // Help + last-hand controls. On desktop they sit in the AppBar; on mobile
  // they move down to just above the community cards (see below).
  const tableControls = (
    <>
      {hasHistory && (
        <AppBarAction
          label="Last hand"
          onClick={() => {
            sound.play('tap')
            setHistoryOpen(true)
          }}
        >
          <History className="size-4" />
        </AppBarAction>
      )}
      <AppBarAction
        label="Hand rankings"
        onClick={() => {
          sound.play('tap')
          setHelpOpen(true)
        }}
      >
        <HelpCircle className="size-4" />
      </AppBarAction>
    </>
  )

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden" style={finishStyle}>
      {/* top bar — the shared AppBar; back confirms via the leave dialog */}
      <AppBar
        className="z-20"
        leading="back"
        backLabel="Venues"
        showWordmark={false}
        onBack={() => setLeaveOpen(true)}
        title={
          <>
            <span className="text-sm font-medium text-muted-foreground">{venue.name}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground/60">
              Blinds {smallBlind.toLocaleString()}/{bigBlind.toLocaleString()}
              {blindLevel > 0 && ` · L${blindLevel + 1}`}
            </span>
          </>
        }
        actions={isMobile ? undefined : tableControls}
      />

      {isMobile ? (
        /* ------------------------------ MOBILE ------------------------------ */
        <>
          {/* opponents + board drift toward the centre — slack splits evenly
              above, between, and below them */}
          <div className="relative flex min-h-0 flex-1 flex-col justify-evenly px-2 pb-2">
            <div className="flex items-start justify-evenly">
              {opponents.map((p) => {
                const meta = metaById.get(p.id)
                if (!meta) return null
                return (
                  <Seat
                    key={p.id}
                    layout="row"
                    player={p}
                    name={meta.name}
                    avatarSpec={meta.avatar}
                    isDealer={p.id === buttonPlayerId}
                    isActive={activeId === p.id}
                    isThinking={aiThinkingId === p.id}
                    reveal={showdownReveal && p.status !== 'folded' && p.status !== 'out'}
                    cardsSide="right"
                    onSelect={() => selectSeat(p.id)}
                  />
                )
              })}
            </div>

            {/* board in the middle; talk on the left, pot on the right.
                Help + last-hand sit just above the board, aligned left. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1 px-2 text-muted-foreground">
                {tableControls}
              </div>
              {communityCards}
              <div className="flex items-end justify-between gap-3 px-2">
                <div className="min-w-0 flex-1">{talkLine}</div>
                <div className="flex shrink-0 items-baseline gap-2">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Pot
                  </span>
                  <CountUp
                    value={pot}
                    format={money}
                    className="text-2xl font-semibold tabular-nums"
                  />
                </div>
              </div>
            </div>

            {potWinners.map((id) =>
              chipsTo(
                id,
                id === 'hero' ? { left: '50%', top: '150%' } : { left: '50%', top: '10%' },
              ),
            )}
          </div>

          {/* actions */}
          <div className="px-3">{actionArea}</div>

          {/* hero: big fanned hole cards + a swipeable profile / odds panel */}
          {hero && heroMeta && (
            <div className="flex items-stretch gap-3 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+2.75rem)]">
              {/* cards and panel each get exactly half the row; cards align
                  with the left edge of the action buttons (pl offsets the
                  first card's tilt so its corner doesn't poke past) */}
              <div className="flex flex-1 basis-0 items-end justify-start pl-2">
                <HeroCards hero={hero} hand={hand} size="hero" fanned />
              </div>
              <HeroPanel
                hero={hero}
                avatar={heroMeta.avatar}
                hand={hand}
                equity={heroEquity}
                isButton={hero.id === buttonPlayerId}
                isActive={activeId === hero.id}
              />
            </div>
          )}
        </>
      ) : (
        /* ------------------------------ DESKTOP ----------------------------- */
        <>
          {/* table surface + seats */}
          <div className="relative flex-1">
            {opponents.map((p, i) => {
              const meta = metaById.get(p.id)
              if (!meta) return null
              return (
                <div
                  key={p.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={positions[i]}
                >
                  <Seat
                    player={p}
                    name={meta.name}
                    avatarSpec={meta.avatar}
                    isDealer={p.id === buttonPlayerId}
                    isActive={activeId === p.id}
                    isThinking={aiThinkingId === p.id}
                    reveal={showdownReveal && p.status !== 'folded' && p.status !== 'out'}
                    cardsSide={parseFloat(positions[i].left) > 50 ? 'left' : 'right'}
                    onSelect={() => selectSeat(p.id)}
                  />
                </div>
              )
            })}

            <div className="absolute left-1/2 top-[62%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4">
              {communityCards}
              <div className="flex w-full items-end justify-between gap-6">
                <div className="min-w-0 flex-1">{talkLine}</div>
                <div className="flex shrink-0 items-baseline gap-2">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Pot
                  </span>
                  <CountUp
                    value={pot}
                    format={money}
                    className="text-3xl font-semibold tabular-nums"
                  />
                </div>
              </div>
            </div>

            {potWinners.map((id) => {
              const idx = opponents.findIndex((p) => p.id === id)
              const to: Point =
                id === 'hero'
                  ? { left: '50%', top: '118%' }
                  : idx >= 0
                    ? positions[idx]
                    : { left: '50%', top: '50%' }
              return chipsTo(id, to)
            })}
          </div>

          {/* hero zone */}
          {hero && heroMeta && (
            <div className="z-20 flex flex-col items-center gap-4 px-6 pb-8">
              <div className="flex items-stretch gap-6">
                <HeroCards hero={hero} hand={hand} size="board" />
                <div className="flex w-44">
                  <HeroPanel
                    hero={hero}
                    avatar={heroMeta.avatar}
                    hand={hand}
                    equity={heroEquity}
                    isButton={hero.id === buttonPlayerId}
                    isActive={activeId === hero.id}
                  />
                </div>
              </div>

              <div className="w-full max-w-xl">{actionArea}</div>
            </div>
          )}
        </>
      )}

      <HandsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <HandHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
      <LeaveDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        buyIn={venue.cash ? cashInvested : venue.buyIn}
        stack={hero?.stack ?? 0}
        freeroll={venue.freeroll === true}
        cash={venue.cash === true}
        onConfirm={cashOutAndLeave}
      />
      <PlayerDialog
        open={viewId !== null}
        onOpenChange={(o) => !o && setViewId(null)}
        seat={viewId ? (metaById.get(viewId) ?? null) : null}
        stack={hand.players.find((p) => p.id === viewId)?.stack ?? 0}
        stats={viewId ? seatStats[viewId] : undefined}
      />

      {/* overlays */}
      <AnimatePresence>
        {status === 'handover' && message && (
          <Banner key="ho">
            <span>{message}</span>
            {lastBounty > 0 && (
              <span className="text-xs font-medium opacity-95">Bounty +{money(lastBounty)}</span>
            )}
            {newAwards.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5 text-xs font-medium opacity-95">
                <AwardChip award={a} earned size={18} />
                New chip — {a.name}
              </span>
            ))}
          </Banner>
        )}
        {status === 'busted' &&
          (venue.cash ? (
            // Cash tables: busting isn't the end. Rebuy from your Roll and sit
            // straight back down, drop to the freeroll if you can't afford it,
            // or just stand up. No "you finished Nth" — there's no tournament.
            <EndOverlay
              key="bust-cash"
              title="Out of chips"
              subtitle="The table’s still running — buy back in, or call it a session."
              onHome={goHome}
              primaryLabel={
                freerollOpen(roll)
                  ? 'Play the freeroll'
                  : roll >= venue.buyIn
                    ? `Rebuy — ${money(venue.buyIn)}`
                    : undefined
              }
              onPrimary={
                freerollOpen(roll)
                  ? () => {
                      sound.play('call')
                      leave()
                      router.push(`/play/${KITCHEN_TABLE.id}`)
                    }
                  : roll >= venue.buyIn
                    ? () => {
                        sound.play('call')
                        rebuy()
                      }
                    : undefined
              }
            />
          ) : (
            <EndOverlay
              key="bust"
              title="Knocked out"
              subtitle={place ? `You finished ${ordinal(place)}` : 'Out of the tournament'}
              onHome={goHome}
              primaryLabel={freerollOpen(roll) ? 'Play the freeroll' : undefined}
              onPrimary={
                freerollOpen(roll)
                  ? () => {
                      sound.play('call')
                      if (venue.freeroll && heroMeta) {
                        // Already on the freeroll route — navigation would no-op
                        // and blank the table. Re-seat in place instead.
                        useGame
                          .getState()
                          .sitDown(KITCHEN_TABLE, { name: heroMeta.name, avatar: heroMeta.avatar })
                      } else {
                        leave()
                        router.push(`/play/${KITCHEN_TABLE.id}`)
                      }
                    }
                  : undefined
              }
            />
          ))}
        {status === 'won' && (
          <EndOverlay
            key="won"
            title="Champion"
            subtitle={`You took it down — +${money(venue.prize + lastBounty)} to your Roll`}
            detail={
              newAwards.length > 0 && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  {newAwards.map((a) => (
                    <span key={a.id} className="flex items-center gap-2 text-sm text-white/80">
                      <AwardChip award={a} earned size={22} />
                      New chip — {a.name}
                    </span>
                  ))}
                </div>
              )
            }
            onHome={goHome}
            celebrate
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// --- seat -------------------------------------------------------------------

function Seat({
  player,
  name,
  avatarSpec,
  isDealer,
  isActive,
  isThinking,
  reveal,
  cardsSide,
  onSelect,
  layout = 'arc',
}: {
  player: Player
  name: string
  avatarSpec: AvatarSpec
  isDealer: boolean
  isActive: boolean
  isThinking: boolean
  reveal: boolean
  cardsSide: 'left' | 'right'
  onSelect: () => void
  layout?: 'arc' | 'row'
}) {
  const folded = player.status === 'folded'
  const money = useMoney()
  const row = layout === 'row'
  const avatarSize = row ? 48 : 52
  const dealerSide = row ? '-right-1' : cardsSide === 'right' ? '-left-1' : '-right-1'

  return (
    <div className={cn('flex flex-col items-center', row ? 'w-16 gap-0.5' : 'w-20 gap-1')}>
      <div className="relative">
        <motion.button
          onClick={onSelect}
          aria-label={`About ${name}`}
          animate={isActive ? { scale: 1.08 } : { scale: 1 }}
          className={cn(
            'rounded-full transition hover:brightness-110',
            isActive && 'ring-2 ring-foreground/80',
          )}
        >
          <PlayerAvatar spec={avatarSpec} size={avatarSize} dimmed={folded} />
        </motion.button>
        {isDealer && !folded && (
          <span
            className={cn(
              'absolute -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground',
              dealerSide,
            )}
          >
            D
          </span>
        )}
        {isThinking && (
          <span className="absolute -top-2.5 left-1/2 size-3 -translate-x-1/2">
            <span className="absolute inset-0 animate-ping rounded-full bg-pip/70" />
            <span className="absolute inset-0 rounded-full bg-pip ring-2 ring-background" />
          </span>
        )}
        <AnimatePresence>
          {folded && (
            <motion.div
              initial={{ opacity: 0, scale: 1.9, rotate: -18 }}
              animate={{ opacity: 1, scale: 1, rotate: -9 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 16 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span className="rounded-md bg-background/70 px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground backdrop-blur-[1px]">
                fold
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* arc: revealed cards fanned beside the avatar */}
        {!row && reveal && player.hole.length === 2 && (
          <div
            className={cn(
              'absolute top-1/2 flex -translate-y-1/2 -space-x-1.5',
              cardsSide === 'right' ? 'left-[42px]' : 'right-[42px] flex-row-reverse',
            )}
          >
            {player.hole.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.7, x: cardsSide === 'right' ? -18 : 18 }}
                animate={{ opacity: 1, scale: 1, x: 0, rotate: i === 0 ? -7 : 8 }}
                transition={{ type: 'spring', stiffness: 340, damping: 18, delay: 0.14 + i * 0.1 }}
              >
                <PlayingCard card={card} size="xs" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <span
        className={cn(
          'max-w-full truncate',
          row ? 'text-[11px]' : 'text-xs',
          folded ? 'text-muted-foreground/50' : 'text-muted-foreground',
        )}
      >
        {name}
      </span>
      <span
        className={cn(
          'font-semibold tabular-nums',
          row ? 'text-xs' : 'text-sm',
          folded && 'text-muted-foreground/50',
        )}
      >
        {money(player.stack)}
      </span>
      {/* Reserve the bet-chip slot always, so a bet appearing/clearing never
          changes the seat's height (which would nudge the board via the
          justify-evenly column on mobile). */}
      <span className="flex h-[18px] items-center justify-center">
        {player.committedThisStreet > 0 && (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium tabular-nums">
            {money(player.committedThisStreet)}
          </span>
        )}
      </span>

      {/* row: revealed cards below the seat */}
      {row && reveal && player.hole.length === 2 && (
        <div className="mt-0.5 flex gap-0.5">
          {player.hole.map((card, i) => (
            <PlayingCard key={i} card={card} size="xs" />
          ))}
        </div>
      )}
    </div>
  )
}

// --- hero bits --------------------------------------------------------------

function HeroCards({
  hero,
  hand,
  size,
  fanned = false,
}: {
  hero: Player
  hand: HandState
  size: CardSize
  fanned?: boolean
}) {
  const folded = hero.status === 'folded'
  const nickname = nicknameFor(hero.hole)
  return (
    <div className={cn('flex flex-col items-center gap-1.5', folded && 'opacity-40')}>
      <div className={cn('flex items-end', fanned ? '-space-x-6' : 'gap-2')}>
        {hero.hole.map((card, i) => (
          // Key by the card so a new deal re-mounts and replays the animation.
          <DealtCard
            key={`${card.rank}${card.suit}`}
            index={i}
            card={card}
            size={size}
            className={cn(
              fanned && (i === 0 ? '-rotate-3' : 'translate-y-1 rotate-2'),
              // A dimmed (opacity-40) rounded card with a drop shadow renders a
              // bright halo along its bottom edge on iOS Safari — the shadow
              // inverts under fractional opacity. Folded cards don't need a
              // shadow anyway, so drop it and the artifact goes with it.
              folded && 'shadow-none dark:shadow-none',
            )}
          />
        ))}
        <span className="sr-only">{hand.street}</span>
      </div>
      {nickname && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[11px] text-muted-foreground/70"
        >
          {nickname}
        </motion.span>
      )}
    </div>
  )
}

function useHandLabel(hero: Player, hand: HandState) {
  return useMemo(() => {
    if (hero.hole.length < 2) return null
    if (hero.hole.length + hand.community.length < 5) return nicknameFor(hero.hole) ?? 'Hole cards'
    try {
      return evaluateHand(hero.hole, hand.community).name
    } catch {
      return null
    }
  }, [hero.hole, hand.community])
}

/** Mobile hero panel — swipe or tap the dots to flip between profile and odds. */
function HeroPanel({
  hero,
  avatar,
  hand,
  equity,
  isButton,
  isActive,
}: {
  hero: Player
  avatar: AvatarSpec
  hand: HandState
  equity: number | null
  isButton: boolean
  isActive: boolean
}) {
  const money = useMoney()
  const label = useHandLabel(hero, hand)
  const folded = hero.status === 'folded'
  const [page, setPage] = useState(0)

  return (
    <div className="relative flex min-h-[90px] min-w-0 flex-1 basis-0 flex-col items-center justify-center overflow-hidden rounded-2xl bg-foreground/[0.04]">
      <motion.div
        className="flex size-full items-center justify-center pb-3"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.x < -28) setPage(1)
          else if (info.offset.x > 28) setPage(0)
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {page === 0 ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none flex flex-col items-center gap-0.5"
            >
              <div className="relative">
                <div className={cn('rounded-full', isActive && 'ring-2 ring-foreground/80')}>
                  <PlayerAvatar spec={avatar} size={36} dimmed={folded} />
                </div>
                {isButton && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    D
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold tabular-nums">{money(hero.stack)}</span>
              {hero.committedThisStreet > 0 && (
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium tabular-nums">
                  {money(hero.committedThisStreet)}
                </span>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="odds"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none flex flex-col items-center"
            >
              <span className="text-[11px] text-muted-foreground">{label ?? '—'}</span>
              <span className="text-2xl font-semibold tabular-nums">
                {equity !== null ? `${Math.round(equity * 100)}%` : '—'}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                win
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="absolute bottom-1.5 flex gap-1.5">
        {[0, 1].map((i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            aria-label={i === 0 ? 'Show profile' : 'Show odds'}
            className={cn(
              'size-1.5 rounded-full transition',
              page === i ? 'bg-foreground/70' : 'bg-foreground/25',
            )}
          />
        ))}
      </div>
    </div>
  )
}

// --- chrome -----------------------------------------------------------------

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="pointer-events-none absolute inset-x-0 top-1/3 z-30 flex justify-center"
    >
      <span className="flex flex-col items-center gap-0.5 rounded-3xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-2xl">
        {children}
      </span>
    </motion.div>
  )
}

function EndOverlay({
  title,
  subtitle,
  detail,
  onHome,
  celebrate = false,
  primaryLabel,
  onPrimary,
}: {
  title: string
  subtitle: string
  detail?: React.ReactNode
  onHome: () => void
  celebrate?: boolean
  primaryLabel?: string
  onPrimary?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black/85 px-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        className="text-center"
      >
        {/* The overlay is always dark, so text is white regardless of theme. */}
        <h2
          className={cn(
            'text-5xl font-semibold tracking-tight sm:text-6xl',
            celebrate ? 'text-pip' : 'text-white',
          )}
        >
          {title}
        </h2>
        <p className="mt-3 text-white/60">{subtitle}</p>
        {detail}
      </motion.div>
      <div className="flex flex-col items-center gap-3">
        {primaryLabel && onPrimary && (
          <button
            onClick={onPrimary}
            className="rounded-2xl bg-white px-8 py-3.5 font-semibold text-black transition hover:bg-white/90 active:scale-[0.98]"
          >
            {primaryLabel}
          </button>
        )}
        <button
          onClick={onHome}
          className={cn(
            primaryLabel
              ? 'text-sm text-white/60 transition hover:text-white'
              : 'rounded-2xl bg-white px-8 py-3.5 font-semibold text-black transition hover:bg-white/90 active:scale-[0.98]',
          )}
        >
          Back to venues
        </button>
      </div>
    </motion.div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
