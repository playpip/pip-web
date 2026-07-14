'use client'

import { use, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Table } from '@/components/table/Table'
import { useProfile } from '@/store/profile'
import { useGame } from '@/store/game'
import { venueById, canAfford, freerollOpen } from '@/config/venues'

export default function PlayPage({ params }: { params: Promise<{ venue: string }> }) {
  const { venue: venueId } = use(params)
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

    if (!venue || !profile.created || !profile.avatar || !canAfford(venue, profile.roll)) {
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
