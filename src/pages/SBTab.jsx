import { useState, useEffect } from 'react'
import { LOGOS } from '../data/league'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import './CapSheetPage.css'
import './SBTab.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const CURRENT_SEASON = new Date().getFullYear()

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function SBTab({ abbrev }) {
  const [proj,         setProj]         = useState(null)
  const [ledger,        setLedger]        = useState([])
  const [allBalances,   setAllBalances]   = useState({})
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!abbrev) return
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE}/bids/sb-projection/${abbrev}?season=${CURRENT_SEASON}&salary=0`).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/bids/sb-ledger/${abbrev}?season=${CURRENT_SEASON}`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/bids/sb-balances?season=${CURRENT_SEASON}`).then(r => r.ok ? r.json() : {}),
    ]).then(([p, l, b]) => {
      setProj(p); setLedger(Array.isArray(l) ? l : []); setAllBalances(b || {}); setLoading(false)
    }).catch(() => setLoading(false))
  }, [abbrev])

  if (loading) return <div className="sbtab-loading">Loading signing bonus data…</div>
  if (!proj) return <div className="sbtab-loading">No signing bonus data available.</div>

  const { balance, startBalance, spent, nextSeason } = proj
  const pctUsed = startBalance ? Math.min(100, (spent / startBalance) * 100) : 0
  const barColor = balance < 5 ? 'var(--red)' : balance < 10 ? 'var(--gold)' : 'var(--green)'
  const sortedTeams = Object.entries(allBalances).sort((a, b) => b[1] - a[1])

  return (
    <div className="sbtab-root">
      <div className="sbtab-grid">
        <div className="sbtab-col">

          <div className="sbtab-card">
            <div className="sbtab-card-title">Current Balance</div>
            <div className="sb-balance-row">
              <span className="sb-balance-val">${balance?.toFixed(2)}</span>
              <span className="sb-balance-sub">of ${startBalance?.toFixed(2) || '—'} starting</span>
            </div>
            <div className="sb-bar-wrap">
              <div className="sb-bar-track">
                <div className="sb-bar-fill" style={{ width: `${100 - pctUsed}%`, background: barColor }} />
              </div>
              <div className="sb-bar-labels">
                <span>$0</span>
                <span>{(100 - pctUsed).toFixed(0)}% remaining</span>
                <span>${startBalance?.toFixed(2) || '—'}</span>
              </div>
            </div>
            <div className="sb-row"><span className="sb-row-label">Starting budget</span><span className="sb-row-val">${startBalance?.toFixed(2) || '—'}</span></div>
            <div className="sb-row"><span className="sb-row-label">Spent this season</span><span className="sb-row-val" style={{ color: 'var(--red)' }}>−${spent?.toFixed(2) || '0.00'}</span></div>
            <div className="sb-row"><span className="sb-row-label">Remaining</span><span className="sb-row-val" style={{ color: barColor }}>${balance?.toFixed(2)}</span></div>
          </div>

          <div className="sbtab-card">
            <div className="sbtab-card-title">Itemized Activity ({CURRENT_SEASON})</div>
            {!ledger.length ? (
              <div className="sbtab-empty">No signing bonus activity yet this season.</div>
            ) : (
              <div className="sbtab-ledger">
                {ledger.map(row => (
                  <div key={row.id} className="sbtab-ledger-row">
                    <div className="sbtab-ledger-date">{fmtDate(row.created_at)}</div>
                    <div className="sbtab-ledger-desc">
                      {row.player ? (
                        <>
                          <PlayerLink playerId={row.related_player} className="sbtab-ledger-player">
                            {row.player.players?.full_name || row.related_player}
                          </PlayerLink>
                          <span className="sbtab-ledger-terms">
                            {row.player.years}yr / ${parseFloat(row.player.salary || 0).toFixed(2)} · {row.player.structure}
                          </span>
                        </>
                      ) : (
                        <span>{row.description}</span>
                      )}
                    </div>
                    <div className={`sbtab-ledger-amt ${parseFloat(row.amount) < 0 ? 'sbtab-amt-neg' : 'sbtab-amt-pos'}`}>
                      {parseFloat(row.amount) >= 0 ? '+' : ''}{parseFloat(row.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sbtab-card">
            <div className="sbtab-card-title">{nextSeason?.year} Budget Formula</div>
            <div className="sb-formula-row"><span>Base ({nextSeason?.year} LTL × 20%)</span><span>${nextSeason?.base?.toFixed(2)}</span></div>
            <div className="sb-formula-row"><span>+ Rollover (20% of unused)</span><span style={{ color: 'var(--green)' }}>+${nextSeason?.atCurrentSpend?.rollover?.toFixed(2)}</span></div>
            <div className="sb-formula-row"><span>− Lux tax penalty</span><span style={{ color: 'var(--red)' }}>−${nextSeason?.atCurrentSpend?.luxPenalty?.toFixed(2)}</span></div>
            <div className="sb-formula-row"><span>+ Playoff bonus</span><span style={{ color: 'var(--gold)' }}>+${nextSeason?.atCurrentSpend?.playoffBonus?.toFixed(2) || '0.00'}</span></div>
            <div className="sb-formula-total"><span>Projected {nextSeason?.year} carryover</span><span style={{ color: 'var(--orange)' }}>${nextSeason?.atCurrentSpend?.total?.toFixed(2)}</span></div>
            <div className="sb-formula-note">Based on your current spend pace this season. Playoff bonuses applied after the season ends.</div>
          </div>

        </div>

        <div className="sbtab-col">
          <div className="sbtab-card">
            <div className="sbtab-card-title">League Signing Bonus Balances</div>
            <div className="sbtab-league-table">
              {sortedTeams.map(([team, bal]) => (
                <div key={team} className={`sbtab-league-row ${team === abbrev?.toUpperCase() ? 'sbtab-league-row--me' : ''}`}>
                  <img src={LOGOS[team]} alt={team} className="sbtab-league-logo" onError={e => e.target.style.opacity = 0} />
                  <span className="sbtab-league-team">{team}</span>
                  <span className="sbtab-league-bal">${bal.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
