'use client'

// `/game/friends`: your friends, your inbox and finding people (docs/social.md).
//
// Friends: a strip of faces to challenge in one tap, requests waiting on you,
// your friends, what you sent, and anyone you've blocked, tucked away. Inbox:
// games first, as cards with the table's picture, then requests, then the rest.
// Find: search by handle or name. On a wide screen the list sits on the left
// and the friend you pick stands on the right.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, ChevronRight, Search, Swords, UserPlus } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
import { VenueArt } from '@/components/menu/VenueArt'
import { VENUES } from '@/config/venues'
import {
  answerFriend,
  type Blocked,
  type Friend,
  myBlocks,
  myFriends,
  type Notice,
  type PlayerRow,
  type Relation,
  removeFriend,
  requestFriend,
  searchPlayers,
  socialEnabled,
  unblockPlayer,
} from '@/lib/social/api'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { useRoom } from '@/store/room'
import { useSocial } from '@/store/social'
import { useSync } from '@/store/sync'
import { ChallengeDialog } from './ChallengeDialog'
import { Face, profileHref, RowButton, SectionLabel } from './parts'
import { PlayerView } from './PlayerView'
import { ProfileDialog } from '@/components/profile/ProfileDialog'

type Tab = 'friends' | 'inbox' | 'find'

const TABS: { value: Tab; label: string }[] = [
  { value: 'friends', label: 'Friends' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'find', label: 'Find' },
]

const LIST = { hidden: {}, show: { transition: { staggerChildren: 0.035 } } }
const ROW = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } },
} as const

export function FriendsScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const hydrated = useHydrated()
  const signedIn = useSync((s) => s.status === 'signed-in')
  const ready = useSync((s) => s.ready)
  const me = useSocial((s) => s.me)
  const unread = useSocial((s) => s.unread)
  const [tab, setTab] = useState<Tab>(() => {
    const t = params.get('tab')
    return t === 'inbox' || t === 'find' ? t : 'friends'
  })
  const [editing, setEditing] = useState(false)
  // A wide screen shows the friend you pick beside the list.
  const wide = useMediaQuery('(min-width: 1280px)')
  const [picked, setPicked] = useState<string | null>(null)

  const body = () => {
    if (!socialEnabled()) {
      return <p className="text-sm text-muted-foreground">Friends aren’t open yet.</p>
    }
    if (!hydrated || !ready) return <Skeleton />
    if (!signedIn) {
      return (
        <Panel>
          <p className="text-sm">Make an account to add friends.</p>
          <Link
            href="/game?account=new"
            className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
          >
            Make an account
          </Link>
        </Panel>
      )
    }
    if (me === undefined) return <Skeleton />
    if (me === null) {
      return (
        <Panel>
          <p className="text-sm">Choose a handle so friends can find you.</p>
          <button
            type="button"
            onClick={() => {
              sound.play('tap')
              setEditing(true)
            }}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Make your profile
          </button>
        </Panel>
      )
    }
    return (
      <>
        <Tabs tab={tab} unread={unread} onPick={setTab} />
        {tab === 'friends' ? (
          <FriendsTab wide={wide} picked={picked} onPick={setPicked} />
        ) : tab === 'inbox' ? (
          <InboxTab />
        ) : (
          <FindTab />
        )}
      </>
    )
  }

  const side = wide && tab === 'friends' && me && picked

  return (
    <PageShell leading="back" backLabel="Back" onBack={() => router.push('/game')}>
      <div
        className={cn(
          'mx-auto grid w-full gap-8',
          side ? 'max-w-5xl grid-cols-[minmax(0,24rem)_minmax(0,1fr)]' : 'max-w-xl',
        )}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <header className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Friends</h1>
            {me && (
              <Link
                href={profileHref(me.handle)}
                onClick={() => sound.play('tap')}
                className="flex min-w-0 items-center gap-2 rounded-full py-1 pr-1 pl-3 text-sm text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
              >
                <span className="truncate">@{me.handle}</span>
                <Face avatar={me.avatar} ring={me.ring} size={32} />
              </Link>
            )}
          </header>
          {body()}
        </div>
        {side && (
          <div className="sticky top-6 self-start">
            <PlayerView key={picked} handle={picked} onGone={() => setPicked(null)} />
          </div>
        )}
      </div>
      <ProfileDialog open={editing} onOpenChange={setEditing} />
    </PageShell>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
      {children}
    </div>
  )
}

function Skeleton() {
  return (
    <ul className="flex flex-col gap-2" aria-busy>
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="h-16 animate-pulse rounded-2xl bg-foreground/[0.04]" />
      ))}
    </ul>
  )
}

function Tabs({ tab, unread, onPick }: { tab: Tab; unread: number; onPick: (t: Tab) => void }) {
  return (
    <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-foreground/[0.05] p-1">
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={tab === t.value}
          onClick={() => {
            sound.play('tap')
            onPick(t.value)
          }}
          className="relative min-h-10 rounded-xl px-1 text-sm font-medium transition"
        >
          {tab === t.value && (
            <motion.span
              layoutId="friends-tab"
              className="absolute inset-0 rounded-xl bg-foreground/[0.1] shadow-sm shadow-black/30"
              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            />
          )}
          <span className={cn('relative', tab !== t.value && 'text-muted-foreground')}>
            {t.label}
            {t.value === 'inbox' && unread > 0 && (
              <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-2xs font-semibold text-primary-foreground tabular-nums">
                {unread}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}

/** A grouped list: a hairline between rows, one rounded card around them. */
function Group({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {label && <SectionLabel>{label}</SectionLabel>}
      <motion.ul
        variants={LIST}
        initial="hidden"
        animate="show"
        className="flex flex-col divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.025]"
      >
        {children}
      </motion.ul>
    </section>
  )
}

/** A person: face and name, and whatever goes at the end. */
function Person({
  person,
  note,
  onOpen,
  active = false,
  children,
}: {
  person: PlayerRow
  note?: string
  /** On a wide screen, picking shows them beside the list rather than leaving it. */
  onOpen?: () => void
  active?: boolean
  children?: React.ReactNode
}) {
  const inner = (
    <>
      <Face avatar={person.avatar} ring={person.ring} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{person.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          @{person.handle}
          {note && ` · ${note}`}
        </span>
      </span>
    </>
  )
  const target = 'flex min-w-0 flex-1 basis-40 items-center gap-3 text-left'
  return (
    <motion.li
      variants={ROW}
      className={cn(
        'flex min-h-[4.25rem] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 transition',
        active ? 'bg-foreground/[0.07]' : 'hover:bg-foreground/[0.03]',
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            onOpen()
          }}
          className={target}
        >
          {inner}
        </button>
      ) : (
        <Link
          href={profileHref(person.handle)}
          onClick={() => sound.play('tap')}
          className={target}
        >
          {inner}
        </Link>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {children ?? <ChevronRight className="size-4 text-muted-foreground/60" />}
      </span>
    </motion.li>
  )
}

/** Accept, then a tick that springs in where the buttons were. */
function Answer({ handle, onDone }: { handle: string; onDone: (r: Relation) => void }) {
  const [state, setState] = useState<'ask' | 'busy' | Relation>('ask')
  const answer = async (accept: boolean) => {
    sound.play(accept ? 'win' : 'tap')
    setState('busy')
    const r = await answerFriend(handle, accept)
    const next = r.ok ? r.value : 'ask'
    setState(next)
    if (r.ok) onDone(r.value)
  }
  if (state === 'friends') {
    return (
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        className="flex items-center gap-1.5 text-sm font-medium text-emerald-400"
      >
        <Check className="size-4" /> Friends
      </motion.span>
    )
  }
  if (state === 'none') return <span className="text-sm text-muted-foreground">Declined</span>
  return (
    <>
      <RowButton primary disabled={state === 'busy'} onClick={() => void answer(true)}>
        Accept
      </RowButton>
      <RowButton disabled={state === 'busy'} onClick={() => void answer(false)}>
        Decline
      </RowButton>
    </>
  )
}

// --- friends ------------------------------------------------------------------

function FriendsTab({
  wide,
  picked,
  onPick,
}: {
  wide: boolean
  picked: string | null
  onPick: (handle: string | null) => void
}) {
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [blocks, setBlocks] = useState<Blocked[]>([])
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [challenging, setChallenging] = useState<PlayerRow | null>(null)
  const [showBlocked, setShowBlocked] = useState(false)

  const load = useCallback(() => {
    void myFriends().then((r) => {
      setFailed(!r.ok)
      if (r.ok) setFriends(r.value)
    })
    void myBlocks().then((r) => r.ok && setBlocks(r.value))
  }, [])

  useEffect(() => {
    const first = setTimeout(load, 0)
    return () => clearTimeout(first)
  }, [load])

  const mine = friends?.filter((f) => f.status === 'friends') ?? []
  // A wide screen starts on your first friend, so the right side is never empty.
  const first = mine[0]?.handle ?? null
  useEffect(() => {
    if (wide && !picked && first) onPick(first)
  }, [wide, picked, first, onPick])

  const act = async (key: string, run: () => Promise<unknown>) => {
    sound.play('tap')
    setBusy(key)
    await run()
    setBusy(null)
    load()
  }

  if (failed && !friends) {
    return <p className="text-sm text-muted-foreground">Couldn’t reach Pip. Try again later.</p>
  }
  if (!friends) return <Skeleton />

  const received = friends.filter((f) => f.status === 'received')
  const sent = friends.filter((f) => f.status === 'sent')

  return (
    <div className="flex flex-col gap-6">
      {mine.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionLabel>Challenge a friend</SectionLabel>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mine.map((f, i) => (
              <motion.button
                key={f.handle}
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 420, damping: 26 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  sound.play('tap')
                  setChallenging(f)
                }}
                className="group flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5"
              >
                <span className="relative">
                  <Face avatar={f.avatar} ring={f.ring} size={64} />
                  <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background transition group-hover:scale-110">
                    <Swords className="size-3.5" />
                  </span>
                </span>
                <span className="w-full truncate text-center text-xs font-medium">{f.name}</span>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {received.length > 0 && (
        <Group label="Requests">
          {received.map((f) => (
            <Person key={f.handle} person={f}>
              <Answer handle={f.handle} onDone={load} />
            </Person>
          ))}
        </Group>
      )}

      {mine.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[2rem] border border-dashed border-foreground/15 px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-foreground/[0.06]">
            <UserPlus className="size-5 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">
            No friends yet. Find people by their handle in Find.
          </p>
        </div>
      ) : (
        <Group label={`Friends · ${mine.length}`}>
          {mine.map((f) => (
            <Person
              key={f.handle}
              person={f}
              active={wide && picked === f.handle}
              onOpen={wide ? () => onPick(f.handle) : undefined}
            />
          ))}
        </Group>
      )}

      {sent.length > 0 && (
        <Group label="Sent">
          {sent.map((f) => (
            <Person key={f.handle} person={f} note="Requested">
              <RowButton
                disabled={busy === f.handle}
                onClick={() => void act(f.handle, () => removeFriend(f.handle))}
              >
                Cancel
              </RowButton>
            </Person>
          ))}
        </Group>
      )}

      {blocks.length > 0 && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              sound.play('tap')
              setShowBlocked((s) => !s)
            }}
            className="flex items-center gap-1.5 self-start px-1 text-2xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition hover:text-foreground"
          >
            Blocked · {blocks.length}
            <ChevronDown className={cn('size-3.5 transition', showBlocked && 'rotate-180')} />
          </button>
          <AnimatePresence initial={false}>
            {showBlocked && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.025]"
              >
                {blocks.map((b) => (
                  <li
                    key={b.userId}
                    className="flex min-h-14 flex-wrap items-center gap-3 px-3 py-2"
                  >
                    <Face avatar={b.avatar} size={36} />
                    <span className="min-w-0 flex-1 basis-32 truncate text-sm">
                      {b.name ?? 'Someone from a table'}
                      {b.handle && (
                        <span className="ml-1.5 text-muted-foreground">@{b.handle}</span>
                      )}
                    </span>
                    <RowButton
                      disabled={busy === b.userId}
                      onClick={() => void act(b.userId, () => unblockPlayer(b.userId))}
                    >
                      Unblock
                    </RowButton>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </section>
      )}

      <ChallengeDialog friend={challenging} onClose={() => setChallenging(null)} />
    </div>
  )
}

// --- inbox --------------------------------------------------------------------

function ago(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

/** A live room is gone long before this; a slow one keeps its seat for days. */
const LIVE_FOR_MS = 2 * 60 * 60 * 1000

function GameCard({ notice, now, index }: { notice: Notice; now: number; index: number }) {
  const router = useRouter()
  const venue = VENUES.find((v) => v.id === notice.venue) ?? VENUES[0]
  const live = !notice.slow && now - Date.parse(notice.at) < LIVE_FOR_MS
  const join = () => {
    if (!notice.code) return
    sound.play('call')
    useRoom.getState().enter(notice.code)
    router.push(`/game/room?code=${notice.code}`)
  }
  const what =
    notice.kind === 'challenge'
      ? notice.slow
        ? 'challenged you to a slow game'
        : 'challenged you'
      : notice.slow
        ? 'invited you to a slow game'
        : 'invited you to their table'
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 380, damping: 30 }}
      className={cn(
        'relative isolate overflow-hidden rounded-[1.5rem] border border-foreground/10 shadow-xl shadow-black/30',
        !notice.read && 'ring-1 ring-primary/40',
      )}
    >
      <VenueArt id={venue.id} accent={venue.accent} className="absolute inset-0 -z-10 size-full" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
        <Link
          href={profileHref(notice.from.handle)}
          className="flex min-w-0 flex-1 basis-52 items-center gap-3"
        >
          <span className="rounded-full ring-2 ring-white/20">
            <Face avatar={notice.from.avatar} ring={notice.from.ring} size={48} />
          </span>
          <span className="min-w-0 flex-1 text-white">
            <span className="block text-[0.9375rem] leading-snug">
              <span className="font-semibold">{notice.from.name}</span> {what}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-white/70">
              {live && (
                <span className="flex items-center gap-1 font-medium text-emerald-300">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" /> Live now
                </span>
              )}
              {live && <span>·</span>}
              <span>{venue.name}</span>
              <span>·</span>
              <span>{ago(notice.at, now)}</span>
            </span>
          </span>
        </Link>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={join}
          className="min-h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/30 transition hover:bg-primary/90"
        >
          Join
        </motion.button>
      </div>
    </motion.li>
  )
}

function InboxTab() {
  const notices = useSocial((s) => s.notices)
  const [now] = useState(() => Date.now())
  const loadNotices = useSocial((s) => s.loadNotices)
  // Read when you look, all of them. The badge clears as the tab opens.
  useEffect(() => {
    if (!notices?.some((n) => !n.read)) return
    const t = setTimeout(() => useSocial.getState().markRead(), 600)
    return () => clearTimeout(t)
  }, [notices])

  if (!notices) return <Skeleton />
  if (notices.length === 0) {
    return <p className="px-1 text-sm text-muted-foreground">Nothing yet.</p>
  }

  const games = notices.filter((n) => (n.kind === 'challenge' || n.kind === 'invite') && n.code)
  const requests = notices.filter((n) => n.kind === 'friend-request' && n.relation === 'received')
  const rest = notices.filter((n) => !games.includes(n) && !requests.includes(n))

  return (
    <div className="flex flex-col gap-6">
      {games.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionLabel>Games</SectionLabel>
          <ul className="flex flex-col gap-3">
            {games.map((n, i) => (
              <GameCard key={n.id} notice={n} now={now} index={i} />
            ))}
          </ul>
        </section>
      )}
      {requests.length > 0 && (
        <Group label="Friend requests">
          {requests.map((n) => (
            <Person key={n.id} person={n.from} note={ago(n.at, now)}>
              <Answer handle={n.from.handle} onDone={() => void loadNotices()} />
            </Person>
          ))}
        </Group>
      )}
      {rest.length > 0 && (
        <Group label="Earlier">
          {rest.map((n) => (
            <Person
              key={n.id}
              person={n.from}
              note={`${n.kind === 'friend-accepted' ? 'Accepted your request' : 'Now friends'} · ${ago(n.at, now)}`}
            />
          ))}
        </Group>
      )}
    </div>
  )
}

// --- find ---------------------------------------------------------------------

function FindTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<(PlayerRow & { relation: Relation })[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.replace(/^@/, '').length < 2) return
    let live = true
    const t = setTimeout(() => {
      void searchPlayers(q).then((r) => {
        if (!live) return
        setResults(r.ok ? r.value : [])
        setProblem(r.ok ? null : r.problem)
      })
    }, 250)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [query])

  const add = async (handle: string) => {
    sound.play('tap')
    setBusy(handle)
    const r = await requestFriend(handle)
    setBusy(null)
    if (!r.ok) {
      setProblem(r.problem)
      return
    }
    if (r.value === 'friends') sound.play('win')
    setResults((rs) =>
      rs ? rs.map((p) => (p.handle === handle ? { ...p, relation: r.value } : p)) : rs,
    )
  }

  const short = query.trim().replace(/^@/, '').length < 2

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2.5 rounded-2xl border border-foreground/10 bg-foreground/[0.05] px-4 transition focus-within:border-foreground/30 focus-within:bg-foreground/[0.07]">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Handle or name"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search players"
          className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-muted-foreground/70"
        />
      </label>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
      {short ? null : !results ? (
        <Skeleton />
      ) : results.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Nobody by that name.</p>
      ) : (
        <Group>
          {results.map((p) => (
            <Person key={p.handle} person={p}>
              {p.relation === 'friends' ? (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Check className="size-4" /> Friends
                </span>
              ) : p.relation === 'sent' ? (
                <span className="text-sm text-muted-foreground">Requested</span>
              ) : (
                <RowButton primary disabled={busy === p.handle} onClick={() => void add(p.handle)}>
                  {p.relation === 'received' ? 'Accept' : 'Add'}
                </RowButton>
              )}
            </Person>
          ))}
        </Group>
      )}
    </div>
  )
}
