// The AI versions the measurement scripts and the tests can name:
// `pnpm bot-duel --a exact`, `pnpm exploit-sim --ai exact`,
// `pnpm ai-stats --ai exact`, and `tests/tableAi.test.ts`, which pins the
// version the ranged tables play to the one that was measured.
//
// `v1` is the AI with no switches, the one the Daily and every table below
// `RANGED_AI_FROM_SKILL` play; `wpf3` is what the tables from it up play
// (`tableAi.ts`). Every other version is v1 with switches from
// `AiProfile.experiment` turned on, so none of them can change v1: the Daily
// replays it off a seed, and it has to stay exactly as it is.
// `fast` makes exactly v1's decisions sooner (tests/aiExperiment.test.ts), so a
// long measurement uses it in v1's place and says so.
//
// Nothing the game ships imports this; it lives here rather than in scripts/
// so that a test can name a version without reaching into the scripts.

import type { AiExperiment, AiProfile } from './policy'
import { RANGED_AI } from './tableAi'

export interface AiVersion {
  about: string
  /** Switched on over the venue's profile, before any override. None is v1. */
  experiment?: AiExperiment
}

/**
 * Eight chairs need eight entries. Seven and six behind continue the shipped
 * five-behind 0.15 downward the way full-ring charts do; the values are a
 * starting point to measure, not a solved range.
 */
const OPENING_EIGHT_HANDED = [0.42, 0.38, 0.42, 0.26, 0.19, 0.15, 0.13, 0.115] as const

/**
 * The versions a measurement can name. A new version earns a line here by
 * being switchable without touching `v1`: the Daily replays v1 off a seed, so
 * the old one has to stay exactly as it is.
 */
export const AI_VERSIONS: Record<string, AiVersion> = {
  v1: { about: 'decideAction with no switches: the Daily and the softer tables' },
  fast: {
    about: 'v1 with showdowns settled by rankHoldem: must play exactly like v1',
    experiment: { fastShowdown: true },
  },
  exact: {
    about: 'fast, plus opponents ranged by their exact hand and private draws',
    experiment: { fastShowdown: true, exactRange: true },
  },
  wrange: {
    about: 'fast, with opponents read as weighted ranges reweighted by every action',
    experiment: { fastShowdown: true, weightedRanges: true },
  },
  wrange2: {
    about:
      'wrange, with the second round of tuning: lower tax, wider reads, flat maniacs, shoves read as shoves, river bluffs',
    experiment: { fastShowdown: true, weightedRanges: true, rangeTuning: true },
  },
  wpf3: {
    about: 'wrange2, with re-raises read by 3-bet rate: what the ranged tables play',
    experiment: RANGED_AI,
  },
  open8: {
    about: 'fast, with first-in opening shares for seven and eight behind',
    experiment: { fastShowdown: true, openingByBehind: OPENING_EIGHT_HANDED },
  },
  pf3: {
    about: 'fast, with 3-bets and 4-bets read and made from percentile ranges',
    experiment: { fastShowdown: true, preflopRanges: true },
  },
}

/** A version's profile at a table: the venue's numbers with its switches on. */
export function versionProfile(name: string, base: AiProfile): AiProfile {
  const version = AI_VERSIONS[name]
  if (!version)
    throw new Error(`unknown AI version "${name}"; known: ${Object.keys(AI_VERSIONS).join(', ')}`)
  return version.experiment
    ? { ...base, experiment: { ...base.experiment, ...version.experiment } }
    : { ...base }
}
