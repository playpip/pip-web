'use client'

// The live pieces of a private table: a camera drawn where a face would be,
// each other seat's voice, and the two buttons that turn yours on.

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { AvatarRing } from '@/config/cosmetics'
import { membershipFor } from '@/config/membership'
import type { AvatarSpec } from '@/lib/avatar'
import { voiceMeter } from '@/lib/multiplayer/voice'
import { cn } from '@/lib/utils'
import { mediaSupported, useMedia } from '@/store/media'
import { useRoom } from '@/store/room'
import type { MediaState } from '@/lib/multiplayer/protocol'
import { sound } from '@/lib/sound'

/**
 * A seat's face at a private table: their camera when it is on, their avatar
 * when it is not, and, while their mic is on, a ring in Pip's blue that grows
 * and brightens with how loud they are speaking.
 *
 * Exactly the avatar's size either way, so turning a camera on moves nothing
 * on the felt. Your own camera is mirrored, the way every front camera shows
 * you yourself; everybody else sees you the right way round.
 */
export function SeatFace({
  video,
  voice,
  avatar,
  ring,
  size,
  mirrored = false,
  dimmed = false,
  onExpand,
}: {
  /** The camera, when it is on. */
  video?: MediaStream | null
  /** The voice, when the mic is on. Drives the ring. */
  voice?: MediaStream | null
  avatar: AvatarSpec
  /** An avatar ring cosmetic, for your own face. */
  ring?: AvatarRing
  size: number
  mirrored?: boolean
  dimmed?: boolean
  /**
   * Tapping a camera opens it large (`FaceViewer`). Only where the face is not
   * already inside a button: a seat on the rail passes its own tap instead.
   */
  onExpand?: () => void
}) {
  const camera = video ? (
    <span className="block size-full overflow-hidden rounded-full bg-foreground/5">
      <video
        // Assigned in a ref callback rather than an effect: the element
        // owns its stream for as long as it is mounted, and a new stream is
        // a new value the callback sees on the next render.
        ref={(el) => {
          if (el && el.srcObject !== video) el.srcObject = video
        }}
        autoPlay
        playsInline
        // Sound comes through `PeerAudio`, so it plays with the camera off.
        muted
        className={cn(
          'size-full object-cover transition-opacity',
          mirrored && '-scale-x-100',
          dimmed && 'opacity-40 grayscale',
        )}
      />
    </span>
  ) : null
  return (
    <span className="relative block rounded-full" style={{ width: size, height: size }}>
      {camera && onExpand ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            sound.play('tap')
            onExpand()
          }}
          aria-label="Show camera larger"
          // The hero panel's face sits in a layer that ignores taps; this one
          // takes them.
          className="pointer-events-auto block size-full rounded-full"
        >
          {camera}
        </button>
      ) : (
        (camera ?? <PlayerAvatar spec={avatar} size={size} ring={ring} dimmed={dimmed} />)
      )}
      {voice && <VoiceRing stream={voice} />}
    </span>
  )
}

/**
 * Somebody's camera, nearly full screen: tap a seat's face to see it properly.
 * Tap anywhere or press Escape to put it back. Closes itself if the camera
 * goes off, because the caller stops passing a stream.
 */
export function FaceViewer({
  video,
  voice,
  name,
  mirrored = false,
  onClose,
}: {
  video: MediaStream
  voice?: MediaStream | null
  name: string
  mirrored?: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-label={`${name}’s camera`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/85 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative aspect-[4/3] w-[min(92vw,calc(78dvh*4/3))] rounded-3xl"
      >
        <span className="block size-full overflow-hidden rounded-3xl bg-foreground/5 shadow-2xl">
          <video
            ref={(el) => {
              if (el && el.srcObject !== video) el.srcObject = video
            }}
            autoPlay
            playsInline
            muted
            className={cn('size-full object-cover', mirrored && '-scale-x-100')}
          />
        </span>
        {voice && <VoiceRing stream={voice} shape="rounded-3xl" />}
      </motion.div>
      <span className="text-sm font-medium">{name}</span>
    </motion.div>
  )
}

/**
 * The ring that follows a voice.
 *
 * Drawn straight onto the element every frame, not through React state: six
 * seats re-rendering sixty times a second for a ring would be the table
 * spending its time on the wrong thing. Quick to rise and slow to fall, like a
 * meter, so it reads as speech rather than flicker.
 */
function VoiceRing({
  stream,
  shape = 'rounded-full',
}: {
  stream: MediaStream
  /** The outline follows the face it is drawn round. */
  shape?: string
}) {
  const el = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const meter = voiceMeter(stream)
    if (!meter) return
    let shown = 0
    let frame = 0
    const draw = () => {
      const level = meter.level()
      shown = level > shown ? shown + (level - shown) * 0.5 : shown * 0.88
      const node = el.current
      if (node) {
        const on = shown > 0.04
        node.style.opacity = on ? String(0.45 + shown * 0.55) : '0'
        node.style.boxShadow = `0 0 0 ${(1.5 + shown * 4).toFixed(2)}px var(--color-pip), 0 0 ${(4 + shown * 14).toFixed(1)}px color-mix(in oklab, var(--color-pip) 70%, transparent)`
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      meter.stop()
    }
  }, [stream])
  return (
    <span
      ref={el}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150',
        shape,
      )}
    />
  )
}

/** One other seat's voice. Nothing to see; it plays while their mic is on. */
export function PeerAudio({ stream }: { stream: MediaStream }) {
  return (
    // biome-ignore lint/a11y/useMediaCaption: a live voice at the table has no caption track
    <audio
      ref={(el) => {
        if (el && el.srcObject !== stream) el.srcObject = stream
      }}
      autoPlay
      className="hidden"
    />
  )
}

/** Every other seat's voice, for the seats whose mic is on. */
export function TableAudio({ media }: { media: Record<string, MediaState> }) {
  const remote = useMedia((s) => s.remote)
  const muted = useMedia((s) => s.muted)
  return (
    <>
      {Object.entries(remote)
        .filter(([id]) => media[id]?.mic && !muted[id])
        .map(([id, stream]) => (
          <PeerAudio key={id} stream={stream} />
        ))}
    </>
  )
}

const PROBLEM_COPY = {
  denied:
    'Pip isn’t allowed to use your camera or mic. Turn it on in your settings, then try again.',
  unsupported: 'This browser can’t share a camera or mic.',
  unavailable: 'No camera or mic was found, or another app is using it.',
} as const

/**
 * Camera and mic, each one tap. Off by default, and the table plays exactly
 * the same with both off.
 */
export function MediaControls({
  className,
  bar = false,
}: {
  className?: string
  /**
   * In the top bar beside palette and settings (desktop), sized like them.
   * Off, two round buttons on the felt (a phone, where the bar has no room).
   */
  bar?: boolean
}) {
  const camera = useMedia((s) => s.camera)
  const mic = useMedia((s) => s.mic)
  const problem = useMedia((s) => s.problem)
  const toggleCamera = useMedia((s) => s.toggleCamera)
  const toggleMic = useMedia((s) => s.toggleMic)
  const locked = useLocked()
  if (!mediaSupported()) return null
  const buttons = locked ? (
    <>
      <LockedButton bar={bar} label="Camera" onClick={locked}>
        <VideoOff className="size-4" />
      </LockedButton>
      <LockedButton bar={bar} label="Mic" onClick={locked}>
        <MicOff className="size-4" />
      </LockedButton>
    </>
  ) : (
    <>
      <MediaButton
        bar={bar}
        on={camera}
        label={camera ? 'Turn camera off' : 'Turn camera on'}
        onClick={() => {
          sound.play('tap')
          void toggleCamera()
        }}
      >
        {camera ? <Video className="size-4" /> : <VideoOff className="size-4" />}
      </MediaButton>
      <MediaButton
        bar={bar}
        on={mic}
        label={mic ? 'Mute' : 'Turn mic on'}
        onClick={() => {
          sound.play('tap')
          void toggleMic()
        }}
      >
        {mic ? <Mic className="size-4" /> : <MicOff className="size-4" />}
      </MediaButton>
    </>
  )
  if (bar) return buttons
  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      <div className="flex gap-2">{buttons}</div>
      {problem && <MediaProblem />}
    </div>
  )
}

/**
 * Camera and mic as two separate small buttons, for a phone: in the corners of
 * your own panel at the table and beside your face in the lobby, by your thumb,
 * because the top bar has no room for them there.
 */
export function CameraToggle() {
  const camera = useMedia((s) => s.camera)
  const toggleCamera = useMedia((s) => s.toggleCamera)
  const locked = useLocked()
  if (!mediaSupported()) return null
  if (locked) {
    return (
      <LockedButton bar label="Camera" onClick={locked}>
        <VideoOff className="size-4" />
      </LockedButton>
    )
  }
  return (
    <MediaButton
      bar
      on={camera}
      label={camera ? 'Turn camera off' : 'Turn camera on'}
      onClick={() => {
        sound.play('tap')
        void toggleCamera()
      }}
    >
      {camera ? <Video className="size-4" /> : <VideoOff className="size-4" />}
    </MediaButton>
  )
}

export function MicToggle() {
  const mic = useMedia((s) => s.mic)
  const toggleMic = useMedia((s) => s.toggleMic)
  const locked = useLocked()
  if (!mediaSupported()) return null
  if (locked) {
    return (
      <LockedButton bar label="Mic" onClick={locked}>
        <MicOff className="size-4" />
      </LockedButton>
    )
  }
  return (
    <MediaButton
      bar
      on={mic}
      label={mic ? 'Mute' : 'Turn mic on'}
      onClick={() => {
        sound.play('tap')
        void toggleMic()
      }}
    >
      {mic ? <Mic className="size-4" /> : <MicOff className="size-4" />}
    </MediaButton>
  )
}

/** Why the camera or mic would not start, said once, quietly. */
export function MediaProblem({ className }: { className?: string }) {
  const problem = useMedia((s) => s.problem)
  if (!problem) return null
  return (
    <p className={cn('max-w-[16rem] text-center text-2xs text-muted-foreground', className)}>
      {PROBLEM_COPY[problem]}
    </p>
  )
}

/**
 * At a room hosted without the membership the camera and mic are locked: the
 * tap goes to the membership instead. Null at every other table.
 */
function useLocked(): (() => void) | null {
  const router = useRouter()
  const locked = useRoom((s) => s.view?.media === false)
  if (!locked) return null
  return () => {
    sound.play('tap')
    router.push(membershipFor('multiplayer'))
  }
}

/** A camera or mic button with a padlock on it, for a room without them. */
function LockedButton({
  bar,
  label,
  onClick,
  children,
}: {
  bar: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  const text = `${label}, with the membership`
  return (
    <button
      onClick={onClick}
      aria-label={text}
      title={text}
      className={cn(
        'relative grid place-items-center rounded-full text-muted-foreground/60 transition hover:text-foreground active:scale-95',
        bar
          ? 'p-2 hover:bg-foreground/5'
          : 'size-10 bg-foreground/[0.08] hover:bg-foreground/[0.14]',
      )}
    >
      {children}
      <span
        aria-hidden
        className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-background ring-1 ring-foreground/15"
      >
        <Lock className="size-2.5" />
      </span>
    </button>
  )
}

function MediaButton({
  bar,
  on,
  label,
  onClick,
  children,
}: {
  bar: boolean
  on: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={cn(
        'grid place-items-center rounded-full transition active:scale-95',
        bar
          ? // The AppBar's own icon buttons, lit while on.
            cn(
              'p-2',
              on
                ? 'bg-primary/15 text-primary hover:bg-primary/25'
                : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
            )
          : cn(
              'size-10',
              on
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-foreground/[0.08] text-muted-foreground hover:bg-foreground/[0.14] hover:text-foreground',
            ),
      )}
    >
      {children}
    </button>
  )
}
