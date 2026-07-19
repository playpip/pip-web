'use client'

import { motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'

/**
 * The shell for a lobby sub-page (Venues, The Rail, Side Tables): the shared
 * AppBar (back to the menu, plus pip · Style · Settings) over a big page title
 * and a gentle enter. Real routes, so the browser back button works too.
 */
export function SectionScreen({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <PageShell leading="back">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-1 flex-col"
      >
        <div className="mb-6 px-1">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </motion.div>
    </PageShell>
  )
}
