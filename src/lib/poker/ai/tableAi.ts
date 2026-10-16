// Which AI sits at a table. One rule, read in every place the tables' players
// decide (the game store, a multiplayer room's bots): a table whose skill is
// `RANGED_AI_FROM_SKILL` or more plays with `RANGED_AI`'s switches on, and
// every other table plays the AI it always has, decision for decision.
//
// The Daily is the exception at any skill. It replays its opponents off a
// seed, and a result line has to mean the same thing to everybody who played
// that day's deal, so it keeps the AI it shipped with.

import { RANGED_AI_FROM_SKILL } from '@/config/aiGates'
import type { AiExperiment, AiProfile } from './policy'

/**
 * The switches ranged tables play with, the version `pnpm bot-duel` calls
 * `wpf3`: weighted opponent ranges with the second round of tuning, and
 * re-raises before the flop read and made from percentile ranges, an
 * opponent's re-raise scaled by their own 3-bet rate. Every one acts at Hold'em
 * only, so a ranged table of any other game plays exactly as before.
 */
export const RANGED_AI: AiExperiment = {
  fastShowdown: true,
  weightedRanges: true,
  rangeTuning: true,
  preflopRanges: true,
  threeBetReads: true,
}

/**
 * The profile a seat plays at this table: its own, with `RANGED_AI` on when the
 * table's skill reaches `RANGED_AI_FROM_SKILL`. The table's skill, not the
 * seat's, so everybody at one table plays the same AI. Unchanged, the very
 * object passed in, below the line and at the Daily.
 */
export function tableAi(profile: AiProfile, table: { ai: AiProfile; daily?: boolean }): AiProfile {
  if (table.daily || (table.ai.skill ?? 1) < RANGED_AI_FROM_SKILL) return profile
  return { ...profile, experiment: { ...RANGED_AI, ...profile.experiment } }
}
