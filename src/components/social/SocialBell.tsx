'use client'

// The Friends button in the bar, with the unread count on it. Only for
// somebody signed in, once friends are switched on: a guest has no inbox.

import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { socialEnabled } from '@/lib/social/api'
import { sound } from '@/lib/sound'
import { useSocial } from '@/store/social'
import { useSync } from '@/store/sync'

/** `quiet`: only there when something is waiting, for the sidebar's bare bar. */
export function SocialBell({ quiet = false }: { quiet?: boolean }) {
  const router = useRouter()
  const signedIn = useSync((s) => s.status === 'signed-in')
  const unread = useSocial((s) => s.unread)
  if (!signedIn || !socialEnabled() || (quiet && unread === 0)) return null
  return (
    <button
      type="button"
      onClick={() => {
        sound.play('tap')
        router.push(unread > 0 ? '/game/friends?tab=inbox' : '/game/friends')
      }}
      className="relative rounded-full p-1.5 text-muted-foreground transition @[20rem]:p-2 hover:bg-foreground/5 hover:text-foreground"
      aria-label={unread > 0 ? `Friends, ${unread} new` : 'Friends'}
    >
      <Users className="size-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold leading-4 text-primary-foreground tabular-nums">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
