// Badges on profiles (docs/social.md → Badges). The kinds and their order are
// `player_badges` and `pip_badges` in supabase/migrations/20261122230000_badges.sql;
// tests/social.test.ts holds the two together.

export const BADGES = ['team', 'verified', 'high-roller', 'member'] as const

export type Badge = (typeof BADGES)[number]

export const BADGE_LABEL: Record<Badge, string> = {
  team: 'Team Pip',
  verified: 'Verified',
  'high-roller': 'High roller',
  member: 'Member',
}

/** Only the kinds Pip knows, in Pip's order: what a client may trust from the server. */
export function parseBadges(v: unknown): Badge[] {
  if (!Array.isArray(v)) return []
  return BADGES.filter((b) => v.includes(b))
}
