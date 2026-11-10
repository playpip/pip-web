'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { MembershipSection } from '@/components/settings/MembershipSection'
import { NotificationsGroup } from '@/components/settings/SlowGamesSection'
import { AccountGroup } from '@/components/settings/SyncSection'
import { DeleteAccount } from '@/components/settings/AccountRows'
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
 * Two columns from lg, balanced by height; one column below that, account
 * first.
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

        {/* Columns rather than a grid, so the two sides balance by height
            whichever groups are showing: signed out there is no Notifications,
            signed in it is the longest group on the page. */}
        <div className="gap-8 lg:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
          <AccountGroup />
          <MembershipSection />
          <DisplayGroup />
          <SoundGroup />
          <NotificationsGroup />
          <TableGroup />
        </div>

        <div className="mx-auto mt-4 flex max-w-sm flex-col gap-6">
          <ResetButton />
          <DeleteAccount />
          <AboutLine />
        </div>
      </motion.div>
    </PageShell>
  )
}
