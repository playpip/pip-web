'use client'

// The account, offered where a player can actually see it: the lobby, under the
// Roll, and the AppBar. A newcomer is also asked at two moments in a tournament
// (table/SaveNudge, table/FinishFunnel), which are built separately because
// they are asked, not furniture.
//
// **This is prominence, not a prompt, and the difference is mechanical.** It is
// permanent furniture. It never appears over anything, never interrupts a hand,
// never counts sessions, and has no dismiss button because there is nothing to
// dismiss — it is part of the screen while you are signed out and gone for good
// once you are not. The landing page ships "No forced pop-ups, no pay-to-win,
// no nagging. Ever." Nothing here may grow into something that arrives
// uninvited or returns after being closed.

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { AccountDialog, type AccountMode } from '@/components/settings/AccountDialog'
import { useSync } from '@/store/sync'
import { oauthProviders } from '@/lib/sync/client'
import { useHydrated } from '@/lib/useHydrated'
import { sound } from '@/lib/sound'
import { useInApp } from '@/lib/useInApp'

/** The strongest fact we have about signing up, and nothing else said it. */
export const SIGNUP_FACT = 'An email and a password. No confirmation email.'

/**
 * The same fact once Google or Apple are on offer. The signup dialog stopped
 * saying "an email and a password" was the only way in when they shipped; this
 * card sits one tap before that dialog and has to agree with it.
 */
export const SIGNUP_FACT_OAUTH = 'Google, Apple, or an email and a password. No confirmation email.'

export const signupFact = () => (oauthProviders().length > 0 ? SIGNUP_FACT_OAUTH : SIGNUP_FACT)

export function AccountOffer() {
  const status = useSync((s) => s.status)
  const ready = useSync((s) => s.ready)
  const hydrated = useHydrated()
  const [dialog, setDialog] = useState<AccountMode | null>(null)
  const [inviteSpent, setInviteSpent] = useState(false)
  const where = useInApp() ? 'this app' : 'this browser'

  // Wait for the stored session before offering anything (see sync's `ready`),
  // and render nothing at all in a build with no project behind it.
  if (!ready || status !== 'signed-out') return null

  // The landing page's "Create a free account" links to /game?account=new and
  // its "Sign in" to /game?account=signin. This is those links' destination,
  // not a pop-up: the player pressed a button that said exactly this. Read at
  // render rather than in an effect — `hydrated` is false on the server and on
  // the hydrating pass, so it only runs in the browser, and one dismissal
  // spends it for good.
  const asked =
    hydrated && !inviteSpent ? new URLSearchParams(window.location.search).get('account') : null
  const invitedMode: AccountMode | null =
    asked === 'new' ? 'signup' : asked === 'signin' ? 'signin' : null
  const invited = invitedMode !== null

  const mode = dialog ?? invitedMode

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

  return (
    <div className="mt-6 w-full max-w-md rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 text-left">
      <p className="text-sm leading-relaxed">
        {`Your Roll is saved in ${where} only. A free account keeps it on every device.`}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{signupFact()}</p>

      {/* Outlined, never filled: the loudest thing on the lobby is a table you
          could sit at. */}
      <button
        onClick={() => open('signup')}
        className="mt-3 min-h-11 w-full rounded-xl border border-foreground/15 py-3 text-sm font-medium transition hover:bg-foreground/[0.06]"
      >
        Create a free account
      </button>
      <button
        onClick={() => open('signin')}
        className="flex min-h-11 w-full items-center justify-center text-xs text-muted-foreground/70 underline-offset-2 transition hover:text-foreground hover:underline"
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
