import type { Metadata } from 'next'
import { APP_BANNER } from '@/config/site'

// The lobby alone, in a route group so the URL stays /game: Safari's app
// banner shows here, like the Android one, and never on the tables, drills
// and rooms under /game, which `game/layout.tsx` covers.
export const metadata: Metadata = { ...APP_BANNER }

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return children
}
