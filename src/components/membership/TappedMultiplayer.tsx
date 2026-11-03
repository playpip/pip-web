'use client'

// The rules a host sets, under the answer to a tap on the multiplayer padlock.
// That padlock is "Host your own table" on the multiplayer page, so the tap is
// somebody asking what hosting gets them; the blurb above says rooms, camera,
// slow games and quick match, and this lists every choice a room's host makes,
// live or slow, from the same lists the room is opened with
// (`config/roomRules.ts`). Read-only: pills, not buttons, so nothing here looks
// like it can be pressed.
//
// Loaded on its own (`next/dynamic` in TappedFor), like the other samples.

import {
  BLIND_CHOICES,
  DEPTH_CHOICES,
  ENDING_CHOICES,
  LEAVING_CHOICES,
  MOVE_CHOICES,
  PACE_CHOICES,
  SEAT_CHOICES,
  SLOW_SEAT_CHOICES,
  TURN_CHOICES,
} from '@/config/roomRules'
import { VENUES } from '@/config/venues'
import { useMoney } from '@/lib/useMoney'

type Rules = readonly (readonly [string, readonly string[]])[]

const label = <T,>(options: readonly (readonly [T, string])[]) => options.map(([, text]) => text)

/** What a slow game picks instead of the turn timer and the live seat counts. */
const SLOW_RULES: Rules = [
  ['Seats', label(SLOW_SEAT_CHOICES)],
  ['Time per move', label(MOVE_CHOICES)],
  ['Ends', label(ENDING_CHOICES)],
]

export function TappedMultiplayer() {
  const money = useMoney()
  const rules: Rules = [
    ['Pace', label(PACE_CHOICES)],
    ['Chips', ['From the Roll', 'Just for fun']],
    ['Stakes', [`${money(VENUES[0].buyIn)} to ${money(VENUES[VENUES.length - 1].buyIn)} buy-in`]],
    ['Seats', label(SEAT_CHOICES)],
    ['Starting chips', label(DEPTH_CHOICES)],
    ['Blinds', label(BLIND_CHOICES)],
    ['Turn time', label(TURN_CHOICES)],
    ['If someone leaves', label(LEAVING_CHOICES)],
  ]

  return (
    <figure className="mt-5 rounded-xl border border-foreground/10 bg-background/60 px-4 py-4">
      <figcaption className="text-sm text-muted-foreground">
        What a host picks when they open a room.
      </figcaption>
      <RuleList rules={rules} />
      <p className="mt-5 text-sm font-medium">A slow game, a move at a time</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The clock stops in each player’s quiet hours.
      </p>
      <RuleList rules={SLOW_RULES} />
      <p className="mt-4 text-sm text-muted-foreground">
        Everyone at the table can read them. In a private room, only the host needs a room: one a
        day is free, up to four seats and without camera or voice. The membership opens more, up to
        eight seats, with camera and voice.
      </p>
    </figure>
  )
}

function RuleList({ rules }: { rules: Rules }) {
  return (
    <dl className="mt-3 flex flex-col gap-3">
      {rules.map(([rule, choices]) => (
        <div key={rule}>
          <dt className="text-sm font-medium">{rule}</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {choices.map((choice) => (
              <span
                key={choice}
                className="rounded-full bg-foreground/[0.06] px-3 py-1 text-xs font-semibold tabular-nums text-muted-foreground"
              >
                {choice}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}
