import type { Metadata } from 'next'
import { RING_TABLES } from '@/config/venues'
import { VenueScreen } from '@/components/menu/TableScreen'

// A Rail room's page before you sit down (components/menu/TableScreen). One
// static HTML per room for the export; noindex comes from the /game layout.
export const dynamicParams = false

export function generateStaticParams() {
  return RING_TABLES.map((v) => ({ id: v.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const room = RING_TABLES.find((v) => v.id === id)
  return { title: `${room?.name ?? 'The Rail'} · Pip`, description: room?.tagline }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VenueScreen id={id} />
}
