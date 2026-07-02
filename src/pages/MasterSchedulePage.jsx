// MasterSchedulePage.jsx
// Full-season league-wide schedule grid. Shows all 17 weeks in one view.
// Each week expands to show all matchups for that week.
// Commissioner can use this to audit the full schedule at a glance.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TEAMS, LOGOS } from '../data/league'
import './MasterSchedulePage.css'

const API_BASE       = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const CURRENT_SEASON = 2026

const WEEK_LABELS = {
  15: 'PLAYOFF R1',
  16: 'SEMIFINALS',
  17: 'CHAMPIONSHIP',
}

function weekTitle(w) {
  return WEEK_LABELS[w] || `Week ${w}`
}

function TeamChip({ abbrev }) {
  const team = TEAMS.find(t => t.abbrev === abbrev)
  const logo = LOGOS[abbrev]
  return (
    <div className="msp-chip">
      {logo && <img src={logo} alt={abbrev} className="msp-chip-logo" onError={e => e.target.style.display='none'}/>}
      <span className="msp-chip-name">{team?.name || abbrev}</span>
    </div>
  )
}

function MatchupRow({ matchup }) {
  const homeScore = parseFloat(matchup.home_score || 0)
  const awayScore = parseFloat(matchup.away_score || 0)
  const hasScores = homeScore > 0 || awayScore > 0
  const isFinal   = matchup.status === 'final'
  const isLive    = matchup.status === 'in_progress' || matchup.status === 'live'
  const homeWon   = isFinal && homeScore > awayScore
  const awayWon   = isFinal && awayScore > homeScore

  return (
    <Link to={`/matchup/${matchup.id}`} className="msp-matchup-row">
      <div className={`msp-team-side ${homeWon ? 'msp-team-side--win' : ''}`}>
        <TeamChip abbrev={matchup.home_team} />
        {hasScores && (
          <span className={`msp-score ${homeWon ? 'msp-score--win' : isFinal ? 'msp-score--loss' : ''}`}>
            {homeScore.toFixed(2)}
          </span>
        )}
      </div>
      <div className="msp-vs">
        {isLive ? (
          <span className="msp-live-badge">LIVE</span>
        ) : isFinal ? (
          <span className="msp-final-badge">FINAL</span>
        ) : (
          <span className="msp-vs-label">VS</span>
        )}
      </div>
      <div className={`msp-team-side msp-team-side--away ${awayWon ? 'msp-team-side--win' : ''}`}>
        {hasScores && (
          <span className={`msp-score ${awayWon ? 'msp-score--win' : isFinal ? 'msp-score--loss' : ''}`}>
            {awayScore.toFixed(2)}
          </span>
        )}
        <TeamChip abbrev={matchup.away_team} />
      </div>
    </Link>
  )
}

export default function MasterSchedulePage() {
  const [matchups,    setMatchups]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [expandedWks, setExpandedWks] = useState(new Set([1])) // week 1 open by default
  const [season,      setSeason]      = useState(CURRENT_SEASON)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/matchups?season=${season}&sort=asc`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setMatchups(Array.isArray(data) ? data : [])
        // Auto-expand the current live/upcoming week
        const live = data.find(m => m.status === 'in_progress')
        const upcoming = data.find(m => m.status === 'upcoming')
        if (live)     setExpandedWks(new Set([live.week]))
        else if (upcoming) setExpandedWks(new Set([upcoming.week]))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [season])

  const weeks = [...new Set(matchups.map(m => m.week))].sort((a, b) => a - b)

  function toggleWeek(w) {
    setExpandedWks(prev => {
      const next = new Set(prev)
      next.has(w) ? next.delete(w) : next.add(w)
      return next
    })
  }

  function getWeekStatus(weekMatchups) {
    if (weekMatchups.every(m => m.status === 'final'))       return 'final'
    if (weekMatchups.some(m => m.status === 'in_progress'))  return 'live'
    if (weekMatchups.some(m => m.status === 'upcoming'))     return 'upcoming'
    return 'unknown'
  }

  return (
    <div className="msp-root">
      <div className="msp-header">
        <h1 className="msp-title">Master Schedule</h1>
        <div className="msp-controls">
          {[2025, 2026].map(s => (
            <button key={s}
              className={`msp-season-btn ${season === s ? 'msp-season-btn--active' : ''}`}
              onClick={() => setSeason(s)}>
              {s}
            </button>
          ))}
          <button className="msp-expand-btn" onClick={() => setExpandedWks(new Set(weeks))}>
            Expand All
          </button>
          <button className="msp-expand-btn" onClick={() => setExpandedWks(new Set())}>
            Collapse All
          </button>
        </div>
      </div>

      {loading && (
        <div className="msp-loading">Loading schedule…</div>
      )}

      {!loading && !weeks.length && (
        <div className="msp-empty">No matchups found for {season}.</div>
      )}

      {!loading && weeks.map(w => {
        const weekMatchups = matchups.filter(m => m.week === w)
        const isExpanded   = expandedWks.has(w)
        const weekStatus   = getWeekStatus(weekMatchups)
        const isPlayoff    = w > 14

        return (
          <div key={w} className={`msp-week ${isPlayoff ? 'msp-week--playoff' : ''}`}>
            <button className="msp-week-header" onClick={() => toggleWeek(w)}>
              <div className="msp-week-title-group">
                <span className={`msp-week-num ${isPlayoff ? 'msp-week-num--playoff' : ''}`}>
                  {weekTitle(w)}
                </span>
                <span className={`msp-week-status msp-week-status--${weekStatus}`}>
                  {weekStatus === 'final' ? 'FINAL'
                    : weekStatus === 'live' ? '● LIVE'
                    : weekMatchups.filter(m => m.status === 'final').length > 0
                      ? `${weekMatchups.filter(m => m.status === 'final').length}/${weekMatchups.length} FINAL`
                      : 'UPCOMING'}
                </span>
              </div>
              <span className="msp-week-toggle">{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
              <div className="msp-week-body">
                {weekMatchups.map(m => (
                  <MatchupRow key={m.id} matchup={m} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
