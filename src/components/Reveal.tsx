'use client'

/**
 * A section that arrives as you reach it.
 *
 * `/stats` had the effect first, done with a mount animation and a hand-tuned
 * delay per section — which works for the two blocks above the fold and is a
 * lie for everything below it: by the time you have scrolled to the venues,
 * they animated a second ago, off-screen, and you meet them already at rest.
 *
 * `whileInView` is the honest version of the same idea, and it is the only
 * thing in here: same rise, same easing, same duration. `once` because a
 * section that re-animates every time it passes the fold is a section you
 * cannot read while scrolling.
 *
 * **Reduced motion is honoured by Framer's own setting**, which the two screens
 * using this already wrap in `MotionConfig reducedMotion="user"` at the app
 * level — the transform is dropped and the content is simply there.
 */

import { motion } from 'framer-motion'

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
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}
