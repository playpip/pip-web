import { VENUES, SIDE_TABLES, KITCHEN_TABLE, THE_DAILY } from '@/config/venues'
import { PlayClient } from './PlayClient'

// Every venue is known config, so all play routes prerender for the static
// export (Cloudflare Pages serves them as plain HTML). The client component
// owns the actual sit-down logic; this server shell only enumerates the paths.
export const dynamicParams = false

export function generateStaticParams() {
  return [...VENUES, ...SIDE_TABLES, KITCHEN_TABLE, THE_DAILY].map((v) => ({ venue: v.id }))
}

export default function PlayPage() {
  return <PlayClient />
}
