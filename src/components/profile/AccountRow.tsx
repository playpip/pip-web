'use client'

// The account, where identity already lives — the foot of the Edit player
// dialog, one tap from the lobby.
//
// Settings has its own account row (settings/SyncSection) and this is
// deliberately not that component: same dialog underneath, different job. This
// one names the stake, because the player is looking at the profile it would
// protect while they read it.
//
// The rule from SyncSection holds here unchanged. Signed out is a first-class
// state, permanently. This row states a fact and offers a door; it never
// returns, never counts, and never appears anywhere the player did not already
// choose to be.

import { useState } from 'react'
import { AccountDialog, type AccountMode } from '@/components/settings/AccountDialog'
import { useSync } from '@/store/sync'
import { sound } from '@/lib/sound'
import { useInApp } from '@/lib/useInApp'

/**
 * @param name The name shown in the form, so the line reads about *this*
 *   player rather than about "your progress". Tracks the field as it is typed.
 */
export function AccountRow({ name }: { name: string }) {
  const status = useSync((s) => s.status)
  const email = useSync((s) => s.email)
  const dirty = useSync((s) => s.dirty)
  const [dialog, setDialog] = useState<AccountMode | null>(null)
  const where = useInApp() ? 'this app' : 'this browser'

  // No Supabase project configured — the account doesn't exist in this build.
  if (status === 'off') return null
  const signedIn = status === 'signed-in'
  const who = name.trim() || 'This player'

  const open = (mode: AccountMode) => {
    sound.play('tap')
    setDialog(mode)
  }

  return (
    <div className="mt-4 border-t border-foreground/10 pt-3">
      {signedIn ? (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
            Signed in as <span className="break-all text-foreground">{email}</span>. Your progress
            syncs on its own{dirty ? ', saving now' : ''}.
          </p>
          <button
            onClick={() => open('manage')}
            className="min-h-11 shrink-0 px-1 text-xs text-muted-foreground/70 underline-offset-2 transition hover:text-foreground hover:underline"
          >
            Manage
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {who} lives in {where} and nowhere else. An account keeps a copy and puts them on your
            other devices — free, and never required.
          </p>
          {/* Outlined, not filled: Save is this dialog's primary action and must
              stay the loudest thing in it. This only has to outrank Sign in. */}
          <button
            onClick={() => open('signup')}
            className="mt-2.5 min-h-11 w-full rounded-xl border border-foreground/15 py-3 text-sm font-medium transition hover:bg-foreground/[0.06]"
          >
            Create an account
          </button>
          <button
            onClick={() => open('signin')}
            className="flex min-h-11 w-full items-center justify-center text-xs text-muted-foreground/70 underline-offset-2 transition hover:text-foreground hover:underline"
          >
            Already have one? Sign in
          </button>
        </>
      )}

      <AccountDialog
        open={dialog !== null}
        mode={dialog ?? 'signin'}
        onOpenChange={(o) => !o && setDialog(null)}
      />
    </div>
  )
}
