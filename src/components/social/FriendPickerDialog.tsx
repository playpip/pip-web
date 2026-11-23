'use client'

// Pick friends to invite to a table you are about to open, on Multiplayer.
// Nothing is sent from here: the table is opened first, then each friend
// picked gets a push and an inbox note with a Join (docs/social.md).

import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Friend } from '@/lib/social/api'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { Face } from './parts'

/** The most friends one invite goes to; the database holds the same number. */
export const MAX_INVITES = 8

export function FriendPickerDialog({
  open,
  onOpenChange,
  friends,
  picked,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Null while they load. */
  friends: Friend[] | null
  picked: string[]
  onChange: (picked: string[]) => void
}) {
  const toggle = (handle: string) => {
    sound.play('tap')
    onChange(
      picked.includes(handle)
        ? picked.filter((h) => h !== handle)
        : picked.length < MAX_INVITES
          ? [...picked, handle]
          : picked,
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <div className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Invite friends</DialogTitle>
          </DialogHeader>
          {!friends ? (
            <div className="h-40 animate-pulse rounded-2xl bg-foreground/[0.04]" aria-busy />
          ) : friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No friends to invite yet. Add them in Friends, or share the link once the table is
              open.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl border border-foreground/10">
              {friends.map((f) => {
                const on = picked.includes(f.handle)
                return (
                  <li key={f.handle}>
                    <button
                      type="button"
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
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              sound.play('tap')
              onOpenChange(false)
            }}
            className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-medium text-primary-foreground transition hover:bg-primary/85 active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
