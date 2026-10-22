// The AI versions the measurement scripts can name, as deciders. The versions
// themselves, and what each one switches on, are `AI_VERSIONS` in
// `lib/poker/ai/versions.ts`, where the tests can name them too; this adds the
// decision function a duel seats for each.

import type { TableMemory } from '@/lib/poker/ai/memory'
import { type AiProfile, decideAction } from '@/lib/poker/ai/policy'
import { AI_VERSIONS, versionProfile } from '@/lib/poker/ai/versions'
import type { Rng } from '@/lib/poker/cards'
import type { Action, HandState } from '@/lib/poker/engine'

export { versionProfile }

export type Decider = (
  state: HandState,
  profile: AiProfile,
  rng: Rng,
  memory: TableMemory,
) => Action

export interface Policy {
  about: string
  decide: Decider
  /** Applied to the venue's profile before any `name:key=value` override. */
  profile?: (p: AiProfile) => AiProfile
}

/** Every version in `AI_VERSIONS`, each deciding with `decideAction`. */
export const POLICIES: Record<string, Policy> = Object.fromEntries(
  Object.entries(AI_VERSIONS).map(([name, version]) => [
    name,
    {
      about: version.about,
      decide: decideAction,
      profile: version.experiment ? (p: AiProfile) => versionProfile(name, p) : undefined,
    },
  ]),
)
