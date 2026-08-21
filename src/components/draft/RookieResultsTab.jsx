import { useState, useEffect } from 'react'
import { TEAMS, LOGOS } from '../../data/league'
import PlayerLink from '../PlayerCard/PlayerLink'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()
const ROWS = 6
const COLS = 8

const getTeamName = (abbrev) => TEAMS.find(t => t.abbrev === abbrev)?.name || abbrev
const getTeamLogo = (abbrev) => LOGOS[abbrev] || null

// 6x8 snaking grid (confirmed with Adam): row 0 = picks 1-8 left-to-right,
// row 1 = picks 9-16 right-to-left, etc. Row/col already computed
// server-side by GET /api/draft/results-log from pick_number -- this
// component just places each pick into its cell.
export default function RookieResultsTab() {
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/draft/results-log?season=${SEASON}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setPicks(Array.isArray(data) ? data : []))
      .catch(() => setPicks([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="player-board__empty">Loading Results…</div>
    )
  }

  if (picks.length === 0) {
    return (
      <div className="player-board__empty">
        No picks made yet. Results will appear here as the draft progresses.
      </div>
    )
  }

  const grid = {}
  picks.forEach(p => { grid[`${p.row}-${p.col}`] = p })

  return (
    <div style={{ padding: 16, overflow: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, minmax(120px, 1fr))`,
        gap: 8,
      }}>
        {Array.from({ length: ROWS }).map((_, row) => (
          Array.from({ length: COLS }).map((_, col) => {
            const pick = grid[`${row}-${col}`]
            return (
              <div
                key={`${row}-${col}`}
                style={{
                  border: '1px solid var(--draft-border)',
                  borderRadius: 6,
                  padding: 8,
                  minHeight: 76,
                  background: pick ? 'var(--draft-surface)' : 'var(--draft-surface-2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--draft-text-muted)', fontWeight: 700 }}>
                  PICK {pick?.pick_number ?? '—'}
                </div>
                {pick ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {getTeamLogo(pick.team_abbrev) && (
                        <img
                          src={getTeamLogo(pick.team_abbrev)}
                          alt={pick.team_abbrev}
                          style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      )}
                      <span style={{ fontSize: 11, color: 'var(--draft-text-muted)' }}>
                        {getTeamName(pick.team_abbrev)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {pick.sleeper_id ? (
                        <PlayerLink playerId={pick.sleeper_id} style={{ color: 'inherit' }}>
                          {pick.player_name}
                        </PlayerLink>
                      ) : pick.player_name}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--draft-text-muted)' }}>—</div>
                )}
              </div>
            )
          })
        ))}
      </div>
    </div>
  )
}
