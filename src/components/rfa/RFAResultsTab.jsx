import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()

// Feeds from the existing GET /api/rfa/results-log endpoint (originally
// built for the wave-summary popup) with no ?wave= filter -- returns
// every event for the season. This endpoint's own backend comment
// confirms it only ever logs official outcomes (assigned / tie_void),
// never raw bids that lost or were declined -- so no additional
// filtering is needed here to satisfy "formally-processed moves only."
export default function RFAResultsTab({ getTeamName, getTeamLogo }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/rfa/results-log?season=${SEASON}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rfa-pool__empty">
        <div className="rfa-pool__empty-title">Loading Results…</div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="rfa-pool__empty">
        <div className="rfa-pool__empty-title">No Results Yet</div>
        <p>Formally-processed RFA moves will appear here as waves close.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.map(e => {
        const isVoid = e.event_type === 'tie_void'
        const timestamp = e.created_at
          ? new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : ''
        return (
          <div
            key={e.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--draft-border)',
              background: isVoid ? 'rgba(232,168,67,0.06)' : 'var(--draft-surface)',
            }}
          >
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 4,
              color: isVoid ? 'var(--draft-amber)' : 'var(--draft-green)',
              border: `1px solid ${isVoid ? 'var(--draft-amber)' : 'var(--draft-green)'}`,
              flexShrink: 0,
            }}>
              {isVoid ? 'Voided' : 'Awarded'}
            </span>

            {!isVoid && e.team_abbrev && (
              <img
                src={getTeamLogo ? getTeamLogo(e.team_abbrev) : undefined}
                alt={e.team_abbrev}
                style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0 }}
                onError={ev => { ev.target.style.display = 'none' }}
              />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--draft-text)' }}>
                {e.player_sleeper_id ? (
                  <Link to={`/player/${e.player_sleeper_id}`} style={{ color: 'inherit' }}>
                    {e.player_name}
                  </Link>
                ) : e.player_name}
                {!isVoid && e.team_abbrev && (
                  <span style={{ color: 'var(--draft-text-muted)', fontWeight: 400 }}>
                    {' '}→ {getTeamName ? getTeamName(e.team_abbrev) : e.team_abbrev}
                  </span>
                )}
              </div>
              {e.detail && (
                <div style={{ fontSize: 12, color: 'var(--draft-text-muted)', marginTop: 2 }}>
                  {e.detail}
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: 'var(--draft-text-muted)', flexShrink: 0, textAlign: 'right' }}>
              <div>Wave {e.wave}</div>
              <div>{timestamp}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
