import type { Metadata } from 'next'
import { Tutorial } from '@/components/learn/Tutorial'

// Learn poker in three minutes — a standalone, shareable tour built from the
// real product primitives. No profile required, nothing persisted: the offer
// after onboarding links here, and so can anyone else.

export const metadata: Metadata = {
  title: 'Learn poker in three minutes — Pip',
  description: 'The basics of Texas Hold’em in eight short pages. No quiz, no signup.',
}

export default function LearnPage() {
  return <Tutorial />
}
