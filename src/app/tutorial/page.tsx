import type { Metadata } from 'next'
import { Tutorial } from '@/components/learn/Tutorial'
import { contentAlternates } from '@/config/site'

// Learn poker in three minutes — a standalone, shareable tour built from the
// real product primitives. No profile required, nothing persisted: the offer
// after onboarding links here, and so can anyone else.
//
// This lived at /learn until 2026-08-05. /learn is now the hub that lists this
// tour alongside the written guides, which is what a reader arriving from a
// search actually wants.

export const metadata: Metadata = {
  title: 'Learn poker in three minutes — Pip',
  description: 'The basics of Texas Hold’em in eight short pages. No quiz, no signup.',
  alternates: contentAlternates('/tutorial'),
}

export default function TutorialPage() {
  return <Tutorial />
}
