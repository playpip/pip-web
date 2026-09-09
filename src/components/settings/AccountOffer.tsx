'use client'

// The account, offered where a player can actually see it: the lobby, under the
// Roll, and the end-of-run overlay. Before this it existed in two places, both
// of them two taps inside a dialog nobody opens.
//
// **This is prominence, not a prompt, and the difference is mechanical.** It is
// permanent furniture. It never appears over anything, never interrupts a hand,
// never counts sessions, and has no dismiss button because there is nothing to
// dismiss — it is part of the screen while you are signed out and gone for good
// once you are not. The landing page ships "No forced pop-ups, no pay-to-win, no
// nagging. Ever." Nothing here may grow into something that arrives uninvited or
// returns after being closed.
//
// Two variants, one component: the sentence has the same job in both places and
// a second copy of it would drift. The lobby sits on theme tokens; the overlay
// is always dark, so it sits on white alphas like everything else on it.

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { AccountDialog, type AccountMode } from '@/components/settings/AccountDialog'
import { useSync } from '@/store/sync'
import { useHydrated } from '@/lib/useHydrated'
import { sound } from '@/lib/sound'

/** The strongest fact we have about signing up, and nothing else said it. */
export const SIGNUP_FACT = 'An email and a password. There is no confirmation email to go and find.'

export function AccountOffer({ variant = 'lobby' }: { variant?: 'lobby' | 'overlay' }) {
  const status = useSync((s) => s.status)
  const ready = useSync((s) => s.ready)
  const hydrated = useHydrated()
  const [dialog, setDialog] = useState<AccountMode | null>(null)
  const [inviteSpent, setInviteSpent] = useState(false)

  // Wait for the stored session before offering anything (see sync's `ready`),
  // and render nothing at all in a build with no project behind it.
  if (!ready || status !== 'signed-out') return null

  // The landing page's "Create a free account" links to /game?account=new. This
  // is that link's destination, not a pop-up: the player pressed a button that
  // said exactly this. Read at render rather than in an effect — `hydrated` is
  // false on the server and on the hydrating pass, so it only runs in the
  // browser, and one dismissal spends it for good.
  const invited =
    variant === 'lobby' &&
    hydrated &&
    !inviteSpent &&
    new URLSearchParams(window.location.search).get('account') === 'new'

  const mode = dialog ?? (invited ? 'signup' : null)

  const open = (next: AccountMode) => {
    sound.play('tap')
    setDialog(next)
  }

  const close = () => {
    setDialog(null)
    setInviteSpent(true)
    // Drop the invite from the URL so a reload doesn't reopen what was closed.
    if (invited) {
      const url = new URL(window.location.href)
      url.searchParams.delete('account')
      window.history.replaceState(null, '', url.toString())
    }
  }

  const dark = variant === 'overlay'

  return (
    <div
      className={
        dark
          ? 'mt-4 border-t border-white/10 pt-4 text-left'
          : 'mt-6 w-full max-w-md rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 text-left'
      }
    >
      <p className={dark ? 'text-xs leading-relaxed text-white/70' : 'text-sm leading-relaxed'}>
        {dark
          ? 'That run lives in this browser and nowhere else. A free account keeps it, on every device you play on.'
          : 'Your Roll lives in this browser and nowhere else. A free account keeps a copy, on every device you play on.'}
      </p>
      <p
        className={
          dark
            ? 'mt-1.5 text-2xs leading-relaxed text-white/40'
            : 'mt-1.5 text-xs leading-relaxed text-muted-foreground'
        }
      >
        {SIGNUP_FACT}
      </p>

      {/* Outlined, never filled. On the lobby the loudest thing is a table you
          could sit at; on the overlay it is the button that takes you home. */}
      <button
        onClick={() => open('signup')}
        className={
          dark
            ? 'mt-3 min-h-11 w-full rounded-xl border border-white/20 py-3 text-sm font-medium text-white transition hover:bg-white/10'
            : 'mt-3 min-h-11 w-full rounded-xl border border-foreground/15 py-3 text-sm font-medium transition hover:bg-foreground/[0.06]'
        }
      >
        Create a free account
      </button>
      <button
        onClick={() => open('signin')}
        className={
          dark
            ? 'flex min-h-11 w-full items-center justify-center text-xs text-white/50 underline-offset-2 transition hover:text-white hover:underline'
            : 'flex min-h-11 w-full items-center justify-center text-xs text-muted-foreground/70 underline-offset-2 transition hover:text-foreground hover:underline'
        }
      >
        Already have one? Sign in
      </button>

      <AccountDialog
        open={mode !== null}
        mode={mode ?? 'signup'}
        onOpenChange={(o) => !o && close()}
      />
    </div>
  )
}

/**
 * The same door as an AppBar icon, so an account is one tap from every screen
 * rather than three from two of them. Signed out only; it disappears for good
 * once there is an account, which is why it can be permanent without being a
 * nag — it is furniture that answers a question, like Settings.
 */
export function AccountBarButton() {
  const status = useSync((s) => s.status)
  const ready = useSync((s) => s.ready)
  const [open, setOpen] = useState(false)

  if (!ready || status !== 'signed-out') return null

  return (
    <>
      <button
        onClick={() => {
          sound.play('tap')
          setOpen(true)
        }}
        className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
        aria-label="Create a free account"
      >
        <UserPlus className="size-4" />
      </button>
      <AccountDialog open={open} mode="signup" onOpenChange={setOpen} />
    </>
  )
}
