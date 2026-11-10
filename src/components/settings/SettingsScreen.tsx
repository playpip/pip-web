'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { MembershipSection } from '@/components/settings/MembershipSection'
import { SlowGamesSection } from '@/components/settings/SlowGamesSection'
import { AccountGroup } from '@/components/settings/SyncSection'
import {
  AboutLine,
  DisplayGroup,
  ResetButton,
  SoundGroup,
  TableGroup,
} from '@/components/settings/sections'

/**
 * Settings, the page. The gear opens this from every menu screen; the screens
 * you can't walk off mid-game open the same groups as a sheet instead
 * (SettingsDialog).
 *
 * Two columns from lg: you and your account on the left, how the game looks,
 * sounds and talks on the right. One column below that, account first.
 */
export function SettingsScreen() {
  const router = useRouter()
  const back = () => {
    if (window.history.length > 1) router.back()
    else router.push('/game')
  }

  return (
    <PageShell leading="back" backLabel="Back" onBack={back} settings="none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full"
      >
        <h1 className="mb-8 px-1 text-3xl font-semibold tracking-tight md:text-4xl">Settings</h1>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            <AccountGroup />
            <MembershipSection />
            <SlowGamesSection />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <DisplayGroup />
            <SoundGroup />
            <TableGroup />
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-sm flex-col gap-6">
          <ResetButton />
          <AboutLine />
        </div>
      </motion.div>
    </PageShell>
  )
}
