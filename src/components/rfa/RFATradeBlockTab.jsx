import { useState, useEffect } from 'react'
import { TEAMS, LOGOS } from '../../data/league'
import '../../pages/TradeBlockPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Compact version of TradeBlockPage.jsx's league-wide card view, reusing
// the same CSS classes for visual consistency. Drops the propose/edit
// action buttons and pick-philosophy row -- not relevant inside a draft
// module -- keeps the core On the Block / Untouchable identity.
export default function RFATradeBlockTab() {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/trade-block`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setBlocks(Array.isArray(data) ? data : []))
      .catch(() => setBlocks([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rfa-pool__empty">
        <div className="rfa-pool__empty-title">Loading Trade Block…</div>
      </div>
    )
  }

  const byTeam = {}
  blocks.forEach(b => {
    if (!byTeam[b.team_abbrev]) byTeam[b.team_abbrev] = []
    byTeam[b.team_abbrev].push(b)
  })
  const teamAbbrevs = Object.keys(byTeam).sort()

  if (teamAbbrevs.length === 0) {
    return (
      <div className="rfa-pool__empty">
        <div className="rfa-pool__empty-title">No Trade Block Data</div>
        <p>No teams have set trade block designations yet.</p>
      </div>
    )
  }

  return (
    <div style={{
      padding: 16,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 16,
      overflowY: 'auto',
    }}>
      {teamAbbrevs.map(abbrev => {
        const teamBlocks = byTeam[abbrev]
        const team = TEAMS.find(t => t.abbrev === abbrev)
        const onBlock = teamBlocks.filter(b => b.asset_type === 'player' && ['available', 'listening'].includes(b.status))
        const locked = teamBlocks.filter(b => b.asset_type === 'player' && b.status === 'untouchable')
        if (onBlock.length === 0 && locked.length === 0) return null

        return (
          <div key={abbrev} className="tb-card" style={{ margin: 0 }}>
            <div className="tb-card-header">
              <img src={LOGOS[abbrev]} alt={team?.name} className="tb-card-logo" />
              <div className="tb-card-meta">
                <div className="tb-card-name">{team?.name || abbrev}</div>
                <div className="tb-card-manager">{team?.manager}</div>
              </div>
            </div>

            {onBlock.length > 0 && (
              <div className="tb-section">
                <div className="tb-section-label tb-section-label--available">On the Block ({onBlock.length})</div>
                {onBlock.map(b => {
                  const p = b.player
                  const c = b.contract
                  return (
                    <div key={b.id} className="tb-player-row">
                      <img
                        src={`https://sleepercdn.com/content/nfl/players/thumb/${b.sleeper_id}.jpg`}
                        alt=""
                        className="tb-player-shot"
                        onError={e => { e.target.style.opacity = 0 }}
                      />
                      <div className="tb-player-info">
                        <div className="tb-player-name">{p?.full_name || b.sleeper_id}</div>
                        <div className="tb-player-meta">
                          <span className="tb-player-nfl">{p?.nfl_team}</span>
                          {p?.injury_status && <span className="tb-inj">{p.injury_status}</span>}
                        </div>
                      </div>
                      <div className="tb-player-right">
                        <div className="tb-player-sal">${parseFloat(c?.salary || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {locked.length > 0 && (
              <div className="tb-section">
                <div className="tb-section-label tb-section-label--locked">Untouchable ({locked.length})</div>
                <div className="tb-locked-grid">
                  {locked.map(b => (
                    <div key={b.id} className="tb-locked-chip">{b.player?.full_name || b.sleeper_id}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
