import type { Metadata } from 'next'
import { Tutorial } from '@/components/learn/Tutorial'
import { contentAlternates, contentSocial } from '@/config/site'

// Learn poker in three minutes — a standalone, shareable tour built from the
// real product primitives. No profile required, nothing persisted: the landing
// page and Learn link here, and so can anyone else.
//
// This lived at /learn until 2026-08-05. /learn is now the hub that lists this
// tour alongside the written guides, which is what a reader arriving from a
// search actually wants.

const DESCRIPTION = 'The basics of Texas Hold’em in eight short pages. No quiz, no signup.'

export const metadata: Metadata = {
  title: 'Learn poker in three minutes — Pip',
  description: DESCRIPTION,
  alternates: contentAlternates('/tutorial'),
  ...contentSocial({
    path: '/tutorial',
    title: 'Learn poker in three minutes',
    description: DESCRIPTION,
    type: 'website',
  }),
}

export default function TutorialPage() {
  return <Tutorial />
}
