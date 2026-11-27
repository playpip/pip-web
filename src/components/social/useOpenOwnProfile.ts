'use client'

// Tapping your own name: your profile page, with Edit profile on it (Will,
// 2026-11-27). Without one (a guest, or before a handle is picked) there is
// nothing to go to, so it opens the editor as it always did.

import { useRouter } from 'next/navigation'
import { socialEnabled } from '@/lib/social/api'
import { useSocial } from '@/store/social'
import { useSync } from '@/store/sync'
import { profileHref } from './parts'

export function useOpenOwnProfile(openEditor: () => void): () => void {
  const router = useRouter()
  const handle = useSocial((s) => s.me?.handle)
  const signedIn = useSync((s) => s.status === 'signed-in')
  return () => {
    if (socialEnabled() && signedIn && handle) router.push(profileHref(handle))
    else openEditor()
  }
}
