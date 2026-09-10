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
// players.nfl_team and nfl_schedule both use LAR and WAS. This used to map
// LAR -> LA, which was right until nfl_schedule was normalized to LAR -- after
// that every Rams player looked up a team abbreviation that no longer existed
// and came back with no opponent. External feeds are normalized INTO our
// abbreviations, never the other way.
const TEAM_ABBREV_NORMALIZE = {
  LA:  'LAR',
  WSH: 'WAS',
}

export function normalizeTeamAbbrev(team) {
  if (!team) return team
  return TEAM_ABBREV_NORMALIZE[team] || team
}
