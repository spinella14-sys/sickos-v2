import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TEAMS, LOGOS } from '../data/league'
import './ScoreboardPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const CURRENT_SEASON       = 2026
const TOTAL_REGULAR_WEEKS  = 14
const SEASONS              = [2025, 2026]

function weekLabel(w) {
  if (w <= 14) return String(w)
  if (w === 15) return 'R1'
  if (w === 16) return 'SF'
  if (w === 17) return 'CHMP'
  return String(w)
}

function weekTitle(w) {
  if (w <= 14) return `Week ${w}`
  if (w === 15) return 'Playoff Round 1'
  if (w === 16) return 'Semifinals'
  if (w === 17) return 'Championship'
  return `Week ${w}`
}

function TeamLogo({ abbrev, size = 48 }) {
  const url = LOGOS[abbrev]
  if (!url) return <span className="sb-logo-ph" style={{ width: size, height: size }} />
  return <img src={url} alt={abbrev} className="sb-logo" style={{ width: size, height: size }} loading="lazy" />
}

function MatchupCard({ matchup }) {
  const homeTeam  = TEAMS.find(t => t.abbrev === matchup.home_team)
  const awayTeam  = TEAMS.find(t => t.abbrev === matchup.away_team)
  const homeScore = parseFloat(matchup.home_score || 0)
  const awayScore = parseFloat(matchup.away_score || 0)
  const homeWin   = homeScore > awayScore
  const hasScores = homeScore > 0 || awayScore > 0
  const isFinal   = matchup.status === 'final'
  const isLive    = matchup.status === 'in_progress' || matchup.status === 'live'
  const margin    = Math.abs(homeScore - awayScore).toFixed(2)

  return (
    <Link to={`/matchup/${matchup.id}`} className="mc-card mc-card--link">
      <div className="mc-status-bar">
        <span className={`mc-status ${isLive ? 'mc-status--live' : isFinal ? 'mc-status--final' : 'mc-status--upcoming'}`}>
          {isLive && <span className="mc-live-dot" />}
          {isLive ? 'LIVE' : isFinal ? 'FINAL' : 'UPCOMING'}
        </span>
        {hasScores && isFinal && (
          <span className="mc-diff">by {margin}</span>
        )}
      </div>

      <div className="mc-body">
        {/* Home */}
        <div className={`mc-team mc-team--home ${homeWin && hasScores ? 'mc-team--winner' : ''}`}>
          <TeamLogo abbrev={matchup.home_team} size={52} />
          <div className="mc-team-info">
            <span className="mc-tname">{homeTeam?.name || matchup.home_team}</span>
            <span className="mc-mgr">{homeTeam?.manager}</span>
          </div>
          <span className={`mc-score ${homeWin && hasScores ? 'mc-score--win' : !homeWin && hasScores && isFinal ? 'mc-score--loss' : ''}`}>
            {hasScores ? homeScore.toFixed(2) : '—'}
          </span>
        </div>

        <div className="mc-vs"><span>VS</span></div>

        {/* Away */}
        <div className={`mc-team mc-team--away ${!homeWin && hasScores ? 'mc-team--winner' : ''}`}>
          <span className={`mc-score ${!homeWin && hasScores ? 'mc-score--win' : homeWin && hasScores && isFinal ? 'mc-score--loss' : ''}`}>
            {hasScores ? awayScore.toFixed(2) : '—'}
          </span>
          <div className="mc-team-info mc-team-info--right">
            <span className="mc-tname">{awayTeam?.name || matchup.away_team}</span>
            <span className="mc-mgr">{awayTeam?.manager}</span>
          </div>
          <TeamLogo abbrev={matchup.away_team} size={52} />
        </div>
      </div>
    </Link>
  )
}

export default function ScoreboardPage() {
  // FIX: was defaulting to season:2025, week:14 — all data is 2026
  const [season,   setSeason]   = useState(CURRENT_SEASON)
  const [week,     setWeek]     = useState(1)
  const [matchups, setMatchups] = useState([])
  const [loading,  setLoading]  = useState(false)

  // On mount, try to auto-detect the most relevant week from the data
  useEffect(() => {
    fetch(`${API_BASE}/matchups?season=${CURRENT_SEASON}&sort=desc`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!Array.isArray(data) || !data.length) return
        // Find the latest week with a final or in-progress game, or fall back to week 1
        const live = data.find(m => m.status === 'in_progress' || m.status === 'live')
        const final = data.find(m => m.status === 'final')
        if (live)  setWeek(live.week)
        else if (final) setWeek(final.week)
        else setWeek(1)
      })
      .catch(() => setWeek(1))
  }, [])

  useEffect(() => {
    setLoading(true)
    setMatchups([])
    fetch(`${API_BASE}/matchups?season=${season}&week=${week}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setMatchups(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setMatchups([]); setLoading(false) })
  }, [season, week])

  const finishedGames = matchups.filter(m => m.status === 'final' || parseFloat(m.home_score || 0) > 0)
  const allScores  = finishedGames.flatMap(m => [parseFloat(m.home_score || 0), parseFloat(m.away_score || 0)])
  const avgScore   = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : null
  const highScore  = allScores.length ? Math.max(...allScores).toFixed(2) : null

  const handleSeasonChange = (s) => {
    setSeason(s)
    setWeek(s === 2025 ? 14 : 1)
  }

  return (
    <div className="sb-root">

      <div className="sb-header">
        <div className="sb-header-inner">
          <div>
            <h1 className="sb-title">Scoreboard</h1>
            <p className="sb-sub">{season} Season · {weekTitle(week)}</p>
          </div>
          {avgScore && (
            <div className="sb-stats">
              <div className="sb-stat">
                <span className="sb-stat-label">Avg Score</span>
                <span className="sb-stat-val">{avgScore}</span>
              </div>
              <div className="sb-stat">
                <span className="sb-stat-label">High Score</span>
                <span className="sb-stat-val sb-stat-val--orange">{highScore}</span>
              </div>
              <div className="sb-stat">
                <span className="sb-stat-label">Matchups</span>
                <span className="sb-stat-val">{matchups.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sb-week-bar">
        <div className="sb-week-bar-inner">
          <div className="sb-season-group">
            {SEASONS.map(s => (
              <button key={s}
                className={`sb-season-btn ${season === s ? 'sb-season-btn--active' : ''}`}
                onClick={() => handleSeasonChange(s)}>
                {s}
              </button>
            ))}
          </div>

          <div className="sb-week-divider" />

          <div className="sb-week-group">
            <span className="sb-week-group-label">REG</span>
            {Array.from({ length: TOTAL_REGULAR_WEEKS }, (_, i) => i + 1).map(w => (
              <button key={w}
                className={`sb-week-btn ${week === w ? 'sb-week-btn--active' : ''}`}
                onClick={() => setWeek(w)}>
                {w}
              </button>
            ))}
          </div>

          <div className="sb-week-divider" />

          <div className="sb-week-group">
            <span className="sb-week-group-label">PO</span>
            {[15, 16, 17].map(w => (
              <button key={w}
                className={`sb-week-btn sb-week-btn--playoff ${week === w ? 'sb-week-btn--active' : ''}`}
                onClick={() => setWeek(w)}>
                {weekLabel(w)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sb-content">
        {loading ? (
          <div className="sb-loading">
            <div className="sb-spinner" />
            <span>Loading matchups…</span>
          </div>
        ) : matchups.length === 0 ? (
          <div className="sb-empty">
            <span>No matchups for {season} {weekTitle(week)}</span>
            {week > 14 && (
              <p>Playoff bracket seeds after Week 14 finalizes.</p>
            )}
          </div>
        ) : (
          <div className="sb-grid">
            {matchups.map(m => <MatchupCard key={m.id} matchup={m} />)}
          </div>
        )}
      </div>
    </div>
  )
}
