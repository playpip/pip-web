// The AI versions the measurement scripts can name: `pnpm bot-duel --a exact`,
// `pnpm exploit-sim --ai exact`, `pnpm ai-stats --ai exact`.
//
// `v1` is the shipped AI. Every other version is v1 with switches from
// `AiProfile.experiment` turned on, so none of them can change v1: the Daily
// replays the shipped AI off a seed, and it has to stay exactly as it is.
// `fast` makes exactly v1's decisions sooner (tests/aiExperiment.test.ts), so a
// long measurement uses it in v1's place and says so.

import type { TableMemory } from '@/lib/poker/ai/memory'
import { type AiExperiment, type AiProfile, decideAction } from '@/lib/poker/ai/policy'
import type { Rng } from '@/lib/poker/cards'
import type { Action, HandState } from '@/lib/poker/engine'

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

/**
 * The versions a duel can name. `v1` is the shipped AI. A new version earns a
 * line here by being switchable without touching `v1`: the Daily replays the
 * shipped AI off a seed, so the old one has to stay exactly as it is.
 */
const withExperiment =
  (experiment: AiExperiment) =>
  (p: AiProfile): AiProfile => ({ ...p, experiment: { ...p.experiment, ...experiment } })

/**
 * Eight chairs need eight entries. Seven and six behind continue the shipped
 * five-behind 0.15 downward the way full-ring charts do; the values are a
 * starting point to measure, not a solved range.
 */
export const OPENING_EIGHT_HANDED = [0.42, 0.38, 0.42, 0.26, 0.19, 0.15, 0.13, 0.115] as const

export const POLICIES: Record<string, Policy> = {
  v1: { about: 'the shipped decideAction', decide: decideAction },
  fast: {
    about: 'v1 with showdowns settled by rankHoldem: must play exactly like v1',
    decide: decideAction,
    profile: withExperiment({ fastShowdown: true }),
  },
  exact: {
    about: 'fast, plus opponents ranged by their exact hand and private draws',
    decide: decideAction,
    profile: withExperiment({ fastShowdown: true, exactRange: true }),
  },
  wrange: {
    about: 'fast, with opponents read as weighted ranges reweighted by every action',
    decide: decideAction,
    profile: withExperiment({ fastShowdown: true, weightedRanges: true }),
  },
  wrange2: {
    about:
      'wrange, with the second round of tuning: lower tax, wider reads, flat maniacs, river bluffs',
    decide: decideAction,
    profile: withExperiment({ fastShowdown: true, weightedRanges: true, rangeTuning: true }),
  },
  wpf3: {
    about: 'wrange2, with re-raises read by 3-bet rate off the same percentile ranges as pf3',
    decide: decideAction,
    profile: withExperiment({
      fastShowdown: true,
      weightedRanges: true,
      rangeTuning: true,
      preflopRanges: true,
      threeBetReads: true,
    }),
  },
  open8: {
    about: 'fast, with first-in opening shares for seven and eight behind',
    decide: decideAction,
    profile: withExperiment({ fastShowdown: true, openingByBehind: OPENING_EIGHT_HANDED }),
  },
  pf3: {
    about: 'fast, with 3-bets and 4-bets read and made from percentile ranges',
    decide: decideAction,
    profile: withExperiment({ fastShowdown: true, preflopRanges: true }),
  },
}

/** A version's profile at a table: the venue's numbers with its switches on. */
export function versionProfile(name: string, base: AiProfile): AiProfile {
  const version = POLICIES[name]
  if (!version)
    throw new Error(`unknown AI version "${name}"; known: ${Object.keys(POLICIES).join(', ')}`)
  return version.profile ? version.profile({ ...base }) : { ...base }
}
