import type { Metadata } from 'next'
import { DrillIndex } from '@/components/drills/DrillIndex'

// Drills — the practice room off the main menu, alongside the tables rather
// than out on the website. The client component owns the list; this is the
// route.

// The screen's own title and subtitle, verbatim from DrillIndex. Not a second
// sentence about the same screen: two descriptions of one thing is two things
// to keep true, and one of them goes stale. `robots` is deliberately absent:
// metadata merges a field at a time, so declaring it here would drop the
// layout's noindex (canonical.test.ts asserts exactly that).
export const metadata: Metadata = {
  title: 'Drills · Pip',
  description:
    'Short spots with a right answer. Your rating moves with every one, and there is no limit on how many you play.',
}

export default function Page() {
  return <DrillIndex />
}
