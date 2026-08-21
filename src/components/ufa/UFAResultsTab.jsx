import { useState, useEffect } from 'react'
import PlayerLink from '../PlayerCard/PlayerLink'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()

// UFA has no event-log table like RFA's rfa_events, so this is a flatter
// list than RFAResultsTab -- just formally-completed signings
// (status='signed' in ufa_pool, which only ever happens via a real
// finalized award), ordered by real signing time.
export default function UFAResultsTab({ getTeamName, getTeamLogo }) {
  const [signings, setSignings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/ufa/results-log?season=${SEASON}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSignings(Array.isArray(data) ? data : []))
      .catch(() => setSignings([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rfa-pool__empty">
        <div className="rfa-pool__empty-title">Loading Results…</div>
      </div>
    )
  }

  if (signings.length === 0) {
    return (
      <div className="rfa-pool__empty">
        <div className="rfa-pool__empty-title">No Results Yet</div>
        <p>Formally-completed UFA signings will appear here as waves close.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {signings.map(s => {
        const years = s.winning_contract ? Object.keys(s.winning_contract).sort() : []
        const y1 = years.length ? s.winning_contract[years[0]] : null
        const timestamp = s.updated_at
          ? new Date(s.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : ''
        return (
          <div
            key={s.sleeper_id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--draft-border)',
              background: 'var(--draft-surface)',
            }}
          >
            {getTeamLogo && (
              <img
                src={getTeamLogo(s.winning_team)}
                alt={s.winning_team}
                style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0 }}
                onError={ev => { ev.target.style.display = 'none' }}
              />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--draft-text)' }}>
                <PlayerLink playerId={s.sleeper_id} style={{ color: 'inherit' }}>
                  {s.full_name}
                </PlayerLink>
                <span style={{ color: 'var(--draft-text-muted)', fontWeight: 400 }}>
                  {' '}→ {getTeamName ? getTeamName(s.winning_team) : s.winning_team}
                </span>
              </div>
              {y1 && (
                <div style={{ fontSize: 12, color: 'var(--draft-text-muted)', marginTop: 2 }}>
                  {years.length}yr, Y1 ${parseFloat(y1.salary || 0).toFixed(2)}
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: 'var(--draft-text-muted)', flexShrink: 0 }}>
              {timestamp}
            </div>
          </div>
        )
      })}
    </div>
  )
}
