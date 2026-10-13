'use client'

// `/game/multiplayer`: one form to a table with people at it.
//
// Pick how (with friends, or quick match), pick the stake, press the one
// button. The stake's venue painting fills the top and changes as you pick,
// so the choice reads as a place you are about to sit rather than a number.
// Underneath, six boxes take a friend's code and go the moment it is whole.
//
// Opening a room and quick match come with the membership. Joining a friend's
// room needs only a free account, so a member's game is never short of people
// because their friends have not paid (Will, 2026-10-11). Like the table
// builder, the page is the same for everybody: you cannot want what you cannot
// see.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Lock, Star, Users, Video, Zap } from 'lucide-react'
import { AccountDialog } from '@/components/settings/AccountDialog'
import { PageShell } from '@/components/PageShell'
import { Splash } from '@/components/Splash'
import { CategoryArt } from '@/components/menu/CategoryArt'
import { VenueArt } from '@/components/menu/VenueArt'
import { membershipFor } from '@/config/membership'
import { VENUES, type Venue } from '@/config/venues'
import { DEFAULT_ROOM_SEATS, DEFAULT_SETTINGS, type RoomSettings } from '@/lib/multiplayer/room'
import { CODE_ALPHABET, CODE_LENGTH, normaliseRoomCode } from '@/lib/multiplayer/code'
import { createRoom, devMember, devSignedIn, roomsConfigured } from '@/lib/multiplayer/client'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { useMoney } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { cn } from '@/lib/utils'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { useQueue } from '@/store/queue'
import { useRoom } from '@/store/room'
import { useSync } from '@/store/sync'
import { SettingsList } from './RoomSettings'

type Mode = 'friends' | 'quick'

const ERRORS: Record<string, string> = {
  auth: 'Sign in again to play.',
  'members-only': 'This comes with the membership.',
  offline: 'Couldn’t reach the tables. Check your connection and try again.',
  busy: 'Couldn’t open a room just now. Try again in a moment.',
  closed: 'Lost the connection. Try again.',
}

const SPRING = { type: 'spring', stiffness: 420, damping: 34 } as const

export function MultiplayerHub() {
  const hydrated = useHydrated()
  const router = useRouter()
  const money = useMoney()
  const member = useEntitlement() || devMember()
  const spendable = useSpendableRoll()
  const signedIn = useSync((s) => s.status === 'signed-in') || devSignedIn()
  const queue = useQueue()
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountMode, setAccountMode] = useState<'signin' | 'signup'>('signup')
  const [mode, setMode] = useState<Mode>('friends')
  const affordable = VENUES.filter((v) => v.buyIn <= spendable)
  const [stakeId, setStakeId] = useState<string>(() => affordable[0]?.id ?? VENUES[0].id)
  const [settings, setSettings] = useState<RoomSettings>({
    ...DEFAULT_SETTINGS,
    seats: DEFAULT_ROOM_SEATS,
  })
  const [creating, setCreating] = useState(false)
  const [opening, setOpening] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Matched: straight to the table. The tap on "Find a table" was the one that
  // seats you, so there is no second Join to press while the deal waits.
  const matched = queue.state === 'matched' ? queue.matchedCode : null
  useEffect(() => {
    if (!matched) return
    useQueue.getState().leave()
    useRoom.getState().enter(matched)
    router.push(`/game/room?code=${matched}`)
  }, [matched, router])

  if (!hydrated || matched) return <Splash />

  if (!roomsConfigured()) {
    return (
      <PageShell leading="back">
        <p className="py-16 text-center text-muted-foreground">
          Multiplayer isn’t switched on in this version.
        </p>
      </PageShell>
    )
  }

  const stake = VENUES.find((v) => v.id === stakeId) ?? VENUES[0]
  const queuing = queue.state === 'joining' || queue.state === 'waiting'
  // A room for fun takes nothing from the Roll, so any stake will do.
  const free = mode === 'friends' && !settings.forRoll
  const affords = (v: Venue) => free || v.buyIn <= spendable
  const canPlay = signedIn && member && affords(stake)

  const seat = () => {
    const { name, avatar, avatarRing } = useProfile.getState()
    return {
      name,
      avatar: avatar ?? { seed: name || 'pip', backgroundColor: 'b6e3f4' },
      ring: avatarRing,
    }
  }

  const go = async () => {
    if (!canPlay || opening || queuing) return
    sound.play('call')
    setProblem(null)
    if (mode === 'quick') {
      queue.join(stake.id)
      return
    }
    setOpening(true)
    const result = await createRoom(stake.id, seat(), settings)
    setOpening(false)
    if ('error' in result) {
      setProblem(ERRORS[result.error] ?? ERRORS.busy)
      return
    }
    useRoom.getState().enter(result.code)
    router.push(`/game/room?code=${result.code}`)
  }

  const queueFailed = queue.state === 'failed' && queue.error

  // The stake only matters once you are choosing a table: creating a room, or
  // quick match. Joining a friend's room takes theirs.
  const choosing = mode === 'quick' || creating

  const stakePicker = (
    <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap [&::-webkit-scrollbar]:hidden">
      {VENUES.map((v: Venue) => {
        const can = affords(v)
        const on = v.id === stake.id
        return (
          <motion.button
            key={v.id}
            whileTap={can ? { scale: 0.94 } : undefined}
            onClick={() => {
              if (!can || queuing) return
              sound.play('tap')
              setStakeId(v.id)
            }}
            disabled={!can || queuing}
            className={cn(
              'shrink-0 snap-start rounded-full px-4 py-2.5 text-sm font-semibold tabular-nums transition',
              on
                ? 'bg-foreground text-background shadow-lg shadow-black/30'
                : 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.12]',
              !can && 'opacity-30',
            )}
          >
            {money(v.buyIn)}
          </motion.button>
        )
      })}
    </div>
  )

  const primary = queuing ? (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-foreground/[0.06] px-5 py-4">
      <span className="flex items-center gap-2.5 font-semibold">
        <Loader2 className="size-4 animate-spin" /> Finding a table
      </span>
      <button
        onClick={() => {
          sound.play('tap')
          queue.leave()
        }}
        className="text-sm text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
      >
        Stop
      </button>
    </div>
  ) : (
    <motion.button
      whileTap={canPlay ? { scale: 0.98 } : undefined}
      onClick={() => (signedIn ? void go() : setAccountOpen(true))}
      disabled={signedIn && (!member || !affords(stake) || opening)}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-black/20 transition hover:bg-primary/90 disabled:opacity-40"
    >
      {opening && <Loader2 className="size-4 animate-spin" />}
      {signedIn && !member && <Lock className="size-4" />}
      {!signedIn ? 'Sign in to play' : mode === 'friends' ? 'Open the room' : 'Find a table'}
    </motion.button>
  )

  return (
    <PageShell leading="back">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-10 pt-2 md:pt-6">
        {/* The picture: the stake's venue once you are choosing a table,
            the multiplayer table until then. */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-foreground/10 shadow-2xl shadow-black/40">
          <AnimatePresence initial={false}>
            <motion.div
              key={choosing ? stake.id : 'multiplayer'}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              {choosing ? (
                <VenueArt
                  id={stake.id}
                  accent={stake.accent}
                  className="absolute inset-0 size-full"
                />
              ) : (
                <CategoryArt
                  id="multiplayer"
                  accent="#F0B44C"
                  className="absolute inset-0 size-full"
                />
              )}
            </motion.div>
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 md:p-6">
            <div className="min-w-0">
              {choosing && (
                <p className="text-2xs font-medium uppercase tracking-[0.2em] text-white/70">
                  Multiplayer
                </p>
              )}
              <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight text-white md:text-4xl">
                {choosing ? stake.name : 'Multiplayer'}
              </h1>
            </div>
            {choosing && (
              <p className="shrink-0 text-right text-sm tabular-nums text-white/80">
                {free ? 'For fun' : `${money(stake.buyIn)} buy-in`}
              </p>
            )}
          </div>
        </div>

        {/* Three different pages in one: a member gets the whole form; somebody
            signed in without the membership can join a friend's room and is
            shown what hosting would take; somebody signed out is asked to sign
            in and shown nothing they could not use. */}
        {!signedIn ? (
          <GuestPanel
            onSignUp={() => {
              sound.play('tap')
              setAccountMode('signup')
              setAccountOpen(true)
            }}
            onSignIn={() => {
              sound.play('tap')
              setAccountMode('signin')
              setAccountOpen(true)
            }}
          />
        ) : !member ? (
          <>
            <JoinBox
              onComplete={(code) => {
                sound.play('call')
                router.push(`/game/room?code=${code}`)
              }}
            />
            <HostPanel />
          </>
        ) : (
          <>
            <Segmented
              value={mode}
              onChange={(m) => {
                sound.play('tap')
                setMode(m)
                setProblem(null)
              }}
              disabled={queuing}
            />

            {mode === 'friends' ? (
              <>
                {/* Joining first: it is what most people come here to do. */}
                <JoinBox
                  onComplete={(code) => {
                    sound.play('call')
                    router.push(`/game/room?code=${code}`)
                  }}
                />

                <div className="flex items-center gap-3 text-2xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="h-px flex-1 bg-foreground/10" />
                  or
                  <span className="h-px flex-1 bg-foreground/10" />
                </div>

                {creating ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="flex flex-col gap-5"
                  >
                    <SettingsList
                      settings={settings}
                      buyIn={stake.buyIn}
                      onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                      stakes={stakePicker}
                    />
                    {primary}
                    <button
                      onClick={() => {
                        sound.play('tap')
                        setCreating(false)
                      }}
                      className="-mt-2 text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      sound.play('tap')
                      setCreating(true)
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground/[0.08] py-4 text-base font-semibold transition hover:bg-foreground/[0.14]"
                  >
                    {signedIn && !member && <Lock className="size-4" />}
                    Create a room
                  </motion.button>
                )}
              </>
            ) : (
              <>
                {stakePicker}
                <div className="flex items-center justify-center gap-5 text-sm text-muted-foreground">
                  <Mark icon={<Users className="size-4" />}>{stake.seats} seats</Mark>
                  <Mark icon={<Zap className="size-4" />}>Dealt in fast</Mark>
                </div>
                {primary}
              </>
            )}
          </>
        )}

        {(problem || queueFailed) && (
          <p className="-mt-2 text-center text-sm text-suit-red">
            {problem ?? ERRORS[queue.error ?? 'closed'] ?? ERRORS.closed}
          </p>
        )}
      </div>
      <AccountDialog open={accountOpen} mode={accountMode} onOpenChange={setAccountOpen} />
    </PageShell>
  )
}

function JoinBox({ onComplete }: { onComplete: (code: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <p className="text-sm font-medium">Join a friend’s room</p>
      <CodeBoxes disabled={false} onComplete={onComplete} />
    </div>
  )
}

/** Signed out: one card, one thing to do. */
function GuestPanel({ onSignUp, onSignIn }: { onSignUp: () => void; onSignIn: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="relative isolate overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03] px-6 py-8 text-center"
    >
      <Glow />
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
        <Users className="size-5" />
      </span>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">Sign in to play multiplayer</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Play with your friends, cameras and voices on. A free account is all you need to join a
        friend’s room.
      </p>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onSignUp}
        className="mt-6 w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-black/20 transition hover:bg-primary/90"
      >
        Create a free account
      </motion.button>
      <button
        onClick={onSignIn}
        className="mt-3 text-sm text-muted-foreground transition hover:text-foreground"
      >
        I already have an account
      </button>
    </motion.div>
  )
}

const HOSTING = [
  { icon: Users, text: 'Open a room with your own rules' },
  { icon: Video, text: 'Camera and voice at the table' },
  { icon: Zap, text: 'Quick match at any stake' },
] as const

/** Signed in, not a member: joining is free, hosting is the membership. */
function HostPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
      className="relative isolate mt-2 overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-6"
    >
      <Glow />
      <span className="inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
        <Star className="size-3 fill-pip text-pip" />
        Pip Membership
      </span>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">Host your own table</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {HOSTING.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Icon className="size-4" />
            </span>
            {text}
          </li>
        ))}
      </ul>
      <Link
        href={membershipFor('multiplayer')}
        onClick={() => sound.play('tap')}
        className="mt-6 flex w-full items-center justify-center rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-black/20 transition hover:bg-primary/90 active:scale-[0.98]"
      >
        See the membership
      </Link>
      <p className="mt-3 text-center text-2xs text-muted-foreground">Your friends join free.</p>
    </motion.div>
  )
}

/** The membership's soft brand glow, behind a card. */
function Glow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-24 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pip)_22%,transparent),transparent_65%)] blur-2xl"
    />
  )
}

function Mark({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  )
}

/** Two choices and a highlight that slides between them. */
function Segmented({
  value,
  onChange,
  disabled,
}: {
  value: Mode
  onChange: (mode: Mode) => void
  disabled: boolean
}) {
  const options: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: 'friends', label: 'With friends', icon: <Video className="size-4" /> },
    { id: 'quick', label: 'Quick match', icon: <Zap className="size-4" /> },
  ]
  return (
    <div className="grid grid-cols-2 rounded-2xl bg-foreground/[0.05] p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => !disabled && value !== o.id && onChange(o.id)}
          disabled={disabled}
          aria-pressed={value === o.id}
          className={cn(
            'relative flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors',
            value === o.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {value === o.id && (
            <motion.span
              layoutId="multiplayer-mode"
              transition={SPRING}
              className="absolute inset-0 rounded-xl bg-foreground/[0.1] shadow-sm ring-1 ring-foreground/10"
            />
          )}
          <span className="relative flex items-center gap-2">
            {o.icon}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * Six boxes for a friend's code. One real input under them takes the typing
 * (and a paste, and the phone's own keyboard); the boxes only draw it. Letters
 * the codes never use are dropped as they are typed, and the sixth character
 * takes you to the table.
 */
function CodeBoxes({
  disabled,
  onComplete,
}: {
  disabled: boolean
  onComplete: (code: string) => void
}) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className={cn('relative', disabled && 'opacity-40')}>
      <input
        ref={input}
        value={value}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = e.target.value
            .toUpperCase()
            .split('')
            .filter((ch) => CODE_ALPHABET.includes(ch))
            .join('')
            .slice(0, CODE_LENGTH)
          setValue(next)
          const code = normaliseRoomCode(next)
          if (code) onComplete(code)
        }}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        spellCheck={false}
        aria-label="Room code"
        className="absolute inset-0 z-10 w-full cursor-text opacity-0"
      />
      <div className="flex gap-2" aria-hidden>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const ch = value[i]
          const current = focused && i === Math.min(value.length, CODE_LENGTH - 1)
          return (
            <motion.span
              key={i}
              animate={{ scale: ch ? 1 : 0.97 }}
              transition={SPRING}
              className={cn(
                'grid size-11 place-items-center rounded-xl bg-foreground/[0.05] font-mono text-xl font-semibold ring-1 transition md:size-12',
                current ? 'ring-2 ring-primary' : 'ring-foreground/10',
              )}
            >
              {ch ?? ''}
            </motion.span>
          )
        })}
      </div>
    </div>
  )
}
