'use client'

import { useEffect } from 'react'
import { CalendarDays, Flame } from 'lucide-react'
import { SwitchRow } from '@/components/settings/group'
import { emailReady } from '@/lib/email/prefs'
import { sound } from '@/lib/sound'
import { useEmailPrefs } from '@/store/emailPrefs'
import { useSync } from '@/store/sync'

/** Whether the two opt-in emails can be offered at all. */
export function useEmailRows(): boolean {
  const signedIn = useSync((s) => s.status === 'signed-in')
  return signedIn && emailReady()
}

/**
 * The two opt-in emails (docs/email.md), as rows in Settings → Notifications.
 * Signed in only, and only in a build where email is switched on: there is no
 * address to send to without an account, and no switch before the sending is
 * set up. The caller checks `useEmailRows` first.
 *
 * Both start off. Nothing in the app turns either on except the player, here
 * or with the box at sign-up.
 */
export function EmailRows() {
  const address = useSync((s) => s.email)
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
    <>
      <SwitchRow
        icon={Flame}
        tint="streak"
        label="Streak email"
        hint="At 18:00 UTC on a day you have not played yet, if you played the day before."
        checked={prefs?.dailyReminder ?? false}
        disabled={status !== 'ready'}
        onChange={() => flip('dailyReminder')}
      />
      <SwitchRow
        icon={CalendarDays}
        tint="blue"
        label="Weekly summary"
        hint="On Mondays: your Roll, what you played and your streak."
        checked={prefs?.weeklyDigest ?? false}
        disabled={status !== 'ready'}
        onChange={() => flip('weeklyDigest')}
      />
      <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        {status === 'unavailable'
          ? 'Your email settings could not be loaded. Try again when you are online.'
          : `Emails go to ${address ?? 'your account’s address'}. Every one has a link to stop them.`}
      </p>
      {error && <p className="px-4 py-3 text-xs leading-relaxed text-suit-red">{error}</p>}
    </>
  )
}
