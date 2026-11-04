import type { Metadata } from 'next'
import { SIDE_SHELF } from '@/config/venues'
import { FamilyScreen } from '@/components/menu/TableScreen'

// One side-tables card's page: the game, and its stakes as options
// (components/menu/TableScreen). One static HTML per family for the export;
// noindex comes from the /game layout.
export const dynamicParams = false

export function generateStaticParams() {
  return SIDE_SHELF.map((f) => ({ family: f.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ family: string }>
}): Promise<Metadata> {
  const { family } = await params
  const found = SIDE_SHELF.find((f) => f.id === family)
  return { title: `${found?.game ?? 'Side Tables'} · Pip`, description: found?.short }
}

export default async function Page({ params }: { params: Promise<{ family: string }> }) {
  const { family } = await params
  return <FamilyScreen id={family} />
}
