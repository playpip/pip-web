'use client'

// The welcome flow (Will, 2026-10-07): four steps, in order, each one screen.
//
//   1. player     — make your player: a face and a name, both filled in to
//                   start with, so Next is one tap
//   2. ready      — "Do you know how to play?": Webb's tour, or straight to the
//                   Welcome Table (a short heads-up first game). "Skip to lobby"
//                   skips the game and goes on to step 3.
//   3. save       — save your player with a free account
//   4. membership — free or the membership, two cards picked like a plan
//                   (Lottie tapped "Free" on the old side-by-side lists), then
//                   the lobby; the membership's plans open in a sheet over
//                   the step (MembershipSheet)
//
// The step lives in the URL (`?step=`) so the Welcome Table can hand back to
// step 3 and an account's Google or Apple trip comes back to the same screen.
// A step that no longer applies moves on rather than showing: a player who has
// not made a player is always on step 1, and a signed-in player is never asked
// to save.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, GraduationCap, Sparkles, Spade } from 'lucide-react'
import { AvatarEditor } from '@/components/profile/AvatarEditor'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { AccountDialog } from '@/components/settings/AccountDialog'
import { AccountCard, useMarkSaveOffered } from '@/components/onboarding/SavePlayer'
import { playedWelcome } from '@/components/onboarding/firstSeat'
import { memberLines } from '@/components/onboarding/memberLines'
import { WELCOME_TABLE } from '@/config/venues'
import { type CurrencyCode, formatPrice, MEMBERSHIP_PRICES } from '@/config/membership'
import { useTillPrice } from '@/components/membership/Join'
import { MembershipSheet } from '@/components/membership/MembershipSheet'
import { trackOnce } from '@/lib/analytics'
import { detectCurrency } from '@/lib/membership/currency'
import { FREE_REPORT_COPY } from '@/lib/membership/freeReport'
import type { ShownPrice } from '@/lib/membership/store'
import { randomAvatar, type AvatarSpec } from '@/lib/avatar'
import { suggestName } from '@/lib/newPlayer'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { useMoney } from '@/lib/useMoney'
import { useProfile } from '@/store/profile'
import { type SyncStatus, useSync } from '@/store/sync'

type Step = 'player' | 'ready' | 'save' | 'membership'
const STEPS: readonly Step[] = ['player', 'ready', 'save', 'membership']
const STEP_NAMES: Record<Step, string> = {
  player: 'Your player',
  ready: 'First game',
  save: 'Save',
  membership: 'Membership',
}

const primary =
  'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 enabled:active:scale-[0.98] disabled:opacity-30'
const quiet =
  'flex min-h-11 w-full items-center justify-center text-sm text-muted-foreground transition hover:text-foreground'

export function WelcomeFlow() {
  const router = useRouter()
  const params = useSearchParams()
  const created = useProfile((s) => s.created && Boolean(s.avatar))
  const venueRecords = useProfile((s) => s.venueRecords)
  const status = useSync((s) => s.status)

  const asked = params.get('step') as Step | null
  // The step that applies, whatever the URL says.
  const step: Step = !created
    ? 'player'
    : asked && STEPS.includes(asked) && asked !== 'player'
      ? asked
      : playedWelcome(venueRecords)
        ? 'save'
        : 'ready'

  const go = (next: Step) => router.replace(`/welcome?step=${next}`)

  return (
    // `data-screen`: exactly the space between the notch and the home bar, so
    // it fits without scrolling in the app and the installed PWA (globals.css).
    <div data-screen className="flex min-h-dvh flex-col px-6 py-6">
      <Progress step={step} />
      <div className="flex flex-1 items-center justify-center py-6">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {step === 'player' && (
            <PlayerStep
              account={params.get('account')}
              onCreated={() => go('ready')}
              onSignedIn={() => router.replace('/game')}
            />
          )}
          {step === 'ready' && <ReadyStep onSkip={() => go('save')} />}
          {step === 'save' && <SaveStep status={status} onNext={() => go('membership')} />}
          {step === 'membership' && <MembershipStep status={status} />}
        </motion.div>
      </div>
    </div>
  )
}

/** Four labelled segments across the top, filled up to the current step. */
function Progress({ step }: { step: Step }) {
  const at = STEPS.indexOf(step)
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= at ? 'bg-primary' : 'bg-foreground/10',
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Step {at + 1} of {STEPS.length} · {STEP_NAMES[step]}
      </p>
    </div>
  )
}

function PlayerStep({
  account,
  onCreated,
  onSignedIn,
}: {
  account: string | null
  onCreated: () => void
  onSignedIn: () => void
}) {
  const createProfile = useProfile((s) => s.createProfile)
  const accountsOn = useSync((s) => s.status !== 'off')
  // Arrives made (2026-11-04): a random face and a suggested name, so one tap
  // on Next carries on. 167 opened this step in the week to 1 November and 113
  // got past it, with Next shut until a name was typed. Both stay editable
  // here, and on the profile later. A name cleared to nothing is the
  // placeholder, which the lobby then offers to change (lib/newPlayer).
  const [spec, setSpec] = useState<AvatarSpec>(randomAvatar)
  const [name, setName] = useState(suggestName)
  // The landing page's "Sign in" link arrives with `?account=signin` and opens
  // it. "Create a free account" makes the player first: the account is offered
  // on step 3, where there is a player to save.
  const [dialog, setDialog] = useState<'signin' | null>(account === 'signin' ? 'signin' : null)

  const enter = () => {
    sound.play('call')
    createProfile(name, spec)
    onCreated()
  }

  return (
    <>
      <h1 className="text-center text-3xl font-semibold tracking-tight">Make your player</h1>
      <p className="mt-2 text-center text-muted-foreground">
        This is who sits at the table. You can change this later.
      </p>
      <div className="mt-8 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6">
        <AvatarEditor
          spec={spec}
          name={name}
          onSpecChange={setSpec}
          onNameChange={setName}
          onSubmit={enter}
        />
      </div>
      <button type="button" onClick={enter} className={cn(primary, 'mt-6')}>
        Next
      </button>
      {accountsOn && (
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            setDialog('signin')
          }}
          className={cn(quiet, 'mt-2')}
        >
          Already have an account? Sign in
        </button>
      )}
      <AccountDialog
        open={dialog !== null}
        mode="signin"
        onOpenChange={(o) => {
          if (o) return
          setDialog(null)
          // Signing in restores the account's player onto this device.
          if (useProfile.getState().created) onSignedIn()
        }}
      />
    </>
  )
}

function ReadyStep({ onSkip }: { onSkip: () => void }) {
  const router = useRouter()
  const name = useProfile((s) => s.name)
  const avatar = useProfile((s) => s.avatar)
  const choice =
    'flex w-full items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 text-left transition hover:border-foreground/25 hover:bg-foreground/[0.06] active:scale-[0.98]'
  return (
    <>
      <div className="flex flex-col items-center text-center">
        {avatar && <PlayerAvatar spec={avatar} size={88} />}
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Nice to meet you, {name}</h1>
        <p className="mt-2 text-muted-foreground">Do you know how to play Texas Hold’em?</p>
      </div>
      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            sound.play('call')
            router.push(`/play/${WELCOME_TABLE.id}`)
          }}
          className={choice}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Spade className="size-5" />
          </span>
          <span>
            <span className="block font-semibold">Yes, deal me in</span>
            <span className="block text-sm text-muted-foreground">
              A quick heads-up game against one of the regulars.
            </span>
          </span>
        </button>
        <Link
          href="/tutorial?from=onboarding"
          onClick={() => sound.play('call')}
          className={choice}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground/10">
            <GraduationCap className="size-5" />
          </span>
          <span>
            <span className="block font-semibold">No, teach me first</span>
            <span className="block text-sm text-muted-foreground">
              A three-minute tour with Webb, then the same game.
            </span>
          </span>
        </Link>
      </div>
      <button
        type="button"
        onClick={() => {
          sound.play('tap')
          onSkip()
        }}
        className={cn(quiet, 'mt-4')}
      >
        Skip to lobby
      </button>
    </>
  )
}

function SaveStep({ status, onNext }: { status: SyncStatus; onNext: () => void }) {
  const money = useMoney()
  const name = useProfile((s) => s.name)
  const avatar = useProfile((s) => s.avatar)
  const roll = useProfile((s) => s.roll)
  const won = useProfile((s) => (s.venueRecords[WELCOME_TABLE.id]?.won ?? 0) > 0)
  const played = useProfile((s) => playedWelcome(s.venueRecords))
  const signedIn = status === 'signed-in'
  useMarkSaveOffered()

  return (
    <>
      <div className="flex flex-col items-center text-center">
        {avatar && <PlayerAvatar spec={avatar} size={88} />}
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {signedIn
            ? 'Your player is saved'
            : won
              ? 'You won your first game'
              : played
                ? 'Good game'
                : 'Save your player'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {name} · {money(roll)} chips
        </p>
      </div>

      {signedIn ? (
        <>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Your Roll, your streak and everything you win are kept on every device you sign in on.
          </p>
          <button type="button" onClick={onNext} className={cn(primary, 'mt-8')}>
            Continue
          </button>
        </>
      ) : (
        <>
          <AccountCard status={status} className="mt-8" />
          <button
            type="button"
            onClick={() => {
              sound.play('tap')
              onNext()
            }}
            className={cn(quiet, 'mt-3')}
          >
            Not now
          </button>
        </>
      )}
    </>
  )
}

type Choice = 'free' | 'member'

/** What the Free card says. The report line is the free report's own (lib/membership/freeReport). */
const FREE_LINES = [
  'The ladder, the Daily, the Rail and Level 1 of the lessons',
  'One member table a day',
  FREE_REPORT_COPY.line,
]

/** The membership's price as the membership page shows it: the store's in the app, else the website's. */
function useMembershipPrice(): { price: ShownPrice; currency: CurrencyCode } {
  const currency = detectCurrency(
    navigator.languages?.length ? navigator.languages : [navigator.language],
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
  )
  const price = useTillPrice({
    ...MEMBERSHIP_PRICES[currency],
    format: (minor) => formatPrice(minor, currency),
  })
  return { price, currency }
}

/**
 * Free or the membership, as two cards of the same size (2026-11-02). The
 * membership's card carries its price and the few things most likely to
 * matter, the report first; Free carries what stays free. Free is picked to
 * start with because it is what you already have, and both cards say exactly
 * what they are, so neither is a trap. In the week to 1 November the old
 * step, a list above two thin radio rows, was seen 69 times and tapped
 * through twice.
 */
function MembershipStep({ status }: { status: SyncStatus }) {
  const router = useRouter()
  const { price, currency } = useMembershipPrice()
  const [choice, setChoice] = useState<Choice>('free')
  const [account, setAccount] = useState(false)
  const [plans, setPlans] = useState(false)
  const choices: { id: Choice; name: string; lines: string[]; price: string; per: string }[] = [
    {
      id: 'member',
      name: 'Pip membership',
      lines: memberLines(),
      price: price.monthly,
      per: 'a month',
    },
    {
      id: 'free',
      name: 'Free',
      lines: FREE_LINES,
      // In the membership's own currency, so a player priced in yuan doesn't see
      // "£0" next to "¥58 a month". Blank, like the member card, until it is known.
      price: price.format?.(0) ?? '',
      per: price.format ? 'for good' : '',
    },
  ]
  const signedOut = status === 'signed-out'

  const pick = (next: Choice) => {
    if (next === choice) return
    sound.play('tap')
    setChoice(next)
  }
  const go = () => {
    sound.play('call')
    if (choice === 'free') {
      router.push('/game')
      return
    }
    // The plans open over the step rather than on `/membership` (2026-11-04),
    // so closing them leaves the player where they were (MembershipSheet).
    trackOnce('welcome-plans-opened')
    setPlans(true)
  }

  return (
    <>
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        Free to play. More if you want it.
      </h1>
      <div role="radiogroup" aria-label="Plan" className="mt-6 flex flex-col gap-3">
        {choices.map((c) => {
          const on = choice === c.id
          const member = c.id === 'member'
          return (
            <motion.button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(c.id)}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={cn(
                'relative w-full overflow-hidden rounded-3xl border p-5 text-left transition-colors',
                on
                  ? member
                    ? 'border-pip bg-pip/[0.08] ring-1 ring-pip'
                    : 'border-foreground/60 bg-foreground/[0.06] ring-1 ring-foreground/60'
                  : 'border-foreground/10 bg-foreground/[0.03] hover:border-foreground/25',
              )}
            >
              <span className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition-colors',
                    on
                      ? member
                        ? 'border-transparent bg-pip text-background'
                        : 'border-transparent bg-primary text-primary-foreground'
                      : 'border-foreground/20',
                  )}
                >
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-lg font-semibold">
                    {member && <Sparkles className="size-4 text-pip" />}
                    {c.name}
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="text-lg font-semibold">{c.price}</span>{' '}
                    <span className="text-sm text-muted-foreground">{c.per}</span>
                  </span>
                </span>
              </span>
              <ul className="mt-3 flex flex-col gap-2 pl-9 text-sm">
                {c.lines.map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <Check
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        member ? 'text-pip' : 'text-muted-foreground',
                      )}
                      strokeWidth={3}
                    />
                    <span className={member ? undefined : 'text-muted-foreground'}>{line}</span>
                  </li>
                ))}
              </ul>
            </motion.button>
          )
        })}
      </div>
      {/* Pinned, so the button is on screen however short the phone. */}
      <div className="sticky bottom-0 -mx-6 mt-5 bg-background px-6 pt-1 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <button type="button" onClick={go} className={primary}>
          {choice === 'member' ? 'See membership plans' : 'Continue for free'}
        </button>
        {/* Still no account: one quiet way back to it under the button. */}
        {signedOut && (
          <button
            type="button"
            onClick={() => {
              sound.play('tap')
              setAccount(true)
            }}
            className={cn(quiet, 'mt-1')}
          >
            Create a free account
          </button>
        )}
      </div>
      <AccountDialog open={account} mode="signup" onOpenChange={setAccount} />
      <MembershipSheet open={plans} onOpenChange={setPlans} price={price} currency={currency} />
    </>
  )
}
