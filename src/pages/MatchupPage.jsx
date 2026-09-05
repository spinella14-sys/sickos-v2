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

// Per-player game status indicator — informational only; the PROJ/TOT
// numbers themselves live in the dedicated pts block next to each player.
function PlayerStatus({ player, isFinal, gameInfo }) {
  if (!player) return null

  const hasStats  = player.week_pts !== null
  const isLocked  = player.is_locked
  // A player is on bye when their NFL team has NO game this week -- the
  // schedule is authoritative. The old test was `bye_week != null`, which is
  // true for anyone who has a bye at ANY point in the season, so every player
  // with a known bye week rendered BYE in every week.
  const onBye     = player.week_pts === null && !isLocked && gameInfo === null

  if (onBye) {
    return <span className="mp-player-status mp-status-bye">BYE</span>
  }
  if (hasStats && isFinal) {
    return <span className="mp-player-status mp-status-final">FINAL</span>
  }
  if (isLocked) {
    return <span className="mp-player-status mp-status-playing">PLAYING</span>
  }
  const oppText = gameInfo?.opponent
    ? `${gameInfo.is_home ? 'vs' : '@'} ${gameInfo.opponent}${formatKickoff(gameInfo.game_date)}`
    : null
  return <span className="mp-player-status mp-status-upcoming">{oppText || 'UPCOMING'}</span>
}

function formatKickoff(gameDate) {
  if (!gameDate) return ''
  const d = new Date(gameDate)
  if (isNaN(d.getTime())) return ''
  const day  = d.toLocaleDateString('en-US', { weekday: 'short' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return ` · ${day} ${time}`
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

function PlayerCell({ player, side, projMap, opponentMap, isFinal }) {
  const isRight  = side === 'away'
  const gameInfo = player ? (opponentMap[player.nfl_team] ?? null) : null
  const hasPlayed = player?.week_pts !== null
  // PROJ: frozen at lock time (never changes again), live rolling estimate before that
  const projVal = player
    ? (player.is_locked ? player.locked_proj_pts : (projMap[player.sleeper_id] ?? null))
    : null
  const projDisplay = projVal != null ? projVal.toFixed(1) : '—'

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
      <PlayerStatus player={player} isFinal={isFinal} gameInfo={gameInfo} />
    </div>
  )

  const headshot = (
    <img src={headshotUrl(player.sleeper_id)} alt={player.full_name}
      className="mp-headshot" onError={e => e.target.style.opacity = 0} />
  )

  const totDisplay = player?.week_pts != null ? player.week_pts.toFixed(1) : '0.0'

  const ptsEl = (
    <div className="mp-pts-block">
      <span className={`mp-pts-tot ${!hasPlayed ? 'mp-pts-tot--zero' : ''}`}>{totDisplay}</span>
      <span className="mp-pts-proj">PROJ {projDisplay}</span>
    </div>
  )

  return (
    <div className={`mp-player ${isRight ? 'mp-player--right' : ''} ${player.is_locked && !isFinal ? 'mp-player--live' : ''}`}>
      {isRight ? <>{ptsEl}{bio}{headshot}</> : <>{headshot}{bio}{ptsEl}</>}
    </div>
  )
}

// Bench player row — same PROJ/TOT + opponent-info treatment as starters,
// compact layout, mirrored home/away the same way (JSX order, no CSS reversal).
function BenchPlayerRow({ player, side, projMap, opponentMap, isFinal }) {
  const isRight   = side === 'away'
  const gameInfo  = opponentMap[player.nfl_team] ?? null
  const hasPlayed = player.week_pts !== null
  const projVal = player.is_locked ? player.locked_proj_pts : (projMap[player.sleeper_id] ?? null)
  const projDisplay = projVal != null ? projVal.toFixed(1) : '—'
  const totDisplay  = player.week_pts != null ? player.week_pts.toFixed(1) : '0.0'

  const headshot = (
    <img src={headshotUrl(player.sleeper_id)} alt="" className="mp-bench-headshot"
      onError={e => e.target.style.opacity = 0} />
  )
  const info = (
    <div className={`mp-bench-info ${isRight ? 'mp-bench-info--right' : ''}`}>
      <div className={`mp-bench-name-row ${isRight ? 'mp-bench-name-row--right' : ''}`}>
        <PlayerLink playerId={player.sleeper_id} className="mp-bench-name">{player.full_name}</PlayerLink>
        <InjBadge status={player.injury_status} />
      </div>
      <span className="mp-bench-meta" style={{ color: POS_COLOR[player.position] }}>{player.position}</span>
      <PlayerStatus player={player} isFinal={isFinal} gameInfo={gameInfo} />
    </div>
  )
  const pts = (
    <div className="mp-pts-block mp-pts-block--bench">
      <span className={`mp-pts-tot mp-pts-tot--bench ${!hasPlayed ? 'mp-pts-tot--zero' : ''}`}>{totDisplay}</span>
      <span className="mp-pts-proj mp-pts-proj--bench">PROJ {projDisplay}</span>
    </div>
  )

  return (
    <div className={`mp-bench-player ${isRight ? 'mp-bench-player--right' : ''} ${player.is_locked && !isFinal ? 'mp-player--live' : ''}`}>
      {isRight ? <>{pts}{info}{headshot}</> : <>{headshot}{info}{pts}</>}
    </div>
  )
}

// Fixed right-edge sidebar: every matchup for the week, real score + PROJ +
// team record, click any other matchup to jump to its box score.
function WeekMatchupsSidebar({ season, week, currentMatchupId }) {
  const navigate = useNavigate()
  const [matchups, setMatchups] = useState([])
  const [records, setRecords]   = useState({})
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!season || !week) return
    fetch(`${API_BASE}/matchups?season=${season}&week=${week}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMatchups(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch(`${API_BASE}/matchups/standings?season=${season}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const map = {}
        ;(Array.isArray(data) ? data : []).forEach(t => { map[t.team] = t })
        setRecords(map)
      })
      .catch(() => {})
  }, [season, week])

  if (!matchups.length) return null

  const recordFor = (abbrev) => {
    const r = records[abbrev]
    return r ? `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}` : '0-0'
  }

  return (
    <>
      <button className={`mp-sidebar-tab ${open ? 'mp-sidebar-tab--open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className="mp-sidebar-tab-label">Week {week}</span>
        <span className="mp-sidebar-tab-arrow">{open ? '›' : '‹'}</span>
      </button>
      <div className={`mp-sidebar ${open ? 'mp-sidebar--open' : ''}`}>
        <div className="mp-sidebar-header">Week {week} Matchups</div>
        <div className="mp-sidebar-list">
          {matchups.map(m => {
            const isCurrent = m.id === currentMatchupId
            const statusLabel = m.status === 'final' ? 'FINAL' : m.status === 'in_progress' ? 'LIVE' : ''
            return (
              <div
                key={m.id}
                className={`mp-sidebar-card ${isCurrent ? 'mp-sidebar-card--current' : ''}`}
                onClick={() => !isCurrent && navigate(`/matchup/${m.id}`)}
              >
                {statusLabel && <div className="mp-sidebar-card-status">{statusLabel}</div>}
                <div className="mp-sidebar-row">
                  <img src={LOGOS[m.home_team]} alt="" className="mp-sidebar-logo" onError={e => e.target.style.opacity = 0} />
                  <div className="mp-sidebar-team-info">
                    <span className="mp-sidebar-abbrev">{m.home_team}</span>
                    <span className="mp-sidebar-record">{recordFor(m.home_team)}</span>
                  </div>
                  <div className="mp-sidebar-nums">
                    <span className="mp-sidebar-score">{(m.home_score || 0).toFixed(1)}</span>
                    <span className="mp-sidebar-proj">PROJ {(m.home_proj || 0).toFixed(1)}</span>
                  </div>
                </div>
                <div className="mp-sidebar-row">
                  <img src={LOGOS[m.away_team]} alt="" className="mp-sidebar-logo" onError={e => e.target.style.opacity = 0} />
                  <div className="mp-sidebar-team-info">
                    <span className="mp-sidebar-abbrev">{m.away_team}</span>
                    <span className="mp-sidebar-record">{recordFor(m.away_team)}</span>
                  </div>
                  <div className="mp-sidebar-nums">
                    <span className="mp-sidebar-score">{(m.away_score || 0).toFixed(1)}</span>
                    <span className="mp-sidebar-proj">PROJ {(m.away_proj || 0).toFixed(1)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default function MatchupPage() {
  const { matchupId } = useParams()
  const navigate      = useNavigate()
  const { manager }   = useAuth()

  const [matchup,  setMatchup]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [projMap,      setProjMap]      = useState({})
  const [opponentMap,  setOpponentMap]  = useState({})
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

  // Fetch real per-NFL-team opponent + kickoff time for this week, so
  // "UPCOMING" can show real matchup info instead of a generic label.
  useEffect(() => {
    if (!matchup?.season || !matchup?.week) return
    fetch(`${API_BASE}/schedule/opponents?season=${matchup.season}&week=${matchup.week}`)
      .then(r => r.ok ? r.json() : {})
      .then(data => setOpponentMap(data || {}))
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

  // Projected totals: frozen locked_proj_pts once a player is locked
  // (never recalculated after), live rolling projMap estimate before that.
  const projTotal = (lineup) =>
    lineup
      .filter(p => STARTER_SLOTS.has(p.slot_type))
      .reduce((s, p) => {
        const proj = p.is_locked ? (p.locked_proj_pts ?? 0) : (projMap[p.sleeper_id] ?? 0)
        return s + proj
      }, 0)
      .toFixed(2)

  return (
    <div className="mp-root">

      <WeekMatchupsSidebar season={matchup.season} week={matchup.week} currentMatchupId={matchup.id} />

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
                  <PlayerCell player={home} side="home" projMap={projMap} opponentMap={opponentMap} isFinal={isFinal} />
                  <div className="mp-slot-center">
                    <span className="mp-slot-badge" style={{ color: POS_COLOR[slot] || 'var(--text-muted)' }}>
                      {slot}
                    </span>
                  </div>
                  <PlayerCell player={away} side="away" projMap={projMap} opponentMap={opponentMap} isFinal={isFinal} />
                </div>
              ))}
            </div>

            {/* Totals — real PROJ + TOT always shown together */}
            <div className="mp-totals-row">
              <div className="mp-totals-side">
                <div className={`mp-total-score ${homeWins ? 'mp-total--win' : 'mp-total--loss'}`}>
                  {homeScore.toFixed(2)}
                </div>
                <div className="mp-total-proj">PROJ {projTotal(matchup.home_lineup || [])}</div>
              </div>
              <div className="mp-totals-label">{isFinal ? 'FINAL' : isLive ? 'LIVE' : 'PREVIEW'}</div>
              <div className="mp-totals-side mp-totals-side--right">
                <div className={`mp-total-score mp-total-score--right ${awayWins ? 'mp-total--win' : 'mp-total--loss'}`}>
                  {awayScore.toFixed(2)}
                </div>
                <div className="mp-total-proj">PROJ {projTotal(matchup.away_lineup || [])}</div>
              </div>
            </div>

            {/* Bench */}
            {(homeBench.length > 0 || awayBench.length > 0) && (
              <>
                <div className="mp-section-divider"><span>BENCH</span></div>
                <div className="mp-bench-grid">
                  <div className="mp-bench-col">
                    {homeBench.map(p => (
                      <BenchPlayerRow key={p.sleeper_id} player={p} side="home"
                        projMap={projMap} opponentMap={opponentMap} isFinal={isFinal} />
                    ))}
                  </div>
                  <div className="mp-bench-spacer" />
                  <div className="mp-bench-col mp-bench-col--right">
                    {awayBench.map(p => (
                      <BenchPlayerRow key={p.sleeper_id} player={p} side="away"
                        projMap={projMap} opponentMap={opponentMap} isFinal={isFinal} />
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
