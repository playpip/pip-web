'use client'

// The account's footprint inside Settings: one line of copy and one row of
// buttons. Every form lives in AccountDialog, over the top.
//
// Signed out is a first-class state, permanently. There is no banner, no
// interstitial and no "sync your progress!" anywhere in the app, and if the
// build has no Supabase project configured this renders nothing at all.
//
// The account now has a second footprint, at the foot of the Edit player dialog
// (profile/AccountRow). That is still not a prompt: both are doors sitting in
// places the player already chose to open. The rule above is unchanged, and
// "no nagging. Ever." is on the landing page in public — so nothing here may
// grow into something that appears uninvited or comes back after a dismissal.

import { useState } from 'react'
import { AccountDialog, type AccountMode } from '@/components/settings/AccountDialog'
import { useSync } from '@/store/sync'
import { sound } from '@/lib/sound'
import { useInApp } from '@/lib/useInApp'

const secondaryButton =
  'min-h-11 flex-1 rounded-xl bg-foreground/[0.06] py-3 text-sm font-medium transition hover:bg-foreground/[0.12]'
const primaryButton =
  'min-h-11 flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90'

/**
 * Renders inside Settings' "Your account" section, with the by-hand transfer
 * kept underneath it as the alternative. It used to be the other way round —
 * this lived inside a section headed "Move to another device", which is a task
 * you only have once you are already holding the second device. The commoner
 * reason to want an account is the opposite: one device, and no wish to lose
 * what is on it. The heading now names that job.
 *
 * Create outranks Sign in because on a product this young the new players
 * outnumber the returning ones, and two identical grey buttons told a first
 * visitor nothing about which door was theirs.
 */
export function SyncSection() {
  const status = useSync((s) => s.status)
  const email = useSync((s) => s.email)
  const dirty = useSync((s) => s.dirty)
  const [dialog, setDialog] = useState<AccountMode | null>(null)
  const where = useInApp() ? 'this app' : 'this browser'

  if (status === 'off') return null
  const signedIn = status === 'signed-in'

  const open = (mode: AccountMode) => {
    sound.play('tap')
    setDialog(mode)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="mb-1 text-xs leading-relaxed text-muted-foreground">
        {signedIn ? (
          <>
            Signed in as <span className="text-foreground">{email}</span>. Your progress syncs on
            its own{dirty ? ', saving now' : ''}.
          </>
        ) : (
          <>
            Your profile lives in {where}. An account keeps a copy of it and puts it on your other
            devices. Neither is needed to play, and nothing leaves this device until you pick one.
          </>
        )}
      </p>

      {signedIn ? (
        <button onClick={() => open('manage')} className={secondaryButton}>
          Manage account
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => open('signup')} className={primaryButton}>
            Create an account
          </button>
          <button onClick={() => open('signin')} className={secondaryButton}>
            Sign in
          </button>
        </div>
      )}

      <AccountDialog
        open={dialog !== null}
        mode={dialog ?? 'signin'}
        onOpenChange={(o) => !o && setDialog(null)}
      />
    </div>
  )
}
