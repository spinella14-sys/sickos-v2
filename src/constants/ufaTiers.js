// ── UFA tier structure — SINGLE SOURCE OF TRUTH ─────────────────────────────
// Mirrors src/routes/ufa.js on the backend. Four tiers across nine waves:
//
//   Tier 1 = wave 1      -> MAX CONTRACT (position-dependent, not a flat $)
//   Tier 2 = waves 2-3   -> $12.00 minimum
//   Tier 3 = waves 4-6   -> $6.00 minimum
//   Tier 4 = waves 7-9   -> $2.40 minimum (league minimum)
//
// These numbers used to be copy-pasted into UFAHero, UFABidForm,
// UFAPlayerBoard and AdminUFAPage independently. They drifted the moment the
// tier structure changed, so they live here now and nowhere else.

export const TOTAL_WAVES = 9

// Max contract values are derived from LTL on the backend
// (qb_max = ltl/4.5, non_qb_max = ltl/5.5). Kept here for display only.
export const LTL         = 120
export const QB_MAX      = +(LTL / 4.5).toFixed(2)   // 26.67
export const NON_QB_MAX  = +(LTL / 5.5).toFixed(2)   // 21.82
export const MIN_SALARY  = 2.40

export const TIER_FOR_WAVE = (w) => (w <= 1 ? 1 : w <= 3 ? 2 : w <= 6 ? 3 : 4)

// Which waves belong to each tier — drives "Wave N of M in this tier".
export const WAVES_IN_TIER = { 1: [1], 2: [2, 3], 3: [4, 5, 6], 4: [7, 8, 9] }

// Position of a wave within its own tier, and how many waves that tier has.
export const WAVE_IN_TIER = (w) => {
  const waves = WAVES_IN_TIER[TIER_FOR_WAVE(w)] || [w]
  return waves.indexOf(w) + 1
}
export const TIER_WAVE_COUNT = (w) => (WAVES_IN_TIER[TIER_FOR_WAVE(w)] || [w]).length

// Tier 1 has no flat minimum — it requires a max contract, which depends on
// the player's position. isMaxTier() callers must resolve per player.
export const isMaxTier = (tier) => tier === 1

export const TIER_MINS = { 2: 12.00, 3: 6.00, 4: MIN_SALARY }

// Numeric floor for a bid. Tier 1 needs a position; without one, the
// non-QB max is the safe (lower) assumption for display purposes.
export function minBidForTier(tier, position) {
  if (isMaxTier(tier)) return position === 'QB' ? QB_MAX : NON_QB_MAX
  return TIER_MINS[tier] ?? MIN_SALARY
}

// Display string for a tier's minimum.
export function tierMinLabel(tier, position) {
  if (isMaxTier(tier)) {
    return position
      ? `$${minBidForTier(tier, position).toFixed(2)} (max)`
      : `max contract ($${NON_QB_MAX.toFixed(2)} / $${QB_MAX.toFixed(2)} QB)`
  }
  return `$${TIER_MINS[tier].toFixed(2)}`
}

export const TIER_NAMES = {
  1: 'Tier 1 — Max Contract',
  2: 'Tier 2 — Premium ($12+)',
  3: 'Tier 3 — Mid-Range ($6+)',
  4: 'Tier 4 — Open Market',
}

export const TIER_SHORT = {
  1: 'Tier 1 — Max',
  2: 'Tier 2 — $12+',
  3: 'Tier 3 — $6+',
  4: 'Tier 4 — Open',
}
