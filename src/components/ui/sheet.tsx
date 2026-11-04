'use client'

// The bottom sheet: `dialog.tsx`'s dialog, risen from the bottom edge on a
// phone and centred on a wider screen. It opens only when tapped for, like
// every dialog here; tapping outside, Escape, the close button or dragging the
// handle down puts it away.
//
// The drag lives on an inner layer and the open and close animation on the
// popup, so the two transforms never fight. Only the handle and the title row
// start a drag (`dragListener={false}`): the body scrolls, and a scroll that
// closed the sheet would be the worst kind of surprise.

import type * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { motion, type PanInfo, useDragControls } from 'framer-motion'
import { XIcon } from 'lucide-react'
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** How far down, or how fast, a let-go drag has to be to close the sheet. */
const CLOSE_DISTANCE = 96
const CLOSE_SPEED = 500

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetContent({
  className,
  children,
  title,
  onClose,
}: {
  className?: string
  children: React.ReactNode
  /** The sheet's name, in the row the handle sits on. */
  title: React.ReactNode
  /** Called when a drag lets go far enough down. */
  onClose: () => void
}) {
  const drag = useDragControls()
  const release = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_SPEED) onClose()
  }
  const startDrag = (e: React.PointerEvent) => drag.start(e)
  return (
    <DialogPortal>
      {/* Exit animations hold their last frame (fill-mode-forwards): without it
          the sheet and the blur snap back for a frame before they unmount, a
          flash on every close. The backdrop fades on the sheet's timing. */}
      <DialogOverlay
        forceRender
        className="bg-background/60 duration-300 data-closed:duration-200 data-closed:fill-mode-forwards"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top))] outline-none',
          'duration-300 ease-out data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom data-closed:duration-200 data-closed:fill-mode-forwards',
          'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[calc(100dvh-4rem)] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:data-open:slide-in-from-bottom-8 sm:data-open:fade-in-0 sm:data-closed:slide-out-to-bottom-8 sm:data-closed:fade-out-0',
        )}
      >
        <motion.div
          drag="y"
          dragControls={drag}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.9 }}
          onDragEnd={release}
          className={cn(
            'flex min-h-0 w-full flex-col overflow-hidden rounded-t-[2rem] bg-popover text-popover-foreground ring-1 ring-foreground/10',
            'shadow-[0_-24px_60px_-20px_rgba(0,0,0,0.6)] sm:rounded-[2rem] sm:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]',
            className,
          )}
        >
          {/* The handle and the title: the part you can drag. */}
          <div
            onPointerDown={startDrag}
            className="shrink-0 cursor-grab touch-none select-none px-5 pt-2.5 pb-3 active:cursor-grabbing"
          >
            <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-foreground/20" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <DialogPrimitive.Title className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                onPointerDown={(e) => e.stopPropagation()}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-muted-foreground transition hover:bg-foreground/[0.12] hover:text-foreground active:scale-95"
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
            {children}
          </div>
        </motion.div>
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

export { Sheet, SheetContent }
