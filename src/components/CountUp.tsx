'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

/** Smoothly tweens between numeric values instead of snapping. */
export function CountUp({
  value,
  className,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 0.6,
}: {
  value: number
  className?: string
  format?: (n: number) => string
  duration?: number
}) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    prev.current = value
    return () => controls.stop()
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
