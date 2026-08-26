import { useState, useEffect } from 'react'
import { TEAMS, LOGOS } from '../../data/league'
import PlayerLink from '../PlayerCard/PlayerLink'
import '../../pages/CapSheetPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()
const MAX_YEARS = 4

const getTeamName = (abbrev) => TEAMS.find(t => t.abbrev === abbrev)?.name || abbrev
const getTeamLogo = (abbrev) => LOGOS[abbrev] || null

export default function RookieResultsTab() {
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/draft/picks-full-preview?season=${SEASON}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setPicks(Array.isArray(data) ? data : []))
      .catch(() => setPicks([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="player-board__empty">Loading Results…</div>
  }

  if (picks.length === 0) {
    return <div className="player-board__empty">No picks found for this season.</div>
  }

  return (
    <div className="cs-table-wrap" style={{ padding: 16, background: 'var(--bg0, #f0ede8)' }}>
      <table className="cs-table">
        <thead>
          <tr className="cs-thead-row">
            <th className="th-slot">PICK</th>
            <th className="th-player">TEAM</th>
            <th className="th-player">PLAYER</th>
            {Array.from({ length: MAX_YEARS }).map((_, i) => (
              <th key={i} className="th-year">{SEASON + i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {picks.map(pick => (
            <tr key={pick.pick_number}>
              <td className="cs-year-cell" style={{ textAlign: 'left', fontWeight: 700, color: 'var(--text-primary, #0f1114)' }}>
                #{pick.pick_number}
              </td>
              <td style={{ minWidth: 150 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {getTeamLogo(pick.team_abbrev) && (
                    <img
                      src={getTeamLogo(pick.team_abbrev)}
                      alt={pick.team_abbrev}
                      style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #0f1114)' }}>
                    {getTeamName(pick.team_abbrev)}
                  </span>
                </div>
              </td>
              <td style={{ minWidth: 150 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #0f1114)' }}>
                  {pick.is_used ? (
                    pick.sleeper_id ? (
                      <PlayerLink playerId={pick.sleeper_id} style={{ color: 'inherit' }}>
                        {pick.player_name}
                      </PlayerLink>
                    ) : pick.player_name
                  ) : (
                    <span style={{ color: 'var(--text-muted, #7a8494)', fontStyle: 'italic' }}>TBD</span>
                  )}
                </span>
              </td>
              {Array.from({ length: MAX_YEARS }).map((_, i) => {
                const cy = pick.contract_years[i]
                if (!cy) {
                  return <td key={i} className="cs-year-cell cs-year-empty">—</td>
                }
                const isNG = cy.is_guaranteed === false
                return (
                  <td key={i} className={`cs-year-cell cs-year-has-val ${isNG ? 'cs-ng-cell' : ''}`}>
                    <span className="cs-sal" style={isNG ? { color: 'var(--purple)' } : {}}>
                      ${cy.salary.toFixed(2)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
