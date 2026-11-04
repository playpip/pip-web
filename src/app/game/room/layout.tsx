import type { Metadata } from 'next'
import { contentSocial } from '@/config/site'

// The one route under /game whose link is made to be shared: a host's
// "Invite friends" sends `/game/room?code=…`. Everywhere else in /game keeps
// the root share card (see ../layout.tsx), but here that card told the friend
// "Real Texas Hold'em vs AI … no account needed", on a link to a table of
// people that takes a free account to join. The code is a query parameter, so
// the card cannot name the room; it can describe what the link is.
const title = 'A seat at a friend’s table'
const description =
  'Someone opened a Texas Hold’em table on Pip and sent you the code. Joining is free with a Pip account, and the chips are play money.'

export const metadata: Metadata = {
  title: 'A friend’s table · Pip',
  description,
  ...contentSocial({ path: '/game/room', title, description, type: 'website' }),
}

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return children
}
