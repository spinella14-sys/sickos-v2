import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import './NFLGamePage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const POLL_MS = 30000

// Box score and gamecast, side by side. Box score left, play log right, one
// shared header across the top.
//
// Player statistics come straight from ESPN with no fantasy points computed.
// Fantasy scoring lives on Sleeper data throughout this app; deriving points
// from a second source here would put two subtly different numbers on the site
// with nothing to say which was right. Managers read the raw lines and decide
// for themselves what matters.

// Passing, rushing and receiving are what almost anyone opens a box score for,
// so those start expanded and everything else waits to be asked for.
const OPEN_BY_DEFAULT = ['passing', 'rushing', 'receiving']

const CATEGORY_LABEL = {
  passing: 'Passing', rushing: 'Rushing', receiving: 'Receiving',
  fumbles: 'Fumbles', defensive: 'Defense', interceptions: 'Interceptions',
  kickReturns: 'Kick Returns', puntReturns: 'Punt Returns',
  kicking: 'Kicking', punting: 'Punting',
}

function LineScore({ home, away }) {
  const qs = Math.max(home?.linescores?.length || 0, away?.linescores?.length || 0)
  const headers = Array.from({ length: qs }, (_, i) => i < 4 ? `Q${i + 1}` : `OT${i - 3}`)

  return (
    <table className="ng-linescore">
      <thead>
        <tr>
          <th />
          {headers.map(h => <th key={h}>{h}</th>)}
          <th className="ng-linescore-total">T</th>
        </tr>
      </thead>
      <tbody>
        {[away, home].map(t => (
          <tr key={t?.abbrev || Math.random()}>
            <td className="ng-linescore-team">{t?.abbrev}</td>
            {Array.from({ length: qs }, (_, i) => (
              <td key={i}>{t?.linescores?.[i] ?? '-'}</td>
            ))}
            <td className="ng-linescore-total">{t?.score ?? 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatCategory({ cat, open, onToggle }) {
  return (
    <div className="ng-cat">
      <button className="ng-cat-head" onClick={onToggle}>
        <span>{open ? '\u25be' : '\u25b8'} {CATEGORY_LABEL[cat.name] || cat.label || cat.name}</span>
        <span className="ng-cat-count">{cat.athletes.length}</span>
      </button>

      {open && (
        <div className="ng-cat-body">
          <table className="ng-stat-table">
            <thead>
              <tr>
                <th className="ng-stat-name">Player</th>
                {cat.labels.map((l, i) => <th key={i}>{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {cat.athletes.map(a => (
                <tr key={a.id}>
                  <td className="ng-stat-name">
                    {/* Only players we identified with certainty become links --
                        the backend leaves sleeper_id null when a name could
                        match more than one person. */}
                    {a.sleeper_id ? (
                      <PlayerLink playerId={a.sleeper_id} style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        {a.short || a.name}
                      </PlayerLink>
                    ) : (a.short || a.name)}
                    {a.position && <span className="ng-stat-pos">{a.position}</span>}
                  </td>
                  {a.stats.map((s, i) => <td key={i}>{s}</td>)}
                </tr>
              ))}
              {cat.totals?.length > 0 && (
                <tr className="ng-stat-totals">
                  <td className="ng-stat-name">Team</td>
                  {cat.totals.map((t, i) => <td key={i}>{t}</td>)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Drive({ drive, expanded, onToggle }) {
  const scored = /TD|FG/i.test(drive.result || '')
  const turned = /INT|FUMBLE|DOWNS/i.test(drive.result || '')

  return (
    <div className="ng-drive">
      <button className="ng-drive-head" onClick={onToggle}>
        <span className="ng-drive-team">{drive.team}</span>
        <span className="ng-drive-desc">{drive.description}</span>
        <span className={`ng-drive-result ${scored ? 'ng-drive-result--score' : turned ? 'ng-drive-result--turnover' : ''}`}>
          {drive.result}
        </span>
      </button>

      {expanded && (
        <ol className="ng-plays">
          {drive.plays.map(p => (
            <li key={p.id} className={`ng-play ${p.scoring ? 'ng-play--scoring' : ''} ${p.turnover ? 'ng-play--turnover' : ''}`}>
              <div className="ng-play-meta">
                {p.period ? `Q${p.period}` : ''} {p.clock || ''}
                {p.down && <span className="ng-play-down">{p.down}</span>}
              </div>
              <div className="ng-play-text">{p.text}</div>
              {(p.scoring || p.turnover) && (
                <div className="ng-play-score">{p.away_score} - {p.home_score}</div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default function NFLGamePage() {
  const { gameId } = useParams()
  const navigate = useNavigate()

  const [game, setGame]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [team, setTeam]       = useState(0)          // index into player_stats
  const [openCats, setOpenCats] = useState(() => new Set(OPEN_BY_DEFAULT))
  const [openDrives, setOpenDrives] = useState(() => new Set())

  const load = useCallback(() => {
    fetch(`${API}/nfl/game/${gameId}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Game unavailable')))
      .then(d => {
        if (d.error) throw new Error(d.error)
        setGame(d)
        setError('')
        // Live game: keep the newest drive open so the latest plays are visible
        // without having to click into them every refresh.
        if (d.state === 'in' && d.drives?.length) {
          setOpenDrives(prev => prev.size ? prev : new Set([d.drives[0].plays?.[0]?.id ?? 0]))
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [gameId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (game?.state !== 'in') return
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [game?.state, load])

  const toggleCat = (name) => setOpenCats(prev => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })

  const toggleDrive = (key) => setOpenDrives(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  if (loading) return <div className="ng-root"><div className="ng-loading">Loading game...</div></div>
  if (error)   return <div className="ng-root"><div className="ng-loading ng-loading--error">{error}</div></div>
  if (!game)   return null

  const isLive  = game.state === 'in'
  const isFinal = game.state === 'post'
  const sides   = game.player_stats || []
  const active  = sides[team]

  return (
    <div className="ng-root">
      <button className="ng-back" onClick={() => navigate('/nfl-scores')}>&larr; All scores</button>

      {/* Shared header across both columns */}
      <div className="ng-header">
        <div className="ng-header-teams">
          <div className="ng-header-side">
            {game.away?.logo && <img src={game.away.logo} alt="" />}
            <div>
              <div className="ng-header-name">{game.away?.name}</div>
              <div className="ng-header-rec">{game.away?.record}</div>
            </div>
            <div className={`ng-header-score ${isFinal && game.away?.winner ? 'ng-header-score--win' : ''}`}>
              {game.away?.score ?? 0}
            </div>
          </div>

          <div className="ng-header-mid">
            <span className={`ng-header-status ${isLive ? 'ng-header-status--live' : ''}`}>
              {isLive ? `Q${game.period} ${game.clock}` : isFinal ? 'FINAL' : game.detail}
            </span>
          </div>

          <div className="ng-header-side ng-header-side--home">
            <div className={`ng-header-score ${isFinal && game.home?.winner ? 'ng-header-score--win' : ''}`}>
              {game.home?.score ?? 0}
            </div>
            <div>
              <div className="ng-header-name">{game.home?.name}</div>
              <div className="ng-header-rec">{game.home?.record}</div>
            </div>
            {game.home?.logo && <img src={game.home.logo} alt="" />}
          </div>
        </div>

        <div className="ng-header-meta">
          {game.venue && <span>{game.venue}</span>}
          <span>{game.weather || 'Indoor'}</span>
          {game.broadcast && <span>{game.broadcast}</span>}
          {game.attendance ? <span>{game.attendance.toLocaleString()} attendance</span> : null}
        </div>

        {(game.away?.linescores?.length > 0) && <LineScore home={game.home} away={game.away} />}
      </div>

      {/* 40 / 60 split: box score left, gamecast right */}
      <div className="ng-columns">
        <section className="ng-box">
          <h2 className="ng-section-title">Box Score</h2>

          {sides.length > 1 && (
            <div className="ng-team-toggle">
              {sides.map((s, i) => (
                <button key={s.abbrev}
                  className={`ng-team-btn ${team === i ? 'ng-team-btn--active' : ''}`}
                  onClick={() => setTeam(i)}>
                  {s.abbrev}
                </button>
              ))}
            </div>
          )}

          {(active?.categories || []).map(cat => (
            <StatCategory key={cat.name} cat={cat}
              open={openCats.has(cat.name)}
              onToggle={() => toggleCat(cat.name)} />
          ))}

          {game.scoring?.length > 0 && (
            <>
              <h3 className="ng-sub-title">Scoring Summary</h3>
              <div className="ng-scoring">
                {game.scoring.map((p, i) => (
                  <div key={i} className="ng-score-play">
                    <div className="ng-score-meta">
                      <span className="ng-score-team">{p.team}</span>
                      <span>Q{p.period} {p.clock}</span>
                    </div>
                    <div className="ng-score-text">{p.text}</div>
                    <div className="ng-score-tally">{p.away_score} - {p.home_score}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {game.team_stats?.length > 0 && (
            <>
              <h3 className="ng-sub-title">Team Stats</h3>
              <table className="ng-team-stats">
                <thead>
                  <tr>
                    <th />
                    {game.team_stats.map(t => <th key={t.abbrev}>{t.abbrev}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(game.team_stats[0]?.stats || []).map((s, i) => (
                    <tr key={s.name}>
                      <td className="ng-ts-label">{s.label}</td>
                      {game.team_stats.map(t => <td key={t.abbrev}>{t.stats[i]?.value ?? '-'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="ng-cast">
          <h2 className="ng-section-title">
            Gamecast
            {isLive && <span className="ng-live-tag">LIVE</span>}
          </h2>

          {(game.drives || []).length === 0 ? (
            <div className="ng-empty">No plays yet.</div>
          ) : (
            (game.drives || []).map((dr, i) => {
              const key = dr.plays?.[0]?.id ?? i
              return (
                <Drive key={key} drive={dr}
                  expanded={openDrives.has(key)}
                  onToggle={() => toggleDrive(key)} />
              )
            })
          )}
        </section>
      </div>
    </div>
  )
}
