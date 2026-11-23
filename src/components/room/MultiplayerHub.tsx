'use client'

// `/game/multiplayer`: one page to a table with people at it.
//
// The open tables come first: rooms their hosts opened to anybody, one tap to
// sit down (Will, 2026-11-23, in place of quick match, which never had enough
// people in the queue at once). Under them, six boxes take a friend's code and
// go the moment it is whole, and "Open a table" opens the form: who can join
// (anybody, or only friends with the code), the friends to invite, and the
// table's rules. The stake's venue painting fills the top and changes as you
// pick, so the choice reads as a place you are about to sit.
//
// Challenging a friend is this same form (`?with=<handle>`, from their profile
// or the Friends list): opened for the two of you, with them invited.
//
// Hosting as much as you like comes with the membership. Joining a friend's
// room needs only a free account, so a member's game is never short of people
// because their friends have not paid (Will, 2026-10-11). And anyone with an
// account can host one live room a week and one slow game at a time (Will,
// 2026-10-23 and 2026-10-25; the room weekly since 2026-11-18; the server counts them,
// `lib/multiplayer/freeRoom.ts`), on the same form a member gets. A room
// hosted that way has four seats at most and no camera or voice (Will,
// 2026-11-02; the server holds it, `FREE_ROOM_SEATS`): the seats past four
// show locked and lead to the membership. Like the
// table builder, the page is the same for everybody: you cannot want what you
// cannot see.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  Lock,
  Plus,
  Star,
  Users,
  Video,
  X,
} from 'lucide-react'
import { AccountDialog } from '@/components/settings/AccountDialog'
import { PageShell } from '@/components/PageShell'
import { Splash } from '@/components/Splash'
import { CategoryArt } from '@/components/menu/CategoryArt'
import { VenueArt } from '@/components/menu/VenueArt'
import { membershipFor } from '@/config/membership'
import { VENUES, type Venue } from '@/config/venues'
import {
  DEFAULT_ROOM_SEATS,
  DEFAULT_SETTINGS,
  FREE_ROOM_SEATS,
  type RoomSettings,
} from '@/lib/multiplayer/room'
import type { FreeLeft } from '@/lib/multiplayer/freeRoom'
import { CODE_ALPHABET, CODE_LENGTH, normaliseRoomCode } from '@/lib/multiplayer/code'
import {
  createRoom,
  devMember,
  devSignedIn,
  fetchFreeLeft,
  roomsConfigured,
} from '@/lib/multiplayer/client'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { useMoney } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { cn } from '@/lib/utils'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { useRoom } from '@/store/room'
import { useSocial } from '@/store/social'
import { type Friend, inviteFriends, myFriends, socialEnabled } from '@/lib/social/api'
import { FriendPickerDialog } from '@/components/social/FriendPickerDialog'
import { Face } from '@/components/social/parts'
import { useSync } from '@/store/sync'
import { YourGames } from '@/components/menu/YourGames'
import { LimitCard, type LimitKind } from '@/components/membership/LimitCard'
import { OpenTables } from './OpenTables'
import { SettingsList, settingsForPace } from './RoomSettings'

/** Who can sit down at a table being opened: anybody from the open tables, or friends with the code. */
type Who = 'anyone' | 'friends'

export const ROOM_ERRORS: Record<string, string> = {
  auth: 'Sign in again to play.',
  'members-only': 'This comes with the membership.',
  'free-room-used': 'Your free room this week is used. Opening another comes with the membership.',
  'free-slow-used':
    'You’re already hosting your free slow game. Hosting another comes with the membership.',
  'too-many': 'You’re in ten slow games already. Finish one first.',
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
  // A challenge from a friend's profile: the form open for the two of you.
  const challenging = useSearchParams().get('with')
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountMode, setAccountMode] = useState<'signin' | 'signup'>('signup')
  const affordable = VENUES.filter((v) => v.buyIn <= spendable)
  const [stakeId, setStakeId] = useState<string>(() => affordable[0]?.id ?? VENUES[0].id)
  const [settings, setSettings] = useState<RoomSettings>({
    ...DEFAULT_SETTINGS,
    seats: challenging ? 2 : DEFAULT_ROOM_SEATS,
  })
  const [slow, setSlow] = useState(false)
  const [creating, setCreating] = useState(Boolean(challenging))
  const [who, setWho] = useState<Who>(challenging ? 'friends' : 'anyone')
  const [invited, setInvited] = useState<string[]>(challenging ? [challenging] : [])
  const [picking, setPicking] = useState(false)
  // Your friends, for the invites. Asked for once the form is open.
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const askFriends = hydrated && signedIn && creating && socialEnabled()
  useEffect(() => {
    if (!askFriends) return
    let live = true
    void myFriends().then((r) => {
      if (live && r.ok) setFriends(r.value.filter((f) => f.status === 'friends'))
    })
    return () => {
      live = false
    }
  }, [askFriends])
  const [opening, setOpening] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // What is left of the free hosting, for somebody signed in without the
  // membership. Undefined until asked; if the asking fails it reads as all
  // left, and the server still refuses a second one.
  const [freeLeft, setFreeLeft] = useState<FreeLeft | undefined>(undefined)
  const askFree = hydrated && signedIn && !member && roomsConfigured()
  useEffect(() => {
    if (!askFree) return
    let live = true
    void fetchFreeLeft().then((left) => {
      if (live) setFreeLeft(left ?? { room: true, quick: true, slow: true })
    })
    return () => {
      live = false
    }
  }, [askFree])

  if (!hydrated) return <Splash />

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
  // A room for fun takes nothing from the Roll, so any stake will do.
  const free = !settings.forRoll
  const affords = (v: Venue) => free || v.buyIn <= spendable
  // A member hosts anything; anybody else, the free one of what they picked.
  const kindLeft = (k: keyof FreeLeft) => freeLeft?.[k] === true
  const picked: 'room' | 'slow' = slow ? 'slow' : 'room'
  const host = member || kindLeft(picked)
  // This week's free room spent: a card in place of the quiet button says so
  // (the slow game is one at a time, not one a week, so it keeps its line).
  const limit: LimitKind | null =
    !member && freeLeft !== undefined && picked !== 'slow' && !kindLeft(picked) ? picked : null
  // The friend being challenged, once the friends list says who they are.
  const rival = challenging ? friends?.find((f) => f.handle === challenging) : undefined
  const invitedFriends = invited
    .map((h) => friends?.find((f) => f.handle === h))
    .filter((f): f is Friend => f !== undefined)
  const canPlay = signedIn && host && affords(stake)
  // Without the membership a room has four seats at most; a pick past that
  // (the six it starts on) reads as four.
  const seatCap = member ? undefined : FREE_ROOM_SEATS
  const rules: RoomSettings =
    seatCap !== undefined && settings.seats > seatCap ? { ...settings, seats: seatCap } : settings

  const seat = () => {
    const { name, avatar, avatarRing } = useProfile.getState()
    return {
      name,
      avatar: avatar ?? { seed: name || 'pip', backgroundColor: 'b6e3f4' },
      ring: avatarRing,
    }
  }

  const go = async () => {
    if (!canPlay || opening) return
    sound.play('call')
    setProblem(null)
    setOpening(true)
    const result = await createRoom(
      stake.id,
      seat(),
      rules,
      slow ? 'slow' : 'private',
      who === 'anyone',
    )
    if ('error' in result) {
      setOpening(false)
      if (result.error === 'free-room-used' || result.error === 'free-slow-used') {
        const used = result.error === 'free-room-used' ? 'room' : 'slow'
        setFreeLeft((left) => left && { ...left, [used]: false })
      }
      setProblem(ROOM_ERRORS[result.error] ?? ROOM_ERRORS.busy)
      return
    }
    // The table is open either way; if the word doesn't reach them, the
    // lobby's invite link still does.
    if (invited.length > 0) {
      const kind = challenging && invited.includes(challenging) ? 'challenge' : 'invite'
      await inviteFriends(invited, kind, result.code, slow, stake.id)
    }
    useRoom.getState().enter(result.code)
    router.push(`/game/room?code=${result.code}`)
  }

  // The stake only matters once you are opening a table. Joining one takes theirs.
  const choosing = creating

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
              if (!can) return
              sound.play('tap')
              setStakeId(v.id)
            }}
            disabled={!can}
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

  const primary = (
    <motion.button
      whileTap={canPlay ? { scale: 0.98 } : undefined}
      onClick={() => (signedIn ? void go() : setAccountOpen(true))}
      disabled={signedIn && (!host || !affords(stake) || opening)}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-black/20 transition hover:bg-primary/90 disabled:opacity-40"
    >
      {opening && <Loader2 className="size-4 animate-spin" />}
      {signedIn && !host && <Lock className="size-4" />}
      {!signedIn
        ? 'Sign in to play'
        : rival && invited.includes(rival.handle)
          ? `Challenge ${rival.name}`
          : slow
            ? 'Open the game'
            : 'Open the table'}
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

        {/* Two pages in one: somebody signed in gets the whole form, with the
            free one of each marked for anybody without the membership and what
            the membership adds under it; somebody signed out is asked to sign
            in and shown nothing they could not use. */}
        {signedIn && <YourGames />}
        {signedIn && <FriendsLink />}

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
        ) : (
          <>
            {creating ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex flex-col gap-5"
              >
                <div className="divide-y divide-foreground/[0.07] overflow-hidden rounded-2xl bg-foreground/[0.04]">
                  <div className="flex flex-col gap-2 px-4 py-3">
                    <span className="text-sm font-medium">Who can join</span>
                    <WhoChoice
                      value={who}
                      onChange={(w) => {
                        sound.play('tap')
                        setWho(w)
                      }}
                    />
                  </div>
                  {socialEnabled() && (
                    <div className="flex flex-col gap-2 px-4 py-3">
                      <span className="text-sm font-medium">Invite friends</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {invitedFriends.map((f) => (
                          <span
                            key={f.handle}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground/[0.06] py-1 pr-1 pl-1"
                          >
                            <Face avatar={f.avatar} ring={f.ring} size={28} />
                            <span className="max-w-[9rem] truncate text-sm font-medium">
                              {f.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                sound.play('tap')
                                setInvited((p) => p.filter((h) => h !== f.handle))
                              }}
                              aria-label={`Don’t invite ${f.name}`}
                              className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/[0.08] hover:text-foreground"
                            >
                              <X className="size-3.5" />
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            sound.play('tap')
                            setPicking(true)
                          }}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-foreground/[0.06] px-4 text-sm font-medium transition hover:bg-foreground/[0.12]"
                        >
                          <Plus className="size-4" />
                          {invited.length > 0 ? 'More' : 'Pick friends'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <SettingsList
                  settings={rules}
                  seatCap={seatCap}
                  buyIn={stake.buyIn}
                  onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                  stakes={stakePicker}
                  slow={slow}
                  onPace={(pace) => {
                    setSlow(pace === 'slow')
                    setSettings((s) => settingsForPace(s, pace))
                  }}
                />
                {limit ? <LimitCard kind={limit} /> : primary}
                <button
                  onClick={() => {
                    sound.play('tap')
                    setCreating(false)
                    if (challenging) router.replace('/game/multiplayer')
                  }}
                  className="-mt-2 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  Cancel
                </button>
              </motion.div>
            ) : (
              <>
                <OpenTables />

                <JoinBox
                  onComplete={(code) => {
                    sound.play('call')
                    router.push(`/game/room?code=${code}`)
                  }}
                />

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    sound.play('tap')
                    setCreating(true)
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-black/20 transition hover:bg-primary/90"
                >
                  Open a table
                </motion.button>
                {limit && <LimitCard kind={limit} />}
              </>
            )}
            {!member && !limit && freeLeft !== undefined && !problem && (
              <p className="-mt-2 text-center text-sm text-muted-foreground">
                {freeLine(picked, kindLeft(picked))}
              </p>
            )}
            {!member && !limit && <HostPanel />}
          </>
        )}

        {problem && !limit && <p className="-mt-2 text-center text-sm text-suit-red">{problem}</p>}
      </div>
      <AccountDialog open={accountOpen} mode={accountMode} onOpenChange={setAccountOpen} />
      <FriendPickerDialog
        open={picking}
        onOpenChange={setPicking}
        friends={friends}
        picked={invited}
        onChange={setInvited}
      />
    </PageShell>
  )
}

function JoinBox({ onComplete }: { onComplete: (code: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <p className="text-sm font-medium">Join with a code</p>
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
      <h2 className="mt-4 hyphens-auto break-words text-2xl font-semibold tracking-tight text-balance">
        Sign in to play multiplayer
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Play with friends, or sit down at an open table. A free account joins any table and opens
        one of your own a week. Camera and voice come with a member’s room.
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

/** The line under the button for somebody without the membership: what is free, or that it is used. */
function freeLine(kind: 'room' | 'slow', left: boolean): string {
  if (kind === 'slow') {
    return left ? 'One free slow game at a time.' : 'You’re hosting your free slow game.'
  }
  return left ? 'One free room a week, up to 4 seats.' : 'Your free room this week is used.'
}

const HOSTING = [
  { icon: Users, text: 'Open a room whenever you like' },
  { icon: Video, text: 'Up to 8 seats, with camera and voice' },
  { icon: Clock, text: 'Up to ten slow games at once' },
] as const

/** Signed in, not a member: joining is free, one of each is free, the rest is the membership. */
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

/** Who can join: two choices and a highlight that slides between them. */
function WhoChoice({ value, onChange }: { value: Who; onChange: (who: Who) => void }) {
  const options: { id: Who; label: string; icon: React.ReactNode }[] = [
    { id: 'anyone', label: 'Anyone', icon: <Globe className="size-4" /> },
    { id: 'friends', label: 'Friends with the code', icon: <Users className="size-4" /> },
  ]
  return (
    <div className="grid grid-cols-2 rounded-xl bg-foreground/[0.05] p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => value !== o.id && onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            'relative flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] px-2 py-2 text-xs font-semibold transition-colors sm:text-sm',
            value === o.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {value === o.id && (
            <motion.span
              layoutId="multiplayer-who"
              transition={SPRING}
              className="absolute inset-0 rounded-[10px] bg-foreground/[0.1] shadow-sm ring-1 ring-foreground/10"
            />
          )}
          <span className="relative flex items-center gap-1.5 text-center">
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

/** Friends: see who's asked, or open a friend to challenge. Once friends are switched on. */
function FriendsLink() {
  const unread = useSocial((s) => s.unread)
  if (!socialEnabled()) return null
  return (
    <Link
      href="/game/friends"
      onClick={() => sound.play('tap')}
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 transition hover:bg-foreground/[0.06]"
    >
      <Users className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 font-medium">Friends</span>
      {unread > 0 && (
        <span className="rounded-full bg-primary px-2 text-xs font-semibold leading-5 text-primary-foreground tabular-nums">
          {unread}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
