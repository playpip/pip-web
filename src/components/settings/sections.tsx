'use client'

// The settings themselves, as grouped rows. The page (/settings) and the sheet
// that opens over a table both draw these, so there is one of each switch.

import { useId, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeftRight,
  Lightbulb,
  MessageCircle,
  Percent,
  RotateCcw,
  Type,
  Vibrate,
  Volume2,
} from 'lucide-react'
import { SettingsGroup, SettingsRow, SwitchRow } from '@/components/settings/group'
import { TransferDialog } from '@/components/settings/TransferDialog'
import { useTextScale } from '@/components/text-scale-provider'
import { isTableRoute, TABLE_MAX_TEXT_SCALE, TEXT_SCALES, textScaleLabel } from '@/lib/textScale'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'
import { sound } from '@/lib/sound'
import { haptics } from '@/lib/haptics'
import { useHydrated } from '@/lib/useHydrated'
import { cn } from '@/lib/utils'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID

/** Text size and the win odds: what is on the screen. */
export function DisplayGroup() {
  return (
    <SettingsGroup label="Display">
      <TextSizeRow />
      <OddsRow />
    </SettingsGroup>
  )
}

/** What you hear and feel. */
export function SoundGroup() {
  return (
    <SettingsGroup label="Sound and feel">
      <SoundRow />
      <HapticsRow />
    </SettingsGroup>
  )
}

/** The cast and the coach. */
export function TableGroup() {
  return (
    <SettingsGroup label="At the table">
      <TableTalkRow />
      <HandCoachingRow />
    </SettingsGroup>
  )
}

/**
 * Text size: four steps up to 200%, which is what WCAG 1.4.4 asks for.
 *
 * Pinch-zoom is off by ruling (technology#6), so this is the route to a reader
 * who needs bigger text, and it is the better one anyway: a setting rather than
 * a gesture that pans you off the table mid-hand.
 *
 * Percentages rather than "Large / Larger": they are honest, they say what the
 * step actually does, and 200% is a number some readers already know to look
 * for. The labels are all one size on purpose. Drawing each button at its own
 * scale previews the choice nicely and makes the row four times wider than the
 * dialog at the top step, which is the wrong trade in a 384px sheet.
 *
 * The table stops at 150% (technology#57, and lib/textScale.ts says why), so
 * the copy says so. The sheet opens from the table's own bar, which means a
 * reader can pick 200% mid-hand and watch nothing happen; the second line only
 * shows up in exactly that moment, rather than nagging everyone else about it.
 */
function TextSizeRow() {
  const { scale, setScale } = useTextScale()
  const hydrated = useHydrated()
  const pathname = usePathname()
  const thumb = useId()
  // Hydration: `scale` is read from localStorage, so the server render always
  // thinks it is 100 and this line would mismatch without the gate.
  const cappedHere = hydrated && isTableRoute(pathname) && scale > TABLE_MAX_TEXT_SCALE
  return (
    <SettingsRow
      icon={Type}
      tint="pip"
      label="Text size"
      hint={
        cappedHere
          ? `You are at the table, so this screen is showing ${textScaleLabel(TABLE_MAX_TEXT_SCALE)}.`
          : `The table stops at ${textScaleLabel(TABLE_MAX_TEXT_SCALE)}.`
      }
    >
      {/* Real radios, visually hidden. A segmented control built from buttons
          would need role="radio" and hand-rolled arrow-key handling; this gets
          both from the browser, and it is the one control on the page a reader
          who needs it may be driving with the keyboard. Two by two once the
          card is narrow in rem, which is a phone at 200%: four across does
          not fit there. */}
      <fieldset className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-foreground/[0.06] p-1 @[14rem]:grid-cols-4">
        <legend className="sr-only">Text size</legend>
        {TEXT_SCALES.map((step) => {
          // Before hydration nothing is selected, for the same reason dark mode
          // waits: the stored value is not readable during the server render.
          const active = hydrated && scale === step
          return (
            <label
              key={step}
              className={cn(
                'relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-medium tabular-nums transition active:scale-[0.97]',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId={thumb}
                  className="absolute inset-0 rounded-lg bg-foreground/15 shadow-sm ring-1 ring-foreground/5"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <input
                type="radio"
                name="text-size"
                value={step}
                checked={active}
                onChange={() => {
                  sound.play('tap')
                  setScale(step)
                }}
                className="sr-only"
              />
              <span className="relative">{textScaleLabel(step)}</span>
            </label>
          )
        })}
      </fieldset>
    </SettingsRow>
  )
}

/** The card snaps, chip clinks and taps — global mute, was a top-bar button. */
function SoundRow() {
  const [muted, setMuted] = useState(sound.isMuted())
  return (
    <SwitchRow
      icon={Volume2}
      tint="coral"
      label="Sound"
      hint="Card snaps, chip clinks and the little taps."
      checked={!muted}
      onChange={() => {
        const next = !muted
        sound.setMuted(next)
        setMuted(next)
        if (!next) sound.play('tap')
      }}
    />
  )
}

/**
 * Vibration with every sound (lib/haptics). Off by default, because a
 * buzz nobody asked for is exactly the casino tell the app is built against.
 *
 * The row hides itself where the browser cannot vibrate at all, which is every
 * Safari and every iPhone outside the store app. A toggle that provably does nothing is worse than no
 * toggle: it reads as a broken feature rather than an absent one. It is gated
 * on `useHydrated` because the server cannot know, and rendering the row and
 * then removing it is a hydration mismatch.
 *
 * Turning it on fires one buzz, deliberately. You should feel the thing you
 * just switched on, and it is the only way to check it works on your device.
 */
function HapticsRow() {
  const hydrated = useHydrated()
  const enabled = useProfile((s) => s.haptics)
  const setHaptics = useProfile((s) => s.setHaptics)
  if (!hydrated || !haptics.supported()) return null
  return (
    <SwitchRow
      icon={Vibrate}
      tint="coral"
      label="Vibration"
      hint="A short tap with every sound, shaped like it."
      checked={enabled}
      onChange={() => {
        const next = !enabled
        sound.play('tap')
        setHaptics(next)
        if (next) haptics.fire('bet')
      }}
    />
  )
}

/** The cast's rare one-liners at the table — on by default, easy to silence. */
function TableTalkRow() {
  const tableTalk = useProfile((s) => s.tableTalk)
  const setTableTalk = useProfile((s) => s.setTableTalk)
  return (
    <SwitchRow
      icon={MessageCircle}
      tint="green"
      label="Table talk"
      hint="The occasional quiet line from the regulars."
      checked={tableTalk}
      onChange={() => {
        sound.play('tap')
        setTableTalk(!tableTalk)
      }}
    />
  )
}

/**
 * The post-hand read (lib/coach). On by default, and quiet even then.
 *
 * **The label is "Second opinion" and the store field is `handCoaching`.** They
 * disagree on purpose. The rename was worth doing while `PERSIST_VERSION` 13
 * was unshipped; it shipped on 14 Aug in v1.11.0, so renaming the field now
 * costs a migration, and a v13 profile that came through the shallow persist
 * merge without one would quietly get the setting switched back on. An
 * internal name is not worth flipping a preference somebody chose.
 *
 * The hint's second sentence is load-bearing: it puts "most hands do not get
 * one" on the surface where a player meets the feature, so silence reads as
 * normal rather than as a bug.
 */
function HandCoachingRow() {
  const handCoaching = useProfile((s) => s.handCoaching)
  const setHandCoaching = useProfile((s) => s.setHandCoaching)
  return (
    <SwitchRow
      icon={Lightbulb}
      tint="green"
      label="Second opinion"
      hint="After a hand, one line on the call that mattered. Most hands do not get one."
      checked={handCoaching}
      onChange={() => {
        sound.play('tap')
        setHandCoaching(!handCoaching)
      }}
    />
  )
}

/**
 * The win % beside your cards at a single-player table (HeroPanel). On by
 * default, because brand.md puts it among the calm, ambient stats; off is for
 * a player who wants to practise reading a hand without it.
 *
 * Display only. Free for everybody, like every setting: nothing you can buy
 * changes the information on screen. The hand review keeps its numbers either
 * way, because that is where you go to look.
 */
function OddsRow() {
  const showOdds = useProfile((s) => s.showOdds)
  const setShowOdds = useProfile((s) => s.setShowOdds)
  return (
    <SwitchRow
      icon={Percent}
      tint="pip"
      label="Win odds"
      hint="Your chance to win, beside your cards. Off to play on your own read."
      checked={showOdds}
      onChange={() => {
        sound.play('tap')
        setShowOdds(!showOdds)
      }}
    />
  )
}

/**
 * The by-hand route: a code, a QR or a file, no account needed. In builds with
 * no Supabase project it is the only route there is, so it gets the words.
 */
export function TransferRow() {
  const [open, setOpen] = useState(false)
  const syncOff = useSync((s) => s.status === 'off')
  return (
    <>
      <button
        type="button"
        onClick={() => {
          sound.play('tap')
          setOpen(true)
        }}
        className="w-full text-left transition hover:bg-foreground/[0.04] active:bg-foreground/[0.06]"
      >
        <SettingsRow
          icon={ArrowLeftRight}
          tint="blue"
          label="Move it by hand"
          hint={
            syncOff
              ? 'Carry your progress across as a code, a QR or a file.'
              : 'A code, a QR or a file.'
          }
        />
      </button>
      <TransferDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

/**
 * Wipe the profile and Roll back to a clean start — guarded by a confirm.
 *
 * Resetting clears the account's copy too, so the confirm has to say so while
 * signed in. This is the one button that can cost someone their progress on
 * every device at once, and it must not read like a local-only tidy-up.
 */
export function ResetButton() {
  const resetEverywhere = useSync((s) => s.resetEverywhere)
  const signedIn = useSync((s) => s.status === 'signed-in')
  return (
    <button
      type="button"
      onClick={() => {
        const message = signedIn
          ? 'Reset your profile and Roll? This clears your account’s copy too, on every device.'
          : 'Reset your profile and Roll?'
        if (confirm(message)) void resetEverywhere()
      }}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.03] py-3 text-sm font-medium text-suit-red transition hover:bg-foreground/[0.07] active:scale-[0.99]"
    >
      <RotateCcw className="size-4" /> Reset profile
    </button>
  )
}

/** Credits and the build, at the foot. */
export function AboutLine() {
  return (
    <div className="flex flex-col items-center gap-1 text-2xs tracking-wide text-muted-foreground/70">
      <a
        href="/credits"
        className="underline-offset-2 transition hover:text-foreground hover:underline"
      >
        Credits
      </a>
      {APP_VERSION && (
        <p className="text-center">
          Pip v{APP_VERSION}
          {BUILD_ID ? ` · ${BUILD_ID}` : ''}
        </p>
      )}
    </div>
  )
}
