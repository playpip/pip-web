'use client'

// "Host your own", for a friend's guest once their game is over (2026-11-02).
//
// Dozens of room codes a week are joined by somebody who never hosts, and
// leaves without hearing that they could. This card is how they hear it: on
// the room's end screen, after their last hand, to a guest without the
// membership. It sits under the end screen's own buttons, never over the felt
// while a hand is live. Not at a quick match (nobody there is a friend) and
// never to the host, who already knows.
//
// The copy holds whatever the free room's seats and camera are: it names one
// free room a day, and what a member's room has.

import { useEffect } from 'react'
import { Mic, Users, Video } from 'lucide-react'
import { membershipFor } from '@/config/membership'
import { MAX_ROOM_SEATS } from '@/lib/multiplayer/room'
import { trackOnce } from '@/lib/analytics'
import { sound } from '@/lib/sound'

/**
 * `onGo` leaves the room for a page (the camera off and the seat given up, the
 * way the end screen's own Back does) rather than a bare link that would walk
 * away from an open socket.
 */
export function HostOwnCard({ onGo }: { onGo: (href: string) => void }) {
  useEffect(() => trackOnce('host-card-seen'), [])
  return (
    <div className="relative isolate w-full max-w-sm overflow-hidden rounded-3xl border border-foreground/15 bg-foreground/[0.05] p-5 text-left shadow-2xl shadow-black/40">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 -z-10 size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pip)_22%,transparent),transparent_65%)] blur-2xl"
      />
      <div className="flex items-center gap-3">
        <span className="flex -space-x-2" aria-hidden>
          {[Users, Video, Mic].map((Icon, i) => (
            <span
              key={i}
              className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary ring-2 ring-background"
            >
              <Icon className="size-4" />
            </span>
          ))}
        </span>
        <h3 className="text-lg font-semibold tracking-tight">Host your own room</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        One room a day is free. Members host as many as they like, up to {MAX_ROOM_SEATS} seats with
        camera and voice.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            trackOnce('host-card-open-tapped')
            onGo('/game/multiplayer')
          }}
          className="flex flex-1 items-center justify-center rounded-2xl bg-foreground/[0.1] py-3 text-sm font-semibold transition hover:bg-foreground/[0.16] active:scale-[0.98]"
        >
          Open a room
        </button>
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            trackOnce('host-card-membership-tapped')
            onGo(membershipFor('multiplayer'))
          }}
          className="flex flex-1 items-center justify-center rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/20 transition hover:bg-primary/90 active:scale-[0.98]"
        >
          See the membership
        </button>
      </div>
    </div>
  )
}
