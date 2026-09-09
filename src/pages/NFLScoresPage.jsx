import { useState, useEffect, useCallback } from 'react'
import './ScoreboardPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const POLL_MS = 30000        // ESPN sends max-age=5; 30s is plenty and gentle
const NFL_WEEKS = 18

// Live NFL scores, laid out to mirror the league scoreboard.
//
// Ordering is deliberate: in-progress games first, then upcoming, then final.
// During a slate the games you care about are the ones being played, and a
// kickoff-ordered list buries them under whatever finished at 1pm.
const STATE_ORDER = { in: 0, pre: 1, post: 2 }

function GameCard({ game }) {
  const { home, away, state, detail, period, clock, broadcast } = game
  const isLive  = state === 'in'
  const isFinal = state === 'post'

  const homeWon = isFinal && home?.winner
  const awayWon = isFinal && away?.winner

  const Side = ({ team, won, right }) => (
    <div className={`mc-team ${right ? 'mc-team--away' : 'mc-team--home'} ${won ? 'mc-team--winner' : ''}`}>
      {!right && team?.logo && <img src={team.logo} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />}
      <div className={`mc-team-info ${right ? 'mc-team-info--right' : ''}`}>
        <span className="mc-tname">{team?.name || team?.abbrev || 'TBD'}</span>
        <span className="mc-mgr">{team?.record || ''}</span>
      </div>
      <span className={`mc-score ${won ? 'mc-score--win' : isFinal ? 'mc-score--loss' : ''}`}>
        {state === 'pre' ? '\u2014' : (team?.score ?? 0)}
      </span>
      {right && team?.logo && <img src={team.logo} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />}
    </div>
  )

  return (
    <div className="mc-card">
      <div className="mc-status-bar">
        <span className={`mc-status ${isLive ? 'mc-status--live' : isFinal ? 'mc-status--final' : 'mc-status--upcoming'}`}>
          {isLive && <span className="mc-live-dot" />}
          {isLive
            ? `Q${period} ${clock}`
            : isFinal ? 'FINAL' : detail}
        </span>
        {broadcast && !isFinal && <span className="mc-diff">{broadcast}</span>}
      </div>

      <div className="mc-body">
        <Side team={home} won={homeWon} />
        <div className="mc-vs"><span>VS</span></div>
        <Side team={away} won={awayWon} right />
      </div>
    </div>
  )
}

export default function NFLScoresPage() {
  const [data, setData]       = useState(null)
  const [week, setWeek]       = useState(null)   // null = current
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback(() => {
    const qs = week ? `?week=${week}` : ''
    fetch(`${API}/nfl/scores${qs}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Scoreboard unavailable')))
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
        setError('')
        // First load with no explicit week: adopt whatever ESPN says is current,
        // so the selector highlights the right button.
        setWeek(prev => prev ?? d.week ?? 1)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [week])

  useEffect(() => { load() }, [load])

  // Only poll when something is actually being played -- there is no reason to
  // hit the endpoint every 30 seconds while looking at a finished week.
  const anyLive = (data?.games || []).some(g => g.state === 'in')
  useEffect(() => {
    if (!anyLive) return
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [anyLive, load])

  const games = [...(data?.games || [])].sort((a, b) => {
    const s = (STATE_ORDER[a.state] ?? 3) - (STATE_ORDER[b.state] ?? 3)
    if (s !== 0) return s
    return new Date(a.kickoff) - new Date(b.kickoff)
  })

  const liveCount = games.filter(g => g.state === 'in').length

  return (
    <div className="sb-root">
      <div className="sb-header">
        <h1 className="sb-title">NFL Scores</h1>
        <p className="sb-sub">
          {data?.season ? `${data.season} season` : 'Loading'}
          {liveCount > 0 && ` \u00b7 ${liveCount} game${liveCount > 1 ? 's' : ''} in progress`}
        </p>

        <div className="sb-week-row">
          <div className="sb-week-group">
            <span className="sb-week-group-label">WK</span>
            {Array.from({ length: NFL_WEEKS }, (_, i) => i + 1).map(w => (
              <button key={w}
                className={`sb-week-btn ${week === w ? 'sb-week-btn--active' : ''}`}
                onClick={() => { setWeek(w); setLoading(true) }}>
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="sb-loading">Loading scores...</div>}

      {error && !loading && (
        <div className="sb-loading" style={{ color: 'var(--red, #d94f4f)' }}>{error}</div>
      )}

      {!loading && !error && games.length === 0 && (
        <div className="sb-loading">No games scheduled for week {week}.</div>
      )}

      {!loading && !error && games.length > 0 && (
        <div className="sb-grid">
          {games.map(g => <GameCard key={g.id} game={g} />)}
        </div>
      )}
    </div>
  )
}
