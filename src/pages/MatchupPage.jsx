import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { LOGOS } from '../data/league'
import { useAuth } from '../context/AuthContext'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import { headshotUrl } from '../hooks/useSleeper'
import './MatchupPage.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '') + '/api'

const POS_COLOR     = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }
const DISPLAY_SLOTS = ['QB','RB','RB','WR','WR','WR','TE','FLEX']
const STARTER_SLOTS = new Set(['QB','RB','WR','TE','FLEX'])
const BENCH_SLOTS   = new Set(['BN'])
const INJ_LABEL     = { Q:'Q', D:'D', O:'OUT', IR:'IR', PUP:'PUP' }
const INJ_COLOR     = { Q:'#d4a843', D:'#d94f4f', O:'#d94f4f', IR:'#d94f4f', PUP:'#d94f4f' }

const POLL_INTERVAL = 60 * 1000  // 60 seconds when live

function InjBadge({ status }) {
  if (!status) return null
  return (
    <span className="mp-inj" style={{ color: INJ_COLOR[status] || '#888', borderColor: INJ_COLOR[status] || '#888' }}>
      {INJ_LABEL[status] || status}
    </span>
  )
}

// Per-player game status indicator
function PlayerStatus({ player, projPts, isFinal }) {
  if (!player) return null

  const hasStats  = player.week_pts !== null
  const isLocked  = player.is_locked
  const onBye     = player.week_pts === null && !isLocked && player.bye_week != null

  if (onBye) {
    return <span className="mp-player-status mp-status-bye">BYE</span>
  }
  if (hasStats && isFinal) {
    return <span className="mp-player-status mp-status-final">FINAL</span>
  }
  if (hasStats && isLocked) {
    return <span className="mp-player-status mp-status-playing">PLAYING</span>
  }
  if (!hasStats && isLocked) {
    return <span className="mp-player-status mp-status-playing">PLAYING</span>
  }
  if (!hasStats && !isLocked) {
    if (projPts != null) {
      return <span className="mp-player-status mp-status-proj">PROJ {projPts.toFixed(1)}</span>
    }
    return <span className="mp-player-status mp-status-upcoming">UPCOMING</span>
  }
  return null
}

function buildRows(homeLineup, awayLineup) {
  const homeBySlot = {}
  const awayBySlot = {}
  homeLineup.filter(p => STARTER_SLOTS.has(p.slot_type)).forEach(p => {
    if (!homeBySlot[p.slot_type]) homeBySlot[p.slot_type] = []
    homeBySlot[p.slot_type].push(p)
  })
  awayLineup.filter(p => STARTER_SLOTS.has(p.slot_type)).forEach(p => {
    if (!awayBySlot[p.slot_type]) awayBySlot[p.slot_type] = []
    awayBySlot[p.slot_type].push(p)
  })
  const counts = {}
  return DISPLAY_SLOTS.map(slot => {
    const idx = counts[slot] ?? 0
    counts[slot] = idx + 1
    return { slot, home: homeBySlot[slot]?.[idx] || null, away: awayBySlot[slot]?.[idx] || null }
  })
}

function PlayerCell({ player, side, projMap, isFinal }) {
  const isRight  = side === 'away'
  const projPts  = player ? (projMap[player.sleeper_id] ?? null) : null
  const pts      = player?.week_pts != null ? player.week_pts.toFixed(1) : null
  const hasPlayed = player?.week_pts !== null

  if (!player) {
    return (
      <div className={`mp-player mp-player--empty ${isRight ? 'mp-player--right' : ''}`}>
        <span className="mp-empty-text">Empty</span>
      </div>
    )
  }

  const bio = (
    <div className={`mp-player-bio ${isRight ? 'mp-player-bio--right' : ''}`}>
      <div className={`mp-player-name-row ${isRight ? 'mp-player-name-row--right' : ''}`}>
        <PlayerLink playerId={player.sleeper_id} className="mp-player-name">
          {player.full_name}
        </PlayerLink>
        <InjBadge status={player.injury_status} />
      </div>
      <div className={`mp-player-meta ${isRight ? 'mp-player-meta--right' : ''}`}>
        <span className="mp-nfl-team" style={{ color: POS_COLOR[player.position] }}>
          {player.nfl_team || 'FA'}
        </span>
        {player.stat_line && (
          <span className="mp-stat-line">{player.stat_line}</span>
        )}
      </div>
      <PlayerStatus player={player} projPts={projPts} isFinal={isFinal} />
    </div>
  )

  const headshot = (
    <img src={headshotUrl(player.sleeper_id)} alt={player.full_name}
      className="mp-headshot" onError={e => e.target.style.opacity = 0} />
  )

  // When no actual stats yet, show projection dimly in place of points
  const displayPts = pts !== null ? pts : (projPts != null ? projPts.toFixed(1) : '—')
  const ptsClass   = pts !== null
    ? `mp-pts ${!hasPlayed ? 'mp-pts--zero' : ''}`
    : 'mp-pts mp-pts--proj'

  const ptsEl = (
    <span className={ptsClass}>{displayPts}</span>
  )

  return (
    <div className={`mp-player ${isRight ? 'mp-player--right' : ''} ${player.is_locked && !isFinal ? 'mp-player--live' : ''}`}>
      {isRight ? <>{ptsEl}{bio}{headshot}</> : <>{headshot}{bio}{ptsEl}</>}
    </div>
  )
}

export default function MatchupPage() {
  const { matchupId } = useParams()
  const navigate      = useNavigate()
  const { manager }   = useAuth()

  const [matchup,  setMatchup]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [projMap,  setProjMap]  = useState({})
  const [lastPoll, setLastPoll] = useState(null)
  const pollRef   = useRef(null)

  const fetchMatchup = () => {
    if (!matchupId) return
    fetch(`${API_BASE}/matchups/${matchupId}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
      .then(data => {
        setMatchup(data)
        setLoading(false)
        setLastPoll(new Date())
      })
      .catch(e => { setError(e.error || 'Failed to load'); setLoading(false) })
  }

  // Initial fetch
  useEffect(() => {
    setLoading(true)
    fetchMatchup()
  }, [matchupId])

  // Live polling — only when game is in progress
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (matchup?.status === 'in_progress') {
      pollRef.current = setInterval(fetchMatchup, POLL_INTERVAL)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [matchup?.status, matchupId])

  // Fetch projections for this week (used when games haven't started)
  useEffect(() => {
    if (!matchup?.season || !matchup?.week) return
    fetch(`${API_BASE}/projections/${matchup.season}/${matchup.week}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const map = {}
        ;(Array.isArray(data) ? data : []).forEach(p => { map[p.sleeper_id] = parseFloat(p.proj_pts || 0) })
        setProjMap(map)
      })
      .catch(() => {})
  }, [matchup?.season, matchup?.week])

  const displayRows = useMemo(() => {
    if (!matchup) return []
    return buildRows(matchup.home_lineup || [], matchup.away_lineup || [])
  }, [matchup])

  const homeBench = useMemo(() => matchup?.home_lineup?.filter(p => BENCH_SLOTS.has(p.slot_type)) || [], [matchup])
  const awayBench = useMemo(() => matchup?.away_lineup?.filter(p => BENCH_SLOTS.has(p.slot_type)) || [], [matchup])

  if (loading) return (
    <div className="mp-loading"><div className="mp-spinner" /><span>Loading matchup…</span></div>
  )
  if (error || !matchup) return (
    <div className="mp-error">
      <span>{error || 'Matchup not found'}</span>
      <button onClick={() => navigate(-1)}>← Back</button>
    </div>
  )

  const homeScore = matchup.home_score || 0
  const awayScore = matchup.away_score || 0
  const homeWins  = homeScore > awayScore
  const awayWins  = awayScore > homeScore
  const isFinal   = matchup.status === 'final'
  const isLive    = matchup.status === 'in_progress'
  const isMyMatchup = manager?.team_abbrev === matchup.home_team || manager?.team_abbrev === matchup.away_team
  const myTeam      = manager?.team_abbrev
  const iWin        = isMyMatchup && (
    myTeam === matchup.home_team ? homeScore > awayScore : awayScore > homeScore
  )

  // Projected totals (for upcoming starters)
  const projTotal = (lineup) =>
    lineup
      .filter(p => STARTER_SLOTS.has(p.slot_type))
      .reduce((s, p) => s + (p.week_pts ?? projMap[p.sleeper_id] ?? 0), 0)
      .toFixed(2)

  return (
    <div className="mp-root">

      {/* ── Scoreboard header ── */}
      <div className="mp-header">
        <div className="mp-header-inner">

          {/* Home */}
          <div className={`mp-team-block mp-team-block--home ${homeWins && isFinal ? 'mp-team-block--winner' : ''}`}>
            <img src={LOGOS[matchup.home_team]} alt={matchup.home_team}
              className="mp-team-logo" onError={e => e.target.style.opacity = 0} />
            <div className="mp-team-info">
              <Link to={`/team/${matchup.home_team}`} className="mp-team-name">
                {matchup.home_team_name}
              </Link>
              <span className="mp-team-abbrev">{matchup.home_team}</span>
              {(isLive || !isFinal) && (
                <span className="mp-proj-score">Proj: {projTotal(matchup.home_lineup || [])}</span>
              )}
            </div>
            <div className={`mp-score ${homeWins && isFinal ? 'mp-score--win' : !homeWins && isFinal ? 'mp-score--loss' : ''}`}>
              {homeScore.toFixed(2)}
            </div>
          </div>

          {/* Center */}
          <div className="mp-center-block">
            <div className="mp-week-label">Week {matchup.week}</div>
            <div className={`mp-status-badge ${isLive ? 'mp-status--live' : isFinal ? 'mp-status--final' : 'mp-status--upcoming'}`}>
              {isLive && <span className="mp-live-dot" />}
              {isLive ? 'LIVE' : isFinal ? 'FINAL' : 'UPCOMING'}
            </div>
            <div className="mp-season-label">{matchup.season}</div>
            {isMyMatchup && isFinal && (
              <div className={`mp-result-badge ${iWin ? 'mp-result--win' : 'mp-result--loss'}`}>
                {iWin ? 'WIN' : 'LOSS'}
              </div>
            )}
            {isLive && lastPoll && (
              <div className="mp-last-poll">
                Updated {lastPoll.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
              </div>
            )}
          </div>

          {/* Away */}
          <div className={`mp-team-block mp-team-block--away ${awayWins && isFinal ? 'mp-team-block--winner' : ''}`}>
            <div className={`mp-score mp-score--away ${awayWins && isFinal ? 'mp-score--win' : !awayWins && isFinal ? 'mp-score--loss' : ''}`}>
              {awayScore.toFixed(2)}
            </div>
            <div className="mp-team-info mp-team-info--away">
              <Link to={`/team/${matchup.away_team}`} className="mp-team-name">
                {matchup.away_team_name}
              </Link>
              <span className="mp-team-abbrev">{matchup.away_team}</span>
              {(isLive || !isFinal) && (
                <span className="mp-proj-score">Proj: {projTotal(matchup.away_lineup || [])}</span>
              )}
            </div>
            <img src={LOGOS[matchup.away_team]} alt={matchup.away_team}
              className="mp-team-logo" onError={e => e.target.style.opacity = 0} />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mp-body">
        {!matchup.has_lineup_data ? (
          <div className="mp-no-lineup">
            <div className="mp-no-lineup-icon">📋</div>
            <div className="mp-no-lineup-title">Lineup data unavailable</div>
            <div className="mp-no-lineup-sub">
              Player-by-player breakdown is only available for weeks after the lineup system was set up.
              Final score: <strong>{matchup.home_team} {homeScore.toFixed(2)}</strong> — <strong>{matchup.away_team} {awayScore.toFixed(2)}</strong>
            </div>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="mp-col-headers">
              <div className="mp-col-header-team">
                <Link to={`/team/${matchup.home_team}`}>{matchup.home_team}</Link>
              </div>
              <div className="mp-col-header-slot">SLOT</div>
              <div className="mp-col-header-team mp-col-header-team--right">
                <Link to={`/team/${matchup.away_team}`}>{matchup.away_team}</Link>
              </div>
            </div>

            {/* Starter rows */}
            <div className="mp-rows">
              {displayRows.map(({ slot, home, away }, i) => (
                <div key={`${slot}-${i}`} className="mp-row">
                  <PlayerCell player={home} side="home" projMap={projMap} isFinal={isFinal} />
                  <div className="mp-slot-center">
                    <span className="mp-slot-badge" style={{ color: POS_COLOR[slot] || 'var(--text-muted)' }}>
                      {slot}
                    </span>
                  </div>
                  <PlayerCell player={away} side="away" projMap={projMap} isFinal={isFinal} />
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mp-totals-row">
              <div className={`mp-total-score ${homeWins ? 'mp-total--win' : 'mp-total--loss'}`}>
                {homeScore.toFixed(2)}
              </div>
              <div className="mp-totals-label">{isFinal ? 'FINAL' : isLive ? 'LIVE' : 'PROJECTED'}</div>
              <div className={`mp-total-score mp-total-score--right ${awayWins ? 'mp-total--win' : 'mp-total--loss'}`}>
                {awayScore.toFixed(2)}
              </div>
            </div>

            {/* Bench */}
            {(homeBench.length > 0 || awayBench.length > 0) && (
              <>
                <div className="mp-section-divider"><span>BENCH</span></div>
                <div className="mp-bench-grid">
                  <div className="mp-bench-col">
                    {homeBench.map(p => (
                      <div key={p.sleeper_id} className="mp-bench-player">
                        <img src={headshotUrl(p.sleeper_id)} alt="" className="mp-bench-headshot"
                          onError={e => e.target.style.opacity = 0} />
                        <div className="mp-bench-info">
                          <PlayerLink playerId={p.sleeper_id} className="mp-bench-name">{p.full_name}</PlayerLink>
                          <span className="mp-bench-meta" style={{ color: POS_COLOR[p.position] }}>{p.position}</span>
                        </div>
                        <span className="mp-bench-pts">
                          {p.week_pts?.toFixed(1) ?? (projMap[p.sleeper_id] ? `(${projMap[p.sleeper_id].toFixed(1)})` : '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mp-bench-spacer" />
                  <div className="mp-bench-col mp-bench-col--right">
                    {awayBench.map(p => (
                      <div key={p.sleeper_id} className="mp-bench-player mp-bench-player--right">
                        <span className="mp-bench-pts">
                          {p.week_pts?.toFixed(1) ?? (projMap[p.sleeper_id] ? `(${projMap[p.sleeper_id].toFixed(1)})` : '—')}
                        </span>
                        <div className="mp-bench-info mp-bench-info--right">
                          <PlayerLink playerId={p.sleeper_id} className="mp-bench-name">{p.full_name}</PlayerLink>
                          <span className="mp-bench-meta" style={{ color: POS_COLOR[p.position] }}>{p.position}</span>
                        </div>
                        <img src={headshotUrl(p.sleeper_id)} alt="" className="mp-bench-headshot"
                          onError={e => e.target.style.opacity = 0} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
