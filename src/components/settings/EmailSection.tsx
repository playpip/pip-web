'use client'

import { useEffect } from 'react'
import { ToggleRow } from '@/components/settings/ToggleRow'
import { emailReady } from '@/lib/email/prefs'
import { sound } from '@/lib/sound'
import { useEmailPrefs } from '@/store/emailPrefs'
import { useSync } from '@/store/sync'

/**
 * The two opt-in emails (docs/email.md). Signed in only, and only in a build
 * where email is switched on: there is no address to send to without an
 * account, and no switch before the sending is set up.
 *
 * Both start off. Nothing in the app turns either on except the player, here
 * (Manage account) or with the box at sign-up.
 */
export function EmailSection() {
  const signedIn = useSync((s) => s.status === 'signed-in')
  const address = useSync((s) => s.email)
  if (!signedIn || !emailReady()) return null
  return <EmailSwitches address={address} />
}

function EmailSwitches({ address }: { address: string | null }) {
  const { prefs, status, error, load, toggle } = useEmailPrefs()

  // Read fresh every time Settings opens: another device may have changed them,
  // or an unsubscribe link may have turned them off.
  useEffect(() => {
    void load()
  }, [load])

  const flip = (key: 'dailyReminder' | 'weeklyDigest') => {
    sound.play('tap')
    void toggle(key)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">Email</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {status === 'unavailable'
            ? 'Your email settings could not be loaded. Try again when you are online.'
            : `Sent to ${address ?? 'your account’s address'}. Every email has a link to stop them.`}
        </p>
      </div>
      <ToggleRow
        label="Email me when my streak is about to end"
        hint="At 18:00 UTC on a day you have not played yet, if you played the day before."
        checked={prefs?.dailyReminder ?? false}
        disabled={status !== 'ready'}
        onChange={() => flip('dailyReminder')}
      />
      <ToggleRow
        label="Weekly summary"
        hint="On Mondays: your Roll, what you played and your streak."
        checked={prefs?.weeklyDigest ?? false}
        disabled={status !== 'ready'}
        onChange={() => flip('weeklyDigest')}
      />
      {error && <p className="text-xs leading-relaxed text-suit-red">{error}</p>}
    </div>
  )
}
