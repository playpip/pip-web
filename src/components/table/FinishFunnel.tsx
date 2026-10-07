'use client'

/**
 * The end of a tournament, for a player who has not settled in yet: pick a
 * name (while they are still the placeholder "Player") and save the Roll to a
 * free account (while signed out). Renders nothing once both are done. The
 * overlay it sits on is always dark, so it is drawn in white like the rest of it.
 */

import { useState } from 'react'
import { AccountDialog, type AccountMode } from '@/components/settings/AccountDialog'
import { signupFact } from '@/components/settings/AccountOffer'
import { hasPlaceholderName } from '@/lib/newPlayer'
import { sound } from '@/lib/sound'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'

/** Is there anything for the funnel to ask? Read by the overlay to hide its own account line. */
export function useFinishFunnel(): { askName: boolean; askAccount: boolean } {
  const name = useProfile((s) => s.name)
  const ready = useSync((s) => s.ready)
  const status = useSync((s) => s.status)
  return { askName: hasPlaceholderName(name), askAccount: ready && status === 'signed-out' }
}

export function FinishFunnel() {
  const { askName, askAccount } = useFinishFunnel()
  const setName = useProfile((s) => s.setName)
  const [draft, setDraft] = useState('')
  const [dialog, setDialog] = useState<AccountMode | null>(null)
  if (!askName && !askAccount) return null

  const saveName = () => {
    if (!draft.trim()) return
    sound.play('tap')
    setName(draft.slice(0, 20))
  }

  return (
    <div className="mx-auto mt-6 flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-white/5 p-5 text-left">
      {askName && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveName()
          }}
        >
          <label htmlFor="finish-name" className="text-sm font-medium text-white">
            Pick a name
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="finish-name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={20}
              autoComplete="nickname"
              placeholder="Your name at the table"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-medium text-white transition enabled:hover:bg-white/10 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </form>
      )}
      {askAccount && (
        <div className={askName ? 'border-t border-white/10 pt-4' : undefined}>
          <p className="text-sm font-medium text-white">Save your Roll</p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            It is saved on this device only. A free account keeps it on every device. {signupFact()}
          </p>
          <button
            type="button"
            onClick={() => {
              sound.play('tap')
              setDialog('signup')
            }}
            className="mt-3 min-h-11 w-full rounded-xl bg-white/90 text-sm font-semibold text-black transition hover:bg-white active:scale-[0.98]"
          >
            Create a free account
          </button>
          <button
            type="button"
            onClick={() => {
              sound.play('tap')
              setDialog('signin')
            }}
            className="flex min-h-10 w-full items-center justify-center text-xs text-white/50 underline-offset-2 transition hover:text-white hover:underline"
          >
            Already have one? Sign in
          </button>
          <AccountDialog
            open={dialog !== null}
            mode={dialog ?? 'signup'}
            onOpenChange={(o) => !o && setDialog(null)}
          />
        </div>
      )}
    </div>
  )
}
