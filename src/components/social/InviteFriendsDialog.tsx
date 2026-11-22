'use client'

// Invite friends to the room you're in: a push and an inbox note each, with a
// Join that opens this table (docs/social.md). The share link still works for
// anybody who isn't a friend on Pip.

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { type Friend, inviteFriends, myFriends } from '@/lib/social/api'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { Face } from './parts'

/** The most friends one invite goes to; the database holds the same number. */
const MAX_AT_ONCE = 8

export function InviteFriendsDialog({
  open,
  onOpenChange,
  code,
  slow,
  venue,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: string
  slow: boolean
  venue: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        {open && <Body code={code} slow={slow} venue={venue} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({ code, slow, venue }: { code: string; slow: boolean; venue: string }) {
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [sent, setSent] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void myFriends().then((r) => {
      if (!live) return
      setFailed(!r.ok)
      if (r.ok) {
        setFriends(r.value.filter((f) => f.status === 'friends'))
      }
    })
    return () => {
      live = false
    }
  }, [])

  const toggle = (handle: string) => {
    sound.play('tap')
    setPicked((p) =>
      p.includes(handle)
        ? p.filter((h) => h !== handle)
        : p.length < MAX_AT_ONCE
          ? [...p, handle]
          : p,
    )
  }

  const send = async () => {
    if (picked.length === 0 || sending) return
    sound.play('call')
    setSending(true)
    setProblem(null)
    const r = await inviteFriends(picked, 'invite', code, slow, venue)
    setSending(false)
    if (!r.ok) {
      setProblem(r.problem)
      return
    }
    setSent((s) => [...s, ...picked])
    setPicked([])
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Invite friends</DialogTitle>
      </DialogHeader>
      {failed && !friends ? (
        <p className="text-sm text-muted-foreground">Couldn’t reach Pip. Try again later.</p>
      ) : !friends ? (
        <div className="h-40 animate-pulse rounded-2xl bg-foreground/[0.04]" aria-busy />
      ) : friends.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No friends to invite yet. Add them in Friends, or share the link.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl border border-foreground/10">
          {friends.map((f) => {
            const done = sent.includes(f.handle)
            const on = picked.includes(f.handle)
            return (
              <li key={f.handle}>
                <button
                  type="button"
                  disabled={done}
                  aria-pressed={on}
                  onClick={() => toggle(f.handle)}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition',
                    on ? 'bg-primary/10' : 'hover:bg-foreground/[0.04]',
                  )}
                >
                  <Face avatar={f.avatar} ring={f.ring} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{f.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{f.handle}
                    </span>
                  </span>
                  {done ? (
                    <span className="text-sm text-muted-foreground">Invited</span>
                  ) : (
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full border',
                        on
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-foreground/25',
                      )}
                    >
                      {on && <Check className="size-4" />}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {problem && <p className="text-sm text-destructive">{problem}</p>}
      {friends && friends.length > 0 && (
        <button
          type="button"
          onClick={() => void send()}
          disabled={picked.length === 0 || sending}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground transition hover:bg-primary/85 active:scale-[0.98] disabled:opacity-50"
        >
          {sending && <Loader2 className="size-4 animate-spin" />}
          {picked.length > 1 ? `Invite ${picked.length}` : 'Invite'}
        </button>
      )}
    </div>
  )
}
