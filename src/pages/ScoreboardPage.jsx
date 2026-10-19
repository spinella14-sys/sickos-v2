import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TEAMS, LOGOS } from '../data/league'
import { useAuth } from '../context/AuthContext'
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

function TeamLogo({ abbrev, size = 64 }) {
  const url = LOGOS[abbrev]
  if (!url) return <span className="sb-logo-ph" style={{ width: size, height: size }} />
  return <img src={url} alt={abbrev} className="sb-logo" style={{ width: size, height: size }} loading="lazy" />
}

// One read of a matchup row, shared by the hero and the small cards so the
// two can never disagree about who is winning.
function readMatchup(m, records) {
  const homeScore = parseFloat(m.home_score || 0)
  const awayScore = parseFloat(m.away_score || 0)
  return {
    home: {
      abbrev: m.home_team,
      team:   TEAMS.find(t => t.abbrev === m.home_team),
      rec:    records?.[m.home_team],
      score:  homeScore,
      proj:   m.home_proj != null ? parseFloat(m.home_proj) : null,
      isWinner: homeScore > awayScore,
    },
    away: {
      abbrev: m.away_team,
      team:   TEAMS.find(t => t.abbrev === m.away_team),
      rec:    records?.[m.away_team],
      score:  awayScore,
      proj:   m.away_proj != null ? parseFloat(m.away_proj) : null,
      isWinner: awayScore > homeScore,
    },
    hasScores: homeScore > 0 || awayScore > 0,
    isFinal:   m.status === 'final',
    isLive:    m.status === 'in_progress' || m.status === 'live',
    margin:    Math.abs(homeScore - awayScore).toFixed(2),
  }
}

// Home renders logo -> name -> score; away renders score -> name -> logo, so
// both scores sit inboard against the VS divider and the logos bookend the
// card. The DOM order IS the visual order -- an earlier version wrote the
// away side pre-mirrored and then flex-reversed it, which cancelled out and
// pushed away scores into the card's overflow.
// Identity half: logo outboard, name and record inboard. The scores live in
// a shared centre cluster instead of inside each half -- with a fixed score
// column per side, a 560px card left roughly 40px for the team name, which
// truncated every name and cut the record off entirely.
function TeamIdent({ side, data, logoSize }) {
  const { abbrev, team, rec } = data
  const logo = <TeamLogo abbrev={abbrev} size={logoSize} />
  const info = (
    <div className={`mc-team-info ${side === 'away' ? 'mc-team-info--right' : ''}`}>
      <span className="mc-tname">{team?.name || abbrev}</span>
      <span className="mc-mgr">
        {team?.manager}
        {rec && <span className="mc-rec"> · {rec.wins}-{rec.losses}</span>}
      </span>
    </div>
  )
  return side === 'home'
    ? <div className="mc-ident mc-ident--home">{logo}{info}</div>
    : <div className="mc-ident mc-ident--away">{info}{logo}</div>
}

function ScoreCell({ data, hasScores, isFinal }) {
  const { score, proj, isWinner } = data
  const cls = !hasScores ? '' : isWinner ? 'mc-score--win' : isFinal ? 'mc-score--loss' : ''
  return (
    <div className="mc-score-block">
      <span className={`mc-score ${cls}`}>{hasScores ? score.toFixed(2) : '—'}</span>
      {proj != null && <span className="mc-proj">PROJ {proj.toFixed(1)}</span>}
    </div>
  )
}

function StatusBar({ d }) {
  return (
    <div className="mc-status-bar">
      <span className={`mc-status ${d.isLive ? 'mc-status--live' : d.isFinal ? 'mc-status--final' : 'mc-status--upcoming'}`}>
        {d.isLive && <span className="mc-live-dot" />}
        {d.isLive ? 'LIVE' : d.isFinal ? 'FINAL' : 'UPCOMING'}
      </span>
      {d.hasScores && d.isFinal && <span className="mc-diff">by {d.margin}</span>}
    </div>
  )
}

function MatchupCard({ matchup, records }) {
  const d = readMatchup(matchup, records)
  return (
    <Link to={`/matchup/${matchup.id}`} className="mc-card mc-card--link">
      <StatusBar d={d} />
      <div className="mc-body">
        <TeamIdent side="home" data={d.home} logoSize={60} />
        <div className="mc-center">
          <ScoreCell data={d.home} hasScores={d.hasScores} isFinal={d.isFinal} />
          <span className="mc-vs">VS</span>
          <ScoreCell data={d.away} hasScores={d.hasScores} isFinal={d.isFinal} />
        </div>
        <TeamIdent side="away" data={d.away} logoSize={60} />
      </div>
    </Link>
  )
}

// The viewing manager's own matchup, lifted out of the grid. Ordering the
// grid by division put the same teams on top every week, which reads as
// favouritism; everyone now leads with their own game.
function HeroMatchup({ matchup, records }) {
  const d = readMatchup(matchup, records)
  const total = d.home.score + d.away.score
  const homePct = total > 0 ? (d.home.score / total) * 100 : 50

  return (
    <Link to={`/matchup/${matchup.id}`} className="mc-card mc-card--link mc-hero">
      <div className="mc-hero-tag">Your Matchup</div>
      <StatusBar d={d} />
      <div className="mc-body mc-body--hero">
        <TeamIdent side="home" data={d.home} logoSize={96} />
        <div className="mc-center mc-center--hero">
          <ScoreCell data={d.home} hasScores={d.hasScores} isFinal={d.isFinal} />
          <span className="mc-vs mc-vs--hero">VS</span>
          <ScoreCell data={d.away} hasScores={d.hasScores} isFinal={d.isFinal} />
        </div>
        <TeamIdent side="away" data={d.away} logoSize={96} />
      </div>
      {d.hasScores && (
        <div className="mc-hero-bar">
          <span className="mc-hero-bar-fill mc-hero-bar-fill--home" style={{ width: `${homePct}%` }} />
          <span className="mc-hero-bar-fill mc-hero-bar-fill--away" style={{ width: `${100 - homePct}%` }} />
        </div>
      )}
    </Link>
  )
}

export default function ScoreboardPage() {
  const { teamAbbrev } = useAuth()

  const [season,   setSeason]   = useState(CURRENT_SEASON)
  const [week,     setWeek]     = useState(1)
  const [matchups, setMatchups] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [records,  setRecords]  = useState({})

  // Real W-L, computed server-side from final matchups.
  useEffect(() => {
    fetch(`${API_BASE}/standings?season=${season}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const m = {}
        const rows = Array.isArray(d) ? d : (d?.standings || d?.teams || [])
        rows.forEach(t => {
          const ab = t.team_abbrev || t.abbrev
          if (ab) m[ab] = { wins: t.wins ?? 0, losses: t.losses ?? 0 }
        })
        setRecords(m)
      })
      .catch(() => {})
  }, [season])

  // On mount, try to auto-detect the most relevant week from the data
  useEffect(() => {
    fetch(`${API_BASE}/matchups?season=${CURRENT_SEASON}&sort=desc`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!Array.isArray(data) || !data.length) return
        const live  = data.find(m => m.status === 'in_progress' || m.status === 'live')
        const final = data.find(m => m.status === 'final')
        if (live) setWeek(live.week)
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

  // Any matchup where EITHER side has scored. Testing only the home score
  // dropped a matchup whose away team led -- Wixted's 66.42 was invisible
  // because their opponent had not started, so a lower score showed as the
  // week's high.
  const finishedGames = matchups.filter(m =>
    m.status === 'final' ||
    parseFloat(m.home_score || 0) > 0 ||
    parseFloat(m.away_score || 0) > 0
  )
  // A team whose players have not kicked off yet sits at 0.00, which is not a
  // score -- including those drags the average down and means nothing.
  const allScores  = finishedGames
    .flatMap(m => [parseFloat(m.home_score || 0), parseFloat(m.away_score || 0)])
    .filter(v => v > 0)
  const avgScore   = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : null
  const highScore  = allScores.length ? Math.max(...allScores).toFixed(2) : null
  const highTeam = allScores.length ? (() => {
    let top = null
    finishedGames.forEach(m => {
      ;[{ t: m.home_team, v: parseFloat(m.home_score || 0) },
        { t: m.away_team, v: parseFloat(m.away_score || 0) }].forEach(x => {
        if (top === null || x.v > top.v) top = x
      })
    })
    return top?.t || null
  })() : null

  const myMatchup = teamAbbrev
    ? matchups.find(m => m.home_team === teamAbbrev || m.away_team === teamAbbrev)
    : null
  const restMatchups = myMatchup ? matchups.filter(m => m.id !== myMatchup.id) : matchups

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
                {highTeam && (
                  <span className="sb-high-scorer">
                    {TEAMS.find(t => t.abbrev === highTeam)?.name || highTeam}
                  </span>
                )}
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
            {week > 14 && <p>Playoff bracket seeds after Week 14 finalizes.</p>}
          </div>
        ) : (
          <>
            {myMatchup && <HeroMatchup matchup={myMatchup} records={records} />}
            <div className="sb-grid">
              {restMatchups.map(m => <MatchupCard key={m.id} matchup={m} records={records} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
