import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LOGOS } from '../data/league'
import { useAuth } from '../context/AuthContext'
import './StandingsPage.css'

const API_BASE       = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const CURRENT_SEASON = 2026
const PLAYOFF_SPOTS  = 6
const BYE_SPOTS      = 2
const DIVISIONS      = ['EAST','CENTRAL','SOUTH','WEST']

const DIV_COLOR = { EAST:'#3a9fd4', CENTRAL:'#3dba6e', SOUTH:'#e8822a', WEST:'#d4a843' }

function pctStr(w, g)  { return g > 0 ? (w / g).toFixed(3).replace(/^0/, '') : '.000' }
function gbStr(gb)     { return gb == null ? '—' : gb === 0 ? '—' : gb.toFixed(1) }
function oddsBar(pct)  {
  const color = pct >= 70 ? '#3dba6e' : pct >= 40 ? '#e8822a' : pct >= 20 ? '#d4a843' : '#d94f4f'
  return { color, width: `${Math.min(100, pct)}%` }
}

function TeamLogo({ abbrev, size = 28 }) {
  const url = LOGOS[abbrev]
  if (!url) return <span style={{ width:size, height:size, display:'inline-block', background:'var(--bg3)', borderRadius:2 }}/>
  return <img src={url} alt={abbrev} style={{ width:size, height:size, objectFit:'contain' }}
    onError={e => e.target.style.opacity = 0} />
}

function PlayoffOddsCell({ pct, byePct, loading, insufficient }) {
  if (loading) return <td className="st-td st-td--odds"><span className="st-odds-loading">…</span></td>
  if (pct == null) return <td className="st-td st-td--odds st-muted">—</td>
  const { color, width } = oddsBar(pct)
  return (
    <td className="st-td st-td--odds">
      <div className="st-odds-wrap">
        <div className="st-odds-bar-track">
          <div className="st-odds-bar-fill" style={{ width, background: color }}/>
        </div>
        <span className="st-odds-pct" style={{ color }}>{pct}%</span>
        {insufficient && <span className="st-odds-note" title="Based on equal distribution — updates after Week 1">~</span>}
      </div>
    </td>
  )
}

function StandingsTable({ rows, showDivHeader, divName, leagueMode, odds, oddsLoading, playoffCutAfter }) {
  return (
    <div className={`st-table-wrap ${showDivHeader ? 'st-table-wrap--div' : ''}`}>
      {showDivHeader && divName && (
        <div className="st-div-header" style={{ borderLeftColor: DIV_COLOR[divName] || 'var(--orange)' }}>
          <span style={{ color: DIV_COLOR[divName] || 'var(--orange)' }}>{divName}</span>
          <span className="st-div-sub">Division</span>
        </div>
      )}
      <table className="st-table">
        <thead>
          <tr>
            {leagueMode && <th className="st-th st-th--rank">#</th>}
            <th className="st-th st-th--team">TEAM</th>
            <th className="st-th">W-L</th>
            <th className="st-th">PCT</th>
            <th className="st-th">GB</th>
            <th className="st-th st-th--pts">PF</th>
            <th className="st-th st-th--pts">PA</th>
            <th className="st-th">PPG</th>
            <th className="st-th">STK</th>
            <th className="st-th">CAP</th>
            <th className="st-th st-th--odds">PO%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isPlayoffLine = playoffCutAfter != null && i === playoffCutAfter - 1
            const inPlayoffs    = leagueMode ? row.rank <= PLAYOFF_SPOTS : i < PLAYOFF_SPOTS
            const hasBye        = leagueMode ? row.rank <= BYE_SPOTS     : false
            const rowOdds       = odds?.[row.abbrev]
            return (
              <>
                <tr key={row.abbrev}
                  className={`st-row ${inPlayoffs ? 'st-row--playoff' : ''} ${hasBye ? 'st-row--bye' : ''}`}>
                  {leagueMode && (
                    <td className="st-td st-td--rank">
                      <span className={`st-rank ${hasBye ? 'st-rank--bye' : inPlayoffs ? 'st-rank--in' : ''}`}>
                        {row.rank}
                      </span>
                    </td>
                  )}
                  <td className="st-td st-td--team">
                    <div className="st-team-cell">
                      <TeamLogo abbrev={row.abbrev} size={26} />
                      <div className="st-team-info">
                        <Link to={`/team/${row.abbrev}`} className="st-team-name">{row.name}</Link>
                        <span className="st-manager">{row.manager}</span>
                      </div>
                      {!leagueMode && (
                        <span className="st-div-rank">#{i + 1}</span>
                      )}
                    </div>
                  </td>
                  <td className="st-td st-td--record">
                    <span className={row.wins > row.losses ? 'st-win' : row.losses > row.wins ? 'st-loss' : ''}>
                      {row.wins}-{row.losses}
                    </span>
                  </td>
                  <td className="st-td st-muted">{pctStr(row.wins, row.games)}</td>
                  <td className="st-td st-muted">{leagueMode ? gbStr(row.gb) : gbStr(row.div_gb)}</td>
                  <td className="st-td st-td--pts">{row.pts_for > 0 ? row.pts_for.toLocaleString() : '—'}</td>
                  <td className="st-td st-td--pts st-muted">{row.pts_against > 0 ? row.pts_against.toLocaleString() : '—'}</td>
                  <td className="st-td">{row.ppg > 0 ? row.ppg.toFixed(1) : '—'}</td>
                  <td className="st-td">
                    <span className={`st-streak ${row.streak?.startsWith('W') ? 'st-streak--w' : row.streak?.startsWith('L') ? 'st-streak--l' : ''}`}>
                      {row.streak}
                    </span>
                  </td>
                  <td className="st-td">{row.cap_space > 0 ? `$${row.cap_space.toFixed(0)}` : '—'}</td>
                  <PlayoffOddsCell
                    pct={rowOdds?.playoff_pct}
                    byePct={rowOdds?.bye_pct}
                    loading={oddsLoading}
                    insufficient={rowOdds?.insufficient_data}
                  />
                </tr>
                {isPlayoffLine && leagueMode && (
                  <tr key={`cut-${row.abbrev}`} className="st-cutline-row">
                    <td colSpan={12}>
                      <div className="st-cutline">
                        <span>— Playoff cutline ({PLAYOFF_SPOTS} teams qualify) —</span>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function StandingsPage() {
  const { manager } = useAuth()
  const [season,      setSeason]      = useState(CURRENT_SEASON)
  const [view,        setView]        = useState('league')  // 'league' | 'division'
  const [standings,   setStandings]   = useState([])
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [odds,        setOdds]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [oddsLoading, setOddsLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setOddsLoading(true)
    setOdds(null)

    fetch(`${API_BASE}/standings?season=${season}`)
      .then(r => r.ok ? r.json() : { standings:[], games_played:0 })
      .then(d => { setStandings(d.standings || []); setGamesPlayed(d.games_played || 0); setLoading(false) })
      .catch(() => setLoading(false))

    fetch(`${API_BASE}/standings/playoff-odds?season=${season}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => { setOdds(d); setOddsLoading(false) })
      .catch(() => setOddsLoading(false))
  }, [season])

  const divisionRows = useMemo(() => {
    const map = {}
    DIVISIONS.forEach(d => { map[d] = [] })
    standings.forEach(r => {
      const div = r.division || 'TBD'
      if (!map[div]) map[div] = []
      map[div].push(r)
    })
    return map
  }, [standings])

  const leagueStats = useMemo(() => {
    if (!standings.length) return null
    const withPts = standings.filter(s => s.pts_for > 0)
    if (!withPts.length) return null
    const avgPPG = (withPts.reduce((s,r) => s + r.ppg, 0) / withPts.length).toFixed(1)
    const highPPG = Math.max(...withPts.map(r => r.ppg)).toFixed(1)
    const highTeam = withPts.find(r => parseFloat(r.ppg) === parseFloat(highPPG))
    return { avgPPG, highPPG, highTeam, gamesPlayed }
  }, [standings, gamesPlayed])

  const myTeam = standings.find(s => s.abbrev === manager?.team_abbrev)

  return (
    <div className="st-root">

      {/* Header */}
      <div className="st-header">
        <div className="st-header-inner">
          <div>
            <h1 className="st-title">Standings</h1>
            <div className="st-sub">
              {season} Season
              {gamesPlayed > 0 && <span> · {gamesPlayed} games played</span>}
              {myTeam && (
                <span className="st-my-record">
                  {' '}· Your team: <strong>{myTeam.wins}-{myTeam.losses}</strong>
                  {' '}(#{myTeam.rank} overall)
                </span>
              )}
            </div>
          </div>
          <div className="st-header-right">
            {leagueStats && (
              <div className="st-league-stats">
                <div className="st-lstat">
                  <span>League Avg PPG</span>
                  <strong>{leagueStats.avgPPG}</strong>
                </div>
                <div className="st-lstat">
                  <span>Best PPG</span>
                  <strong className="st-orange">{leagueStats.highPPG}</strong>
                </div>
              </div>
            )}
            <div className="st-season-toggle">
              {[2025, 2026].map(s => (
                <button key={s}
                  className={`st-season-btn ${season === s ? 'st-season-btn--active' : ''}`}
                  onClick={() => setSeason(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* View toggle + legend */}
      <div className="st-controls">
        <div className="st-controls-inner">
          <div className="st-view-toggle">
            <button className={`st-toggle-btn ${view === 'league' ? 'st-toggle-btn--active' : ''}`}
              onClick={() => setView('league')}>League</button>
            <button className={`st-toggle-btn ${view === 'division' ? 'st-toggle-btn--active' : ''}`}
              onClick={() => setView('division')}>Division</button>
          </div>
          <div className="st-legend">
            <span className="st-legend-item st-legend-bye">Top 2 — First Round Bye</span>
            <span className="st-legend-item st-legend-playoff">Top 6 — Playoff Berth</span>
            <span className="st-legend-note">PO% = playoff probability (Monte Carlo, 5,000 simulations)</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="st-content">
        {loading ? (
          <div className="st-loading">
            <div className="st-spinner"/>
            <span>Calculating standings…</span>
          </div>
        ) : standings.length === 0 ? (
          <div className="st-empty">
            <span>No results yet for {season}</span>
            <p>Standings populate once Week 1 games are marked final</p>
          </div>
        ) : view === 'league' ? (
          <StandingsTable
            rows={standings}
            leagueMode={true}
            odds={odds}
            oddsLoading={oddsLoading}
            playoffCutAfter={PLAYOFF_SPOTS}
          />
        ) : (
          <div className="st-div-grid">
            {DIVISIONS.map(div => (
              <StandingsTable
                key={div}
                rows={divisionRows[div] || []}
                showDivHeader={true}
                divName={div}
                leagueMode={false}
                odds={odds}
                oddsLoading={oddsLoading}
                playoffCutAfter={null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
