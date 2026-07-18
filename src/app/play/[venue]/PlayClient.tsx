'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Table } from '@/components/table/Table'
import { useProfile } from '@/store/profile'
import { useGame, loadTableSnapshot } from '@/store/game'
import { venueById, canAfford, freerollOpen } from '@/config/venues'
import { dailyDateKey } from '@/lib/daily'

export function PlayClient() {
  const { venue: venueId } = useParams<{ venue: string }>()
  const router = useRouter()
  // Keyed by venue id: navigating table → table (e.g. busted → freeroll) reuses
  // this component, so a plain boolean would block the second sit-down.
  const started = useRef<string | null>(null)
  // Readiness is derived from the game store (external), so no in-effect setState.
  const activeVenue = useGame((s) => s.venue)

  useEffect(() => {
    if (started.current === venueId) return
    started.current = venueId

    const venue = venueById(venueId)
    const profile = useProfile.getState()

    if (!venue || !profile.created || !profile.avatar) {
      router.replace('/')
      return
    }

    // An interrupted table (hard refresh) resumes — the buy-in was already paid.
    const snapshot = loadTableSnapshot()
    if (snapshot && snapshot.venueId === venueId) {
      useGame.getState().resumeTable(venue, snapshot)
      return
    }

    // The Daily is once a day — played (or abandoned) means done till tomorrow.
    if (venue.daily && profile.daily?.date === dailyDateKey()) {
      router.replace('/')
      return
    }

    if (!canAfford(venue, profile.roll)) {
      router.replace('/')
      return
    }
    // The freeroll is a safety net, not a farm — only when you can't afford the ladder.
    if (venue.freeroll && !freerollOpen(profile.roll)) {
      router.replace('/')
      return
    }

    useGame.getState().sitDown(venue, {
      name: profile.name,
      avatar: profile.avatar,
    })
  }, [venueId, router])

  if (activeVenue?.id !== venueId) return <div className="min-h-dvh" />
  return <Table />
}
