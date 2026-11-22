'use client'

// `/game/friends`: your friends, your inbox and finding people (docs/social.md).
//
// Three tabs. Friends: requests waiting on you, your friends, requests you sent,
// and anyone you've blocked. Inbox: friend requests, challenges and table
// invites, newest first, marked read as you look. Find: search by handle or name.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
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
import { cn } from '@/lib/utils'
import { useRoom } from '@/store/room'
import { useSocial } from '@/store/social'
import { useSync } from '@/store/sync'
import { ChallengeDialog } from './ChallengeDialog'
import { Face, List, PersonRow, profileHref, RowButton, SectionLabel } from './parts'
import { ProfileEditor } from './ProfileEditor'

type Tab = 'friends' | 'inbox' | 'find'

const TABS: { value: Tab; label: string }[] = [
  { value: 'friends', label: 'Friends' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'find', label: 'Find' },
]

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
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3">
          <Link
            href={profileHref(me.handle)}
            className="flex min-w-0 flex-1 basis-40 items-center gap-3"
          >
            <Face avatar={me.avatar} ring={me.ring} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{me.name}</span>
              <span className="block truncate text-xs text-muted-foreground">@{me.handle}</span>
            </span>
          </Link>
          <RowButton
            onClick={() => {
              sound.play('tap')
              setEditing(true)
            }}
          >
            Edit profile
          </RowButton>
        </div>
        <Tabs tab={tab} unread={unread} onPick={setTab} />
        {tab === 'friends' ? <FriendsTab /> : tab === 'inbox' ? <InboxTab /> : <FindTab />}
      </>
    )
  }

  return (
    <PageShell leading="back" backLabel="Back" onBack={() => router.push('/game')}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
        {body()}
      </div>
      <ProfileEditor open={editing} onOpenChange={setEditing} />
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

// --- friends ------------------------------------------------------------------

function FriendsTab() {
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [blocks, setBlocks] = useState<Blocked[]>([])
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [challenging, setChallenging] = useState<PlayerRow | null>(null)

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

  const act = async (handle: string, run: () => Promise<unknown>) => {
    sound.play('tap')
    setBusy(handle)
    await run()
    setBusy(null)
    load()
  }

  if (failed && !friends) {
    return <p className="text-sm text-muted-foreground">Couldn’t reach Pip. Try again later.</p>
  }
  if (!friends) return <Skeleton />

  const received = friends.filter((f) => f.status === 'received')
  const mine = friends.filter((f) => f.status === 'friends')
  const sent = friends.filter((f) => f.status === 'sent')

  return (
    <div className="flex flex-col gap-5">
      {received.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Requests</SectionLabel>
          <List>
            {received.map((f) => (
              <PersonRow key={f.handle} person={f}>
                <RowButton
                  primary
                  disabled={busy === f.handle}
                  onClick={() => void act(f.handle, () => answerFriend(f.handle, true))}
                >
                  Accept
                </RowButton>
                <RowButton
                  disabled={busy === f.handle}
                  onClick={() => void act(f.handle, () => answerFriend(f.handle, false))}
                >
                  Decline
                </RowButton>
              </PersonRow>
            ))}
          </List>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>Friends</SectionLabel>
        {mine.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">
            No friends yet. Find people by their handle in Find.
          </p>
        ) : (
          <List>
            {mine.map((f) => (
              <PersonRow key={f.handle} person={f}>
                <RowButton
                  primary
                  onClick={() => {
                    sound.play('tap')
                    setChallenging(f)
                  }}
                >
                  Challenge
                </RowButton>
              </PersonRow>
            ))}
          </List>
        )}
      </section>

      {sent.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Sent</SectionLabel>
          <List>
            {sent.map((f) => (
              <PersonRow key={f.handle} person={f}>
                <RowButton
                  disabled={busy === f.handle}
                  onClick={() => void act(f.handle, () => removeFriend(f.handle))}
                >
                  Cancel
                </RowButton>
              </PersonRow>
            ))}
          </List>
        </section>
      )}

      {blocks.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Blocked</SectionLabel>
          <List>
            {blocks.map((b) => (
              <li key={b.userId} className="flex min-h-14 flex-wrap items-center gap-3 px-3 py-2">
                <Face avatar={b.avatar} size={36} />
                <span className="min-w-0 flex-1 basis-32 truncate text-sm">
                  {b.name ?? 'Someone from a table'}
                  {b.handle && <span className="ml-1.5 text-muted-foreground">@{b.handle}</span>}
                </span>
                <RowButton
                  disabled={busy === b.userId}
                  onClick={() => void act(b.userId, () => unblockPlayer(b.userId))}
                >
                  Unblock
                </RowButton>
              </li>
            ))}
          </List>
        </section>
      )}

      <ChallengeDialog friend={challenging} onClose={() => setChallenging(null)} />
    </div>
  )
}

// --- inbox --------------------------------------------------------------------

function ago(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

const NOTICE_TEXT: Record<Notice['kind'], (n: Notice) => string> = {
  'friend-request': () => 'sent you a friend request',
  'friend-accepted': () => 'accepted your friend request',
  challenge: (n) => (n.slow ? 'challenged you to a slow game' : 'challenged you to a game'),
  invite: (n) => (n.slow ? 'invited you to a slow game' : 'invited you to their table'),
}

function InboxTab() {
  const router = useRouter()
  const notices = useSocial((s) => s.notices)
  const [answered, setAnswered] = useState<Record<string, Relation>>({})
  // Read when you look, all of them. The badge clears as the tab opens.
  const [now] = useState(() => Date.now())
  useEffect(() => {
    if (!notices?.some((n) => !n.read)) return
    const t = setTimeout(() => useSocial.getState().markRead(), 600)
    return () => clearTimeout(t)
  }, [notices])

  if (!notices) return <Skeleton />
  if (notices.length === 0) {
    return <p className="px-1 text-sm text-muted-foreground">Nothing yet.</p>
  }

  const answer = async (handle: string, accept: boolean) => {
    sound.play('tap')
    const r = await answerFriend(handle, accept)
    if (r.ok) setAnswered((a) => ({ ...a, [handle]: r.value }))
  }

  const join = (code: string) => {
    sound.play('call')
    useRoom.getState().enter(code)
    router.push(`/game/room?code=${code}`)
  }

  return (
    <List>
      {notices.map((n) => (
        <li
          key={n.id}
          className={cn(
            'flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5',
            !n.read && 'bg-pip/[0.06]',
          )}
        >
          <Link
            href={profileHref(n.from.handle)}
            className="flex min-w-0 flex-1 basis-48 items-center gap-3"
          >
            <Face avatar={n.from.avatar} ring={n.from.ring} size={40} />
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{n.from.name}</span> {NOTICE_TEXT[n.kind](n)}
              <span className="block text-xs text-muted-foreground">{ago(n.at, now)}</span>
            </span>
          </Link>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {n.kind === 'friend-request' &&
              (answered[n.from.handle] ? (
                <span className="text-sm text-muted-foreground">
                  {answered[n.from.handle] === 'friends' ? 'Friends' : 'Declined'}
                </span>
              ) : (
                <>
                  <RowButton primary onClick={() => void answer(n.from.handle, true)}>
                    Accept
                  </RowButton>
                  <RowButton onClick={() => void answer(n.from.handle, false)}>Decline</RowButton>
                </>
              ))}
            {(n.kind === 'challenge' || n.kind === 'invite') && n.code && (
              <RowButton primary onClick={() => join(n.code as string)}>
                Join
              </RowButton>
            )}
          </span>
        </li>
      ))}
    </List>
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
    setResults((rs) =>
      rs ? rs.map((p) => (p.handle === handle ? { ...p, relation: r.value } : p)) : rs,
    )
  }

  const short = query.trim().replace(/^@/, '').length < 2

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-xl border border-foreground/15 bg-foreground/[0.03] px-3 focus-within:border-foreground/40">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Handle or name"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search players"
          className="min-w-0 flex-1 bg-transparent py-2.5 outline-none"
        />
      </label>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
      {short ? null : !results ? (
        <Skeleton />
      ) : results.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Nobody by that name.</p>
      ) : (
        <List>
          {results.map((p) => (
            <PersonRow key={p.handle} person={p}>
              {p.relation === 'friends' ? (
                <span className="text-sm text-muted-foreground">Friends</span>
              ) : p.relation === 'sent' ? (
                <span className="text-sm text-muted-foreground">Requested</span>
              ) : (
                <RowButton primary disabled={busy === p.handle} onClick={() => void add(p.handle)}>
                  {p.relation === 'received' ? 'Accept' : 'Add'}
                </RowButton>
              )}
            </PersonRow>
          ))}
        </List>
      )}
    </div>
  )
}
