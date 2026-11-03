'use client'

// A private room's rules: set on the multiplayer page as the room is opened,
// and shown read-only at the room to everybody, host included.
//
// One grouped list, a row per rule and a segmented choice in each, the way
// the table builder reads. The server checks every value when the room is
// created; nothing here is the rule.

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  BLIND_CHOICES,
  DEPTH_CHOICES,
  ENDING_CHOICES,
  ENDING_HAND_CHOICES,
  LEAVING_CHOICES,
  MOVE_CHOICES,
  PACE_CHOICES,
  SEAT_CHOICES,
  SLOW_SEAT_CHOICES,
  TURN_CHOICES,
  type EndingKind,
  type Pace,
} from '@/config/roomRules'
import { membershipFor } from '@/config/membership'
import {
  DEFAULT_ROOM_SEATS,
  type BlindSpeed,
  type LeavingRule,
  type RoomSettings,
} from '@/lib/multiplayer/room'
import { DEFAULT_ENDING, DEFAULT_MOVE_HOURS, type SlowEnding } from '@/lib/multiplayer/slow'
import { sound } from '@/lib/sound'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

/** The table's rules as a dialog: read-only, for anybody at a room. */
export function RoomRulesDialog({
  open,
  onOpenChange,
  settings,
  buyIn,
  slow = false,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: RoomSettings
  buyIn: number
  slow?: boolean
  /** Anything under the rules: a slow game's way out. */
  children?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Table rules</DialogTitle>
        </DialogHeader>
        <SettingsList settings={settings} buyIn={buyIn} slow={slow} />
        {children}
      </DialogContent>
    </Dialog>
  )
}

/** Live and slow rooms take different seats; switching pace starts from that pace's defaults. */
export function settingsForPace(settings: RoomSettings, pace: Pace): RoomSettings {
  if (pace === 'slow') {
    return {
      ...settings,
      seats: Math.min(settings.seats, 4) === settings.seats ? settings.seats : 2,
      moveHours: settings.moveHours ?? DEFAULT_MOVE_HOURS,
      ending: settings.ending ?? DEFAULT_ENDING,
    }
  }
  const { moveHours: _m, ending: _e, ...live } = settings
  return { ...live, seats: DEFAULT_ROOM_SEATS }
}

/** A week from now at eight in the evening: where an end date starts. */
function aWeekOn(): number {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(20, 0, 0, 0)
  return d.getTime()
}

/** A timestamp as a `datetime-local` input wants it: local time, to the minute. */
function toLocalInput(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Every rule, a row each. Editable on the multiplayer page as a room is
 * opened; read-only everywhere after that.
 */
export function SettingsList({
  settings,
  buyIn,
  onChange,
  stakes,
  slow = false,
  onPace,
  seatCap,
}: {
  settings: RoomSettings
  buyIn: number
  /** Absent: read-only. */
  onChange?: (patch: Partial<RoomSettings>) => void
  /** The stake picker, straight after the chips choice it depends on. */
  stakes?: React.ReactNode
  /** A slow game: moves in hours, and an ending. */
  slow?: boolean
  /** Offered while a room is being opened: live or slow. */
  onPace?: (pace: Pace) => void
  /**
   * Hosting without the membership: seats past this are shown locked, and a
   * tap on one goes to the membership.
   */
  seatCap?: number
}) {
  const money = useMoney()
  const editable = onChange !== undefined
  const set = (patch: Partial<RoomSettings>) => {
    if (!onChange) return
    sound.play('tap')
    onChange(patch)
  }
  const ending: SlowEnding = settings.ending ?? DEFAULT_ENDING
  const pickEnding = (kind: EndingKind) =>
    set({
      ending:
        kind === 'hands'
          ? { kind, hands: 50 }
          : kind === 'date'
            ? { kind, at: aWeekOn() }
            : { kind: 'last-standing' },
    })
  return (
    <div className="divide-y divide-foreground/[0.07] overflow-hidden rounded-2xl bg-foreground/[0.04]">
      {onPace && (
        <Row label="Pace">
          <Choice<Pace>
            value={slow ? 'slow' : 'live'}
            options={PACE_CHOICES}
            onPick={(pace) => {
              sound.play('tap')
              onPace(pace)
            }}
            editable={editable}
          />
        </Row>
      )}
      {slow && (
        <>
          <Row label="Time per move">
            <Choice
              value={settings.moveHours ?? DEFAULT_MOVE_HOURS}
              options={MOVE_CHOICES}
              onPick={(moveHours) => set({ moveHours })}
              editable={editable}
            />
          </Row>
          <Row label="Ends">
            <Choice<EndingKind>
              value={ending.kind}
              options={ENDING_CHOICES}
              onPick={pickEnding}
              editable={editable}
            />
            {ending.kind === 'hands' && (
              <Choice
                value={ending.hands}
                options={ENDING_HAND_CHOICES}
                onPick={(hands) => set({ ending: { kind: 'hands', hands } })}
                editable={editable}
              />
            )}
            {ending.kind === 'date' &&
              (editable ? (
                <input
                  type="datetime-local"
                  value={toLocalInput(ending.at)}
                  min={toLocalInput(Date.now() + 60 * 60 * 1000)}
                  onChange={(e) => {
                    const at = new Date(e.target.value).getTime()
                    if (Number.isFinite(at)) onChange?.({ ending: { kind: 'date', at } })
                  }}
                  aria-label="End date"
                  className="rounded-xl bg-foreground/[0.05] px-3 py-2 text-sm font-medium [color-scheme:dark]"
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  {new Date(ending.at).toLocaleString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ))}
          </Row>
        </>
      )}
      <Row label="Chips">
        <Choice
          value={settings.forRoll}
          options={[
            [true, `${money(buyIn)} from the Roll`],
            [false, 'Just for fun'],
          ]}
          onPick={(forRoll) => set({ forRoll })}
          editable={editable}
        />
      </Row>
      {stakes && <Row label="Stakes">{stakes}</Row>}
      <Row label="Seats">
        <Choice
          value={settings.seats}
          options={slow ? SLOW_SEAT_CHOICES : SEAT_CHOICES}
          onPick={(seats) => set({ seats })}
          editable={editable}
          locked={editable && seatCap !== undefined ? (n) => n > seatCap : undefined}
        />
      </Row>
      <Row label="Starting chips">
        <Choice
          value={settings.depth}
          options={DEPTH_CHOICES}
          onPick={(depth) => set({ depth })}
          editable={editable}
        />
      </Row>
      <Row label="Blinds">
        <Choice<BlindSpeed>
          value={settings.blinds}
          options={BLIND_CHOICES}
          onPick={(blinds) => set({ blinds })}
          editable={editable}
        />
      </Row>
      {!slow && (
        <>
          <Row label="Turn time">
            <Choice
              value={settings.turnSeconds}
              options={TURN_CHOICES}
              onPick={(turnSeconds) => set({ turnSeconds })}
              editable={editable}
            />
          </Row>
          <Row label="If someone leaves">
            <Choice<LeavingRule>
              value={settings.leaving}
              options={LEAVING_CHOICES}
              onPick={(leaving) => set({ leaving })}
              editable={editable}
            />
          </Row>
        </>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  )
}

/** A row of choices with a highlight that slides to the picked one. */
function Choice<T extends string | number | boolean>({
  value,
  options,
  onPick,
  editable,
  locked,
}: {
  value: T
  options: readonly (readonly [T, string])[]
  onPick: (value: T) => void
  editable: boolean
  /** Choices that come with the membership: drawn with a lock, a tap goes to it. */
  locked?: (value: T) => boolean
}) {
  const id = options.map(([v]) => String(v)).join('-')
  return (
    <div className="flex rounded-xl bg-foreground/[0.05] p-0.5">
      {options.map(([v, label]) => {
        const on = v === value
        if (locked?.(v)) {
          return (
            <Link
              key={String(v)}
              href={membershipFor('multiplayer')}
              onClick={() => sound.play('tap')}
              aria-label={`${label}, with the membership`}
              className="relative flex flex-1 items-center justify-center gap-0.5 rounded-[10px] px-1 py-2 text-xs font-semibold text-muted-foreground/60 transition-colors hover:text-foreground sm:text-sm"
            >
              <Lock aria-hidden className="size-3 shrink-0" />
              {label}
            </Link>
          )
        }
        return (
          <button
            key={String(v)}
            onClick={() => !on && onPick(v)}
            disabled={!editable}
            aria-pressed={on}
            className={cn(
              'relative flex-1 rounded-[10px] px-2 py-2 text-xs font-semibold transition-colors sm:text-sm',
              on ? 'text-foreground' : 'text-muted-foreground',
              editable && !on && 'hover:text-foreground',
            )}
          >
            {on && (
              <motion.span
                layoutId={`room-setting-${id}`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-[10px] bg-foreground/[0.1] ring-1 ring-foreground/10"
              />
            )}
            <span className="relative">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
