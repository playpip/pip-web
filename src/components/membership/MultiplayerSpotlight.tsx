'use client'

// The membership page's headline: multiplayer, drawn as the table it is.
//
// A felt seen from above with five chairs round it, two of them on camera and
// one talking, and the room code on the cloth where the cards will land: the
// lobby a host actually sees. Faces are the cast's, because a picture of a
// stranger's webcam would be a picture of nobody we know.

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Hourglass, Mic, UserPlus, Users, Video, Zap } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { CAST } from '@/config/cast'
import type { MembershipFeature } from '@/config/membership'
import { cn } from '@/lib/utils'

/** Where the five chairs sit round the oval, in percent of the frame. */
const CHAIRS = [
  { left: 12, top: 52, live: true, talking: false },
  { left: 28, top: 14, live: false, talking: false },
  { left: 72, top: 14, live: true, talking: true },
  { left: 88, top: 52, live: false, talking: false },
  { left: 50, top: 90, live: false, talking: false },
] as const

const POINTS = [
  {
    icon: Video,
    title: 'Your camera, in your seat',
    body: 'Turn it on and your face takes the place of your avatar. Off until you tap it.',
  },
  {
    icon: Mic,
    title: 'Talk across the table',
    body: 'Turn your mic on and everyone in the room hears you while you play.',
  },
  {
    icon: Users,
    title: 'Friends join free',
    body: 'Everyone else needs a free Pip account and the code. One room a day of up to four seats, without camera or voice, is free to host.',
  },
  {
    icon: Hourglass,
    title: 'A slow game',
    body: 'An hour to a day for each move, and the clock stops in each player’s quiet hours. For friends who are never free at once.',
  },
  {
    icon: UserPlus,
    title: 'Short a player',
    body: 'Sit one of the regulars in the empty chair. Live rooms only; a slow game is just friends.',
  },
  {
    icon: Zap,
    title: 'Quick match',
    body: 'Pick a stake and get dealt in. AI players fill any empty seat.',
  },
] as const

export function MultiplayerSpotlight({ feature }: { feature: MembershipFeature }) {
  const faces = CAST.slice(0, CHAIRS.length)
  return (
    <div className="grid items-center gap-6 md:grid-cols-[1.1fr_1fr] md:gap-10">
      <div
        data-mirror="skip"
        aria-hidden
        className="relative mx-auto aspect-[16/11] w-full max-w-xl"
      >
        {/* The oval, lit in the brand colour like a table finish. */}
        <div className="absolute inset-[12%_10%] rounded-[50%] bg-[color-mix(in_oklab,var(--color-pip)_22%,var(--color-table-cloth))] shadow-[inset_0_2px_30px_var(--color-table-shade),0_20px_60px_-20px_var(--color-table-shade)] ring-[6px] ring-[color-mix(in_oklab,var(--color-table-shade)_80%,transparent)]" />
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
          <span className="text-3xs uppercase tracking-[0.25em] text-muted-foreground md:text-2xs">
            Room code
          </span>
          <span className="font-mono text-xl font-semibold tracking-[0.3em] md:text-3xl">
            4YDW82
          </span>
        </div>
        {CHAIRS.map((chair, i) => {
          const face = faces[i]
          if (!face) return null
          return (
            <motion.div
              key={face.id}
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.08 * i }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${chair.left}%`, top: `${chair.top}%` }}
            >
              <div
                className={cn(
                  'relative rounded-full shadow-lg shadow-table-shade/70 ring-2',
                  chair.talking ? 'ring-primary/80' : 'ring-table-shade',
                )}
              >
                <PlayerAvatar spec={face.avatar} size={chair.live ? 64 : 52} />
                {chair.live && (
                  <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
                    <Video className="size-3" />
                  </span>
                )}
              </div>
              {chair.talking && (
                <span className="absolute -right-6 top-1 flex items-end gap-0.5" aria-hidden>
                  {[6, 10, 7].map((h, k) => (
                    <motion.span
                      key={k}
                      className="w-0.5 rounded-full bg-primary/80"
                      animate={{ height: [h * 0.5, h, h * 0.5] }}
                      transition={{
                        duration: 0.9,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: k * 0.15,
                      }}
                      style={{ height: h }}
                    />
                  ))}
                </span>
              )}
            </motion.div>
          )
        })}
      </div>

      <div>
        <p className="text-muted-foreground md:text-lg">{feature.blurb}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        {feature.place && (
          <Link
            href={feature.place.href}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.04] px-5 text-sm font-semibold transition hover:bg-foreground/[0.08] active:scale-[0.97]"
          >
            See multiplayer
          </Link>
        )}
      </div>
    </div>
  )
}
