import type { Metadata } from 'next'
import { DRILL_KINDS, drillKind } from '@/config/drills'
import { DrillRunner } from '@/components/drills/DrillRunner'

// Every drill kind is known config, so all drill routes prerender for the
// static export — the same shape as /play/[venue]. The client component owns
// the drill itself; this server shell resolves the kind and enumerates the
// paths, so an id that is not in the registry cannot be reached at all.
export const dynamicParams = false

export function generateStaticParams() {
  return DRILL_KINDS.map((kind) => ({ kind: kind.id }))
}

// One route, N screens, so the title comes off the registry rather than a list
// written out here. Hand-written per kind and the paid kinds' names drift from
// config/drills.ts the first time one is renamed, and roadmapDrills.test.ts
// would not catch it: that test reads ROADMAP.md, not this file.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>
}): Promise<Metadata> {
  const { kind } = await params
  const { title, blurb } = drillKind(kind)
  return { title: `${title} · Pip`, description: blurb }
}

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  return <DrillRunner kind={drillKind(kind)} />
}
