import type { Metadata } from 'next'
import { TABLE_PAGE_VENUES, venueById } from '@/config/venues'
import { VenueScreen } from '@/components/menu/TableScreen'

// A table's page before you sit down: a ladder rung, the Daily, a challenge,
// the freeroll, the Regulars' Table (components/menu/TableScreen). Every one is
// known config, so they all prerender for the static export, the same shape as
// /play/[venue]. noindex comes from the /game layout.
export const dynamicParams = false

export function generateStaticParams() {
  return TABLE_PAGE_VENUES.map((v) => ({ id: v.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const venue = venueById(id)
  return { title: `${venue?.name ?? 'A table'} · Pip`, description: venue?.tagline }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VenueScreen id={id} />
}
