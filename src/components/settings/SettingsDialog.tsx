'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { SyncSection } from '@/components/settings/SyncSection'
import { TransferDialog } from '@/components/settings/TransferDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useTheme } from '@/components/theme-provider'
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

/** App settings — the quiet stuff. Looks live in the Style dialog. */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Preferences and backups.</DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-6 pt-1">
          <AppearanceSection />
          <TextSizeSection />
          <SoundSection />
          <HapticsSection />
          <TableTalkSection />
          <HandCoachingSection />
          <TransferSection />
          <ResetSection />
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A labelled on/off switch — the shared shape for every toggle in Settings. */
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition',
          checked ? 'bg-primary' : 'bg-foreground/15',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-background shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}

/** Light or dark — the toggle that used to live in the top bars. */
function AppearanceSection() {
  const { resolvedTheme, setTheme } = useTheme()
  const hydrated = useHydrated()
  const isDark = hydrated && resolvedTheme === 'dark'
  return (
    <ToggleRow
      label="Dark mode"
      hint="Switch the whole app between light and dark."
      checked={isDark}
      onChange={() => {
        sound.play('tap')
        setTheme(isDark ? 'light' : 'dark')
      }}
    />
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
 * the copy says so. Settings opens from the table's own bar, which means a
 * reader can pick 200% mid-hand and watch nothing happen; the second line only
 * shows up in exactly that moment, rather than nagging everyone else about it.
 */
function TextSizeSection() {
  const { scale, setScale } = useTextScale()
  const hydrated = useHydrated()
  const pathname = usePathname()
  // Hydration: `scale` is read from localStorage, so the server render always
  // thinks it is 100 and this line would mismatch without the gate.
  const cappedHere = hydrated && isTableRoute(pathname) && scale > TABLE_MAX_TEXT_SCALE
  return (
    <div>
      <p className="text-sm font-medium">Text size</p>
      <p className="text-xs text-muted-foreground">
        Everything gets bigger. The table stops at {textScaleLabel(TABLE_MAX_TEXT_SCALE)}, because
        past that the seats and the board stop fitting on the screen. Your cards keep their shape.
      </p>
      {cappedHere && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          You are at the table, so this screen is showing {textScaleLabel(TABLE_MAX_TEXT_SCALE)}.
        </p>
      )}
      {/* Real radios, visually hidden. A segmented control built from buttons
          would need role="radio" and hand-rolled arrow-key handling; this gets
          both from the browser, and it is the one control on the page a reader
          who needs it may be driving with the keyboard. */}
      <fieldset className="mt-2.5 flex items-stretch gap-1.5 rounded-xl bg-foreground/[0.06] p-1">
        <legend className="sr-only">Text size</legend>
        {TEXT_SCALES.map((step) => {
          // Before hydration nothing is selected, for the same reason dark mode
          // waits: the stored value is not readable during the server render.
          const active = hydrated && scale === step
          return (
            <label
              key={step}
              className={cn(
                'flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg text-sm font-medium tabular-nums transition',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                active
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
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
              {textScaleLabel(step)}
            </label>
          )
        })}
      </fieldset>
    </div>
  )
}

/** The card snaps, chip clinks and taps — global mute, was a top-bar button. */
function SoundSection() {
  const [muted, setMuted] = useState(sound.isMuted())
  return (
    <ToggleRow
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

/** The cast's rare one-liners at the table — on by default, easy to silence. */
function TableTalkSection() {
  const tableTalk = useProfile((s) => s.tableTalk)
  const setTableTalk = useProfile((s) => s.setTableTalk)
  return (
    <ToggleRow
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
 * Vibration on the physical moments (lib/haptics). Off by default, because a
 * buzz nobody asked for is exactly the casino tell the app is built against.
 *
 * The row hides itself where the browser cannot vibrate at all, which is every
 * iPhone and every Safari. A toggle that provably does nothing is worse than no
 * toggle: it reads as a broken feature rather than an absent one. It is gated
 * on `useHydrated` because the server cannot know, and rendering the row and
 * then removing it is a hydration mismatch.
 *
 * Turning it on fires one buzz, deliberately. You should feel the thing you
 * just switched on, and it is the only way to check it works on your device.
 */
function HapticsSection() {
  const hydrated = useHydrated()
  const enabled = useProfile((s) => s.haptics)
  const setHaptics = useProfile((s) => s.setHaptics)
  if (!hydrated || !haptics.supported()) return null
  return (
    <ToggleRow
      label="Vibration"
      hint="A short tap on the deal, your chips going in, and a pot won."
      checked={enabled}
      onChange={() => {
        const next = !enabled
        sound.play('tap')
        setHaptics(next)
        if (next) haptics.fire('commit')
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
function HandCoachingSection() {
  const handCoaching = useProfile((s) => s.handCoaching)
  const setHandCoaching = useProfile((s) => s.setHandCoaching)
  return (
    <ToggleRow
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
 * Wipe the profile and Roll back to a clean start — guarded by a confirm.
 *
 * Resetting clears the account's copy too, so the confirm has to say so while
 * signed in. This is the one button that can cost someone their progress on
 * every device at once, and it must not read like a local-only tidy-up.
 */
function ResetSection() {
  const resetEverywhere = useSync((s) => s.resetEverywhere)
  const signedIn = useSync((s) => s.status === 'signed-in')
  return (
    <button
      onClick={() => {
        const message = signedIn
          ? 'Reset your profile and Roll? This clears your account’s copy too, on every device.'
          : 'Reset your profile and Roll?'
        if (confirm(message)) void resetEverywhere()
      }}
      className="flex items-center justify-center gap-2 rounded-xl bg-foreground/[0.06] py-2.5 text-sm font-medium text-suit-red transition hover:bg-foreground/[0.12]"
    >
      <RotateCcw className="size-4" /> Reset profile
    </button>
  )
}

/**
 * Keeping your progress: one section, two buttons.
 *
 * This had grown into two headings, five buttons and a stray text link, all
 * answering the same question, with a four-field sign-in flow sharing a scroll
 * with the dark-mode toggle. Both real tasks now open their own dialog and
 * Settings keeps only the doors.
 *
 * The heading names the account when there is one to name. "Move to another
 * device" describes only the by-hand route, and filing the account under it
 * hid the account from everyone who had one device and simply didn't want to
 * lose it. Builds with no Supabase project keep the old heading, because in
 * those the by-hand route is genuinely all there is.
 */
function TransferSection() {
  const [transferOpen, setTransferOpen] = useState(false)
  const syncOff = useSync((s) => s.status === 'off')

  return (
    <div>
      <p className="mb-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
        {syncOff ? 'Move to another device' : 'Your account'}
      </p>

      {syncOff ? (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Your progress lives on this device. Carry it across as a code, a QR or a file, with no
          account needed.
        </p>
      ) : (
        <SyncSection />
      )}

      <button
        onClick={() => {
          sound.play('tap')
          setTransferOpen(true)
        }}
        className={cn(
          'flex w-full items-center justify-center transition',
          syncOff
            ? 'min-h-11 rounded-xl bg-foreground/[0.06] py-3 text-sm font-medium hover:bg-foreground/[0.12]'
            : 'mt-1 min-h-11 text-xs text-muted-foreground/70 underline-offset-2 hover:text-foreground hover:underline',
        )}
      >
        {syncOff ? 'Move it by hand' : 'Carry it across by hand instead'}
      </button>

      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  )
}
