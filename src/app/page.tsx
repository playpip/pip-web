import type { Metadata } from 'next'
import { Landing } from '@/components/marketing/Landing'
import { contentAlternates } from '@/config/site'

// "/" is the marketing landing page. The app itself lives at "/game".

// Title, description and share cards all come from the root layout. This route
// only adds what the layout cannot know: the page's own canonical URL. The home
// page is the one directories link to most, and so the one most likely to be
// listed with a tracking parameter stuck on the end.
export const metadata: Metadata = {
  alternates: contentAlternates(''),
}

export default function Page() {
  return <Landing />
}
