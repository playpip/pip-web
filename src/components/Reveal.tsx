'use client'

/**
 * A section that arrives as you reach it.
 *
 * **It is visible in the static HTML.** This used to be a Framer `whileInView`
 * with `initial={{ opacity: 0 }}`, and Framer writes `initial` into the
 * prerendered markup as an inline `opacity:0`. Nothing lifts it until React has
 * hydrated and the observer has fired, so with slow or no JavaScript the
 * content was never there, and a section taller than the viewport could miss
 * its `amount` threshold and stay at zero.
 *
 * So the server renders it at rest, and the browser decides after mount: if the
 * element is already on screen it is left alone (no flash), and if it is below
 * the fold it is hidden in a layout effect, before the next paint, and animated
 * in the first time any of it scrolls into view. No React state, so no extra
 * render. `once` because a section that re-animates every time it passes the
 * fold is a section you cannot read while scrolling.
 *
 * Reduced motion skips the whole thing: the content is simply there.
 */

import { useLayoutEffect, useRef } from 'react'
import { animate, inView } from 'framer-motion'

export function Reveal({
  children,
  className,
  /** Seconds of stagger, for two or three things arriving together. */
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useReveal<HTMLDivElement>(delay)
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

function useReveal<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    // Already on screen: it was painted from the HTML, leave it where it is.
    if (el.getBoundingClientRect().top < window.innerHeight) return

    el.style.opacity = '0'
    el.style.transform = 'translateY(12px)'
    // `amount: 'some'` rather than a fraction: a fraction of a very tall
    // section can be more than a screen, and then it never arrives.
    const stop = inView(
      el,
      () => {
        // Explicit keyframes: tweening a transform string to 'none' collapses
        // the element to a zero matrix. Cleared at the end so nothing is left
        // holding a transform (and a stacking context) it no longer needs.
        animate(
          el,
          { opacity: [0, 1], y: [12, 0] },
          { duration: 0.4, ease: 'easeOut', delay },
        ).then(() => {
          el.style.transform = ''
        })
      },
      { amount: 'some', margin: '0px 0px -40px 0px' },
    )
    return () => {
      stop()
      el.style.opacity = ''
      el.style.transform = ''
    }
  }, [delay])
  return ref
}
