'use client'

// Settings → Notifications: what Pip pushes (your move in a slow game,
// somebody passing you on the board, your streak ending), the slow games'
// email, and the hours it leaves you alone. Kept on the room server with your account
// (`rooms/src/player.ts`), so the same on every device, and a game's clock
// follows a change straight away.

import { useEffect, useState } from 'react'
import { Bell, Mail, Moon } from 'lucide-react'
import { SettingsGroup, SettingsRow, SwitchRow } from '@/components/settings/group'
import {
  devSignedIn,
  fetchNotifySettings,
  roomsConfigured,
  saveNotifyPrefs,
} from '@/lib/multiplayer/client'
import { DEFAULT_PREFS, type PlayPrefs } from '@/lib/multiplayer/notices'
import { enablePush, pushSupport } from '@/lib/push'
import { sound } from '@/lib/sound'
import { useSync } from '@/store/sync'

/** This device's timezone, which is the one quiet hours are kept in. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const toClock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const fromClock = (value: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(value)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function SlowGamesSection() {
  const signedIn = useSync((s) => s.status === 'signed-in') || devSignedIn()
  if (!signedIn || !roomsConfigured()) return null
  return <SlowGamesSwitches />
}

function SlowGamesSwitches() {
  const [prefs, setPrefs] = useState<PlayPrefs | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const support = pushSupport()

  useEffect(() => {
    let live = true
    void fetchNotifySettings().then((got) => {
      if (!live) return
      if (!got) return setProblem('Couldn’t load these. Try again when you’re online.')
      setPrefs({ ...got.prefs, tz: deviceTimeZone() })
    })
    return () => {
      live = false
    }
  }, [])

  const save = async (patch: Partial<PlayPrefs>) => {
    const next = { ...(prefs ?? { ...DEFAULT_PREFS, tz: deviceTimeZone() }), ...patch }
    setPrefs(next)
    setProblem(null)
    if (!(await saveNotifyPrefs(next))) setProblem('Couldn’t save that. Try again.')
  }

  const flipPush = async () => {
    sound.play('tap')
    if (prefs?.push) return save({ push: false })
    // Turning it on asks this device too: it is the tap a browser needs.
    const result = await enablePush()
    if (result === 'denied')
      setProblem('Notifications are blocked for Pip in this browser’s settings.')
    await save({ push: true })
  }

  const clock =
    'rounded-lg bg-foreground/[0.06] px-2 py-1.5 text-sm tabular-nums [color-scheme:dark] disabled:opacity-40'

  return (
    <SettingsGroup label="Notifications">
      <SwitchRow
        icon={Bell}
        tint="coral"
        label="Push notifications"
        hint={
          support === 'install'
            ? 'On iPhone, add Pip to your Home Screen to get these.'
            : 'On every device you’ve allowed.'
        }
        checked={prefs?.push ?? false}
        disabled={!prefs || support === 'none' || support === 'install'}
        onChange={() => void flipPush()}
      />
      {/* What is pushed, each under the main switch, set in under its label. */}
      {(
        [
          ['slow', 'Slow games', 'When it’s your move.'],
          ['rating', 'Leaderboard', 'When someone passes you on the Pip Rating.'],
          ['streak', 'Streak', 'When your streak is about to end.'],
        ] as const
      ).map(([key, label, hint]) => (
        <div key={key} className="@[16rem]:pl-11">
          <SwitchRow
            label={label}
            hint={hint}
            checked={(prefs?.push && prefs[key]) ?? false}
            disabled={!prefs?.push}
            onChange={() => {
              sound.play('tap')
              void save({ [key]: !prefs?.[key] })
            }}
          />
        </div>
      ))}
      <SwitchRow
        icon={Mail}
        tint="blue"
        label="Slow game emails"
        hint="When a move is still waiting. One at most every 12 hours."
        checked={prefs?.email ?? false}
        disabled={!prefs}
        onChange={() => {
          sound.play('tap')
          void save({ email: !prefs?.email })
        }}
      />
      <SettingsRow
        icon={Moon}
        tint="pip"
        label="Quiet hours"
        hint="Slow game clocks stop and nothing is sent."
      >
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm @[16rem]:pl-11">
          <input
            type="time"
            aria-label="Quiet hours start"
            value={toClock(prefs?.quietFrom ?? DEFAULT_PREFS.quietFrom)}
            disabled={!prefs}
            onChange={(e) => {
              const v = fromClock(e.target.value)
              if (v !== null) void save({ quietFrom: v })
            }}
            className={clock}
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="time"
            aria-label="Quiet hours end"
            value={toClock(prefs?.quietTo ?? DEFAULT_PREFS.quietTo)}
            disabled={!prefs}
            onChange={(e) => {
              const v = fromClock(e.target.value)
              if (v !== null) void save({ quietTo: v })
            }}
            className={clock}
          />
        </div>
      </SettingsRow>
      {problem && <p className="px-4 py-3 text-xs leading-relaxed text-suit-red">{problem}</p>}
    </SettingsGroup>
  )
}
