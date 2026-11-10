'use client'

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Settings as a sheet, for the screens you can't walk off mid-game: the
 * table, a room, a drill, a lesson. Everywhere else the gear opens the page
 * (/settings). Same groups, one column, in the order a hand in progress wants
 * them: what's on screen and what you hear first.
 */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-6 pt-1">
          <DisplayGroup />
          <SoundGroup />
          <TableGroup />
          <NotificationsGroup />
          <MembershipSection />
          <AccountGroup />
          <ResetButton />
          <DeleteAccount />
          <AboutLine />
        </div>
      </DialogContent>
    </Dialog>
  )
}
