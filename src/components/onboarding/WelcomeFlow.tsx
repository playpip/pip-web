'use client'

// The welcome flow (Will, 2026-10-07): four steps, in order, each one screen.
//
//   1. player     — make your player: a face and a name
//   2. ready      — "Do you know how to play?": Webb's tour, or straight to the
//                   Welcome Table (a short heads-up first game)
//   3. save       — after that game: save your player with a free account
//   4. membership — what is free and what the membership adds, then the account
//                   (if still not made) or the lobby
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
import { Check, GraduationCap, Spade } from 'lucide-react'
import { AvatarEditor } from '@/components/profile/AvatarEditor'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { AccountDialog } from '@/components/settings/AccountDialog'
import { signupFact } from '@/components/settings/AccountOffer'
import { playedWelcome } from '@/components/onboarding/firstSeat'
import { WELCOME_TABLE } from '@/config/venues'
import { membershipFor } from '@/config/membership'
import { AVATAR_BG_SWATCHES, freshSeed, type AvatarSpec } from '@/lib/avatar'
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
    <div className="flex min-h-dvh flex-col px-6 py-8">
      <Progress step={step} />
      <div className="flex flex-1 items-center justify-center py-8">
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
          {step === 'ready' && <ReadyStep />}
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
  const [spec, setSpec] = useState<AvatarSpec>(() => ({
    seed: freshSeed(),
    backgroundColor: AVATAR_BG_SWATCHES[1],
  }))
  const [name, setName] = useState('')
  // The landing page's "Sign in" link arrives with `?account=signin` and opens
  // it. "Create a free account" makes the player first: the account is offered
  // on step 3, where there is a player to save.
  const [dialog, setDialog] = useState<'signin' | null>(account === 'signin' ? 'signin' : null)

  const enter = () => {
    if (!name.trim()) return
    sound.play('call')
    createProfile(name, spec)
    onCreated()
  }

  return (
    <>
      <h1 className="text-center text-3xl font-semibold tracking-tight">Make your player</h1>
      <p className="mt-2 text-center text-muted-foreground">
        Pick a face and a name. This is who sits at the table.
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
      <button type="button" onClick={enter} disabled={!name.trim()} className={cn(primary, 'mt-6')}>
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

function ReadyStep() {
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
    </>
  )
}

/** Why an account, in three lines. Shared by the save step and the last step. */
const ACCOUNT_REASONS = [
  'Your Roll and your player on every device',
  'Keep your streak, with a reminder if you want one',
  'Needed for the membership, if you ever join',
]

function SaveStep({ status, onNext }: { status: SyncStatus; onNext: () => void }) {
  const money = useMoney()
  const name = useProfile((s) => s.name)
  const avatar = useProfile((s) => s.avatar)
  const roll = useProfile((s) => s.roll)
  const won = useProfile((s) => (s.venueRecords[WELCOME_TABLE.id]?.won ?? 0) > 0)
  const signedIn = status === 'signed-in'

  return (
    <>
      <div className="flex flex-col items-center text-center">
        {avatar && <PlayerAvatar spec={avatar} size={88} />}
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {signedIn ? 'Your player is saved' : won ? 'You won your first game' : 'Good game'}
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
          <AccountCard status={status} />
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

/** The account, offered: where the player lives now, why an account, and the button. */
function AccountCard({ status }: { status: SyncStatus }) {
  const [open, setOpen] = useState(false)
  const accountsOn = status !== 'off'
  return (
    <div className="mt-8 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6">
      <p className="text-lg font-semibold">Save your player</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Right now your player lives in this browser only. A free account keeps it safe and on every
        device. It takes a few seconds.
      </p>
      <ul className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
        {ACCOUNT_REASONS.map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            {line}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!accountsOn}
        onClick={() => {
          sound.play('tap')
          setOpen(true)
        }}
        className={cn(primary, 'mt-6')}
      >
        Create a free account
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {accountsOn ? signupFact() : 'Accounts are not set up in this build.'}
      </p>
      <AccountDialog open={open} mode="signup" onOpenChange={setOpen} />
    </div>
  )
}

function MembershipStep({ status }: { status: SyncStatus }) {
  const free = [
    'The ten-table ladder',
    'The Daily, every day',
    'Cash games on the Rail',
    'Level 1 of Webb’s lessons',
  ]
  const member = [
    'Omaha, Short Deck, Hi-Lo and Five-Card Draw',
    'Every side table',
    'All of Webb’s lessons and drills',
    'Session review: replay any session hand by hand',
    'A report on your own play',
  ]
  const signedOut = status === 'signed-out'
  return (
    <>
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        Free to play. More if you want it.
      </h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5">
          <p className="text-sm font-semibold">Free, for good</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
            {free.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-pip/40 bg-pip/[0.08] p-5">
          <p className="text-sm font-semibold">Pip membership</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
            {member.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-pip" />
                {line}
              </li>
            ))}
          </ul>
          <Link
            href={membershipFor('lessons')}
            onClick={() => sound.play('tap')}
            className="mt-4 inline-block text-sm font-medium text-pip underline-offset-2 hover:underline"
          >
            See the membership
          </Link>
        </div>
      </div>
      {/* Still no account: the last screen asks once more, above the lobby. */}
      {signedOut && <AccountCard status={status} />}
      <Link
        href="/game"
        onClick={() => sound.play('call')}
        className={cn(signedOut ? quiet : primary, 'mt-6')}
      >
        Go to the lobby
      </Link>
    </>
  )
}
