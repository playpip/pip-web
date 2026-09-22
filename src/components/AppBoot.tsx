'use client'

import { useEffect } from 'react'
import { useMembership } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'
import { soundPackById } from '@/config/cosmetics'
import { sound } from '@/lib/sound'

/**
 * One-time client boot work, mounted from the root layout:
 * - asks the browser to mark our storage persistent, so the local profile
 *   isn't evicted under storage pressure (Chrome/Firefox honor this; on iOS
 *   the real protection is installing the PWA)
 * - seeds a Roll-graph origin point for profiles that predate stat recording
 * - restores a sync session if there is one, and pulls
 * - watches that session for a membership, which costs nothing until there is one
 *
 * The service worker is registered separately in UpdatePrompt's hook, which also
 * watches for new deploys (see lib/useServiceWorker).
 */
export function AppBoot() {
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => {})

    const profile = useProfile.getState()
    if (profile.created && profile.rollHistory.length === 0) profile.recordRollPoint()

    // The chosen sound pack, handed to the engine once. `lib/sound` holds a
    // live AudioContext and the profile is persisted state, so the two are
    // joined here rather than inside the store — a store that reached into an
    // AudioContext would make every test that touches a profile need a stub.
    //
    // **What is equipped is what plays, and nothing here asks about a
    // membership.** That is the same rule the card back at the table follows
    // (`Table.tsx` looks the design up and draws it): the gate is on the
    // picker, where a locked thing cannot be chosen, not on the render. The
    // cost is that somebody whose membership lapsed keeps hearing the pack
    // they chose until they pick another, and taking a sound away from
    // somebody mid-session is worse than that.
    sound.setPack(soundPackById(profile.soundPack))

    // No-op unless the player has an account: with no stored session this
    // reads localStorage, finds nothing and stops. No request, no identity.
    void useSync.getState().init()

    // Subscribes to that session rather than going looking for one, so a
    // player with no account still makes no request of its own.
    useMembership.getState().start()
  }, [])
  return null
}
