// src/utils/defenseRankUtils.js
// Shared helpers for displaying defense-vs-position rankings.
// Rank 1 = stingiest defense (toughest matchup, colored red for offense).
// Rank 32 = most exploitable defense (best matchup, colored green).

export function rankColor(rank, total) {
  if (rank == null || !total) return 'var(--text-muted)'
  if (rank <= total / 3)        return '#d94f4f' // tough matchup
  if (rank >= (total * 2) / 3)  return '#3dba6e' // plus matchup
  return '#d4a843' // neutral
}

export function rankSuffix(rank) {
  if (rank == null) return '—'
  const j = rank % 10, k = rank % 100
  if (j === 1 && k !== 11) return `${rank}st`
  if (j === 2 && k !== 12) return `${rank}nd`
  if (j === 3 && k !== 13) return `${rank}rd`
  return `${rank}th`
}


// Sleeper's player data uses different team abbreviations than our historical
// nflfastR/ESPN-derived schedule data for a couple of teams. Normalize at the
// lookup point rather than re-importing schedule data, since "LA" is the
// established convention used throughout player_weeks and nfl_schedule.
const TEAM_ABBREV_NORMALIZE = {
  LAR: 'LA',
  // Add more here if other mismatches surface (e.g. WSH -> WAS)
}

export function normalizeTeamAbbrev(team) {
  if (!team) return team
  return TEAM_ABBREV_NORMALIZE[team] || team
}
