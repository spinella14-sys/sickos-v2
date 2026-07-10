import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTeamColors } from '../hooks/useTeamColors'
import { TEAMS } from '../data/league'
import { getSeasonConsts } from '../utils/contractCalc'
import LOGOS from '../assets/logos/index.js'
import PendingTradesWidget from '../components/PendingTradesWidget'
import CalendarWidget from '../components/CalendarWidget'
import TradeBlockWidget from '../components/TradeBlockWidget'
import NewsTickerWidget from '../components/NewsTickerWidget'
import './DashboardPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const CURRENT_SEASON = 2026
const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }

// ─── Season mode ──────────────────────────────────────────────────────────────
function useSeasonMode(isAdmin) {
  const [nflMode, setNflMode] = useState(null)
  const [adminOverride, setAdminOverride] = useState(null)
  useEffect(() => {
    fetch(`${API_BASE}/health`).then(r=>r.ok?r.json():null)
      .then(d => { const t=d?.nfl?.season_type; setNflMode(t==='regular'||t==='post'?'regular':'offseason') })
      .catch(()=>setNflMode('offseason'))
  },[])
  const mode = isAdmin && adminOverride ? adminOverride : (nflMode||'offseason')
  return { mode, adminOverride, setAdminOverride, nflMode }
}

// ─── Team data ────────────────────────────────────────────────────────────────
function useTeamData(abbrev) {
  const [roster, setRoster] = useState([])
  const [deadCap, setDeadCap] = useState([])
  const [sbData, setSbData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!abbrev) return
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE}/teams/${abbrev}`).then(r=>r.ok?r.json():null),
      fetch(`${API_BASE}/contracts/dead-cap/${abbrev}`).then(r=>r.ok?r.json():[]),
      fetch(`${API_BASE}/bids/sb-projection/${abbrev}?season=${CURRENT_SEASON}&salary=0`).then(r=>r.ok?r.json():null),
    ]).then(([td,dc,sb])=>{
      setRoster(td?.roster||[]); setDeadCap(dc||[]); setSbData(sb); setLoading(false)
    })
  },[abbrev])
  return { roster, deadCap, sbData, loading }
}

// ─── Current week matchup ─────────────────────────────────────────────────────
function useCurrentMatchup(abbrev) {
  const [matchup, setMatchup]   = useState(null)
  const [mLoading, setMLoading] = useState(true)
  useEffect(() => {
    if (!abbrev) return
    // Get the current NFL week, then find this team's matchup for it.
    // Falls back to week 1 during offseason (Sleeper returns 2025 season
    // in the offseason, so we always use CURRENT_SEASON for matchup lookups).
    fetch(`${API_BASE}/schedule/current-week`)
      .then(r => r.ok ? r.json() : { week: 1 })
      .then(({ week }) => {
        const safeWeek = week || 1
        fetch(`${API_BASE}/matchups?season=${CURRENT_SEASON}&team=${abbrev}&sort=asc`)
          .then(r => r.ok ? r.json() : [])
          .then(matchups => {
            if (!Array.isArray(matchups)) { setMLoading(false); return }
            // Prefer live > exact week > next upcoming > most recent
            const live     = matchups.find(m => m.status === 'in_progress')
            const thisWeek = matchups.find(m => m.week === safeWeek)
            const upcoming = matchups.find(m => m.status === 'upcoming')
            setMatchup(live || thisWeek || upcoming || matchups[0] || null)
            setMLoading(false)
          })
          .catch(() => setMLoading(false))
      })
      .catch(() => setMLoading(false))
  }, [abbrev])
  return { matchup, mLoading }
}

// ─── Shortcut icon widget ─────────────────────────────────────────────────────
function Shortcut({ to, emoji, label, colors }) {
  return (
    <Link to={to} className="dash-shortcut">
      <div className="dash-shortcut-icon" style={{
        background: colors
          ? `linear-gradient(145deg, ${colors.dimDeep}, ${colors.dim})`
          : 'rgba(255,255,255,0.06)',
        border: colors ? `1px solid ${colors.border}` : '1px solid rgba(255,255,255,0.1)',
        boxShadow: colors ? `0 4px 20px ${colors.dim}` : '0 4px 20px rgba(0,0,0,0.2)',
      }}>
        <span className="dash-shortcut-emoji">{emoji}</span>
      </div>
      <span className="dash-shortcut-label">{label}</span>
    </Link>
  )
}

// ─── Glass card wrapper ───────────────────────────────────────────────────────
function GlassCard({ children, className='', style={}, colors, accent }) {
  return (
    <div className={`dash-glass ${className}`} style={{
      '--gc-primary': colors?.primary || 'rgba(255,255,255,0.08)',
      '--gc-dim':     colors?.dim     || 'rgba(255,255,255,0.04)',
      '--gc-border':  colors?.border  || 'rgba(255,255,255,0.1)',
      borderTopColor: accent || colors?.primary || 'rgba(255,255,255,0.15)',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────
function WidgetLabel({ children, colors }) {
  return (
    <div className="dash-wlabel" style={{color: colors?.primary || 'var(--orange)'}}>
      {children}
    </div>
  )
}

// ─── Matchup widget ───────────────────────────────────────────────────────────
function MatchupWidget({ matchup, mLoading, abbrev, colors }) {
  if (mLoading) return (
    <GlassCard className="dash-scorebug-card" colors={colors}>
      <WidgetLabel colors={colors}>This Week's Matchup</WidgetLabel>
      <div className="dash-scorebug-placeholder">
        <div className="dash-scorebug-sub">Loading matchup…</div>
      </div>
    </GlassCard>
  )

  if (!matchup) return (
    <GlassCard className="dash-scorebug-card" colors={colors}>
      <WidgetLabel colors={colors}>This Week's Matchup</WidgetLabel>
      <div className="dash-scorebug-placeholder">
        <div className="dash-scorebug-sub">No matchup scheduled yet.</div>
      </div>
    </GlassCard>
  )

  const isHome    = matchup.home_team === abbrev?.toUpperCase()
  const myAbbrev  = abbrev?.toUpperCase()
  const oppAbbrev = isHome ? matchup.away_team : matchup.home_team
  const oppTeam   = TEAMS.find(t => t.abbrev === oppAbbrev)
  const myScore   = parseFloat(isHome ? (matchup.home_score||0) : (matchup.away_score||0))
  const oppScore  = parseFloat(isHome ? (matchup.away_score||0) : (matchup.home_score||0))
  const hasScores = myScore > 0 || oppScore > 0
  const isFinal   = matchup.status === 'final'
  const isLive    = matchup.status === 'in_progress' || matchup.status === 'live'
  const myWon     = isFinal && myScore > oppScore
  const weekLabel = matchup.week === 15 ? 'Playoff R1' : matchup.week === 16 ? 'Semifinals' : matchup.week === 17 ? 'Championship' : `Week ${matchup.week}`

  return (
    <GlassCard className="dash-scorebug-card" colors={colors}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <WidgetLabel colors={colors}>{weekLabel}</WidgetLabel>
        <span style={{
          fontFamily:'var(--font-ui)', fontSize:9, fontWeight:800, letterSpacing:'0.1em',
          color: isLive ? 'var(--green,#3dba6e)' : isFinal ? 'var(--text-muted)' : colors?.primary||'var(--orange)',
        }}>
          {isLive ? '● LIVE' : isFinal ? 'FINAL' : 'UPCOMING'}
        </span>
      </div>

      <Link to={`/matchup/${matchup.id}`} style={{textDecoration:'none'}}>
        <div className="dash-scorebug-teams">
          {/* My team */}
          <div className="dash-scorebug-side">
            <img src={LOGOS[myAbbrev]} alt={myAbbrev} className="dash-scorebug-logo"
              onError={e=>e.target.style.opacity=0}/>
            <div className="dash-scorebug-abbrev" style={{color:colors?.text||'var(--text-primary)'}}>{myAbbrev}</div>
            {hasScores && (
              <div style={{
                fontFamily:'var(--font-display)', fontSize:28, fontWeight:700,
                color: myWon ? (colors?.primary||'var(--orange)') : isFinal ? 'var(--text-muted)' : 'var(--text-primary)',
              }}>{myScore.toFixed(2)}</div>
            )}
          </div>

          <div className="dash-scorebug-vs">
            {hasScores ? '—' : 'VS'}
          </div>

          {/* Opponent */}
          <div className="dash-scorebug-side">
            <img src={LOGOS[oppAbbrev]} alt={oppAbbrev} className="dash-scorebug-logo"
              onError={e=>e.target.style.opacity=0}/>
            <div className="dash-scorebug-abbrev" style={{color:'var(--text-secondary)'}}>{oppAbbrev}</div>
            {hasScores && (
              <div style={{
                fontFamily:'var(--font-display)', fontSize:28, fontWeight:700,
                color: isFinal && !myWon ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>{oppScore.toFixed(2)}</div>
            )}
          </div>
        </div>

        {oppTeam && (
          <div style={{
            textAlign:'center', marginTop:8,
            fontFamily:'var(--font-ui)', fontSize:11, color:'var(--text-muted)',
          }}>
            vs {oppTeam.name}
            {oppTeam.manager && ` · ${oppTeam.manager}`}
            {isHome ? ' · Home' : ' · Away'}
          </div>
        )}
      </Link>

      <Link to="/scoreboard" className="dash-widget-footer-link" style={{
        color:colors?.primary||'var(--orange)', display:'block', textAlign:'right', marginTop:10,
      }}>
        Full Scoreboard →
      </Link>
    </GlassCard>
  )
}

// ─── Inbox Widget ─────────────────────────────────────────────────────────────
const TYPE_ICON = {
  trade_notification: '⚡', league_announcement: '📢',
  dm: '✉', waiver_result: '📋', system: '⚙',
}
const TYPE_COLOR = {
  trade_notification: 'var(--orange)', league_announcement: 'var(--gold)',
  dm: 'var(--blue)', system: 'var(--text-muted)',
}

function timeSince(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff/60)}m`
  if (diff < 86400) return `${Math.floor(diff/3600)}h`
  return `${Math.floor(diff/86400)}d`
}

function InboxWidget({ abbrev, colors, navigate, onUnreadCount }) {
  const [messages, setMessages] = useState([])
  const [unread,   setUnread]   = useState(0)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!abbrev) return
    const hdrs = { 'x-team-abbrev': abbrev }
    Promise.all([
      fetch(`${API_BASE}/messages?folder=inbox`, { headers: hdrs }).then(r=>r.ok?r.json():[]),
      fetch(`${API_BASE}/messages/unread-count`,  { headers: hdrs }).then(r=>r.ok?r.json():{count:0}),
    ]).then(([msgs, cnt]) => {
      setMessages((Array.isArray(msgs) ? msgs : []).slice(0, 5))
      const count = cnt?.count || 0
      setUnread(count)
      if (onUnreadCount) onUnreadCount(count)
      setLoading(false)
    }).catch(()=>setLoading(false))
  }, [abbrev])

  const hasUnread = unread > 0

  return (
    <GlassCard
      className={`dash-inbox-card ${hasUnread ? 'dash-glass--unread' : ''}`}
      colors={colors}
      accent={hasUnread ? 'var(--orange)' : undefined}>
      <div className="dash-inbox-header">
        <div className="dash-inbox-unread-badge">
          {hasUnread && <span className="dash-inbox-unread-dot"/>}
          <WidgetLabel colors={hasUnread ? { primary:'var(--orange)' } : colors}>
            {hasUnread ? `Inbox · ${unread} unread` : 'Inbox'}
          </WidgetLabel>
        </div>
        <div className="dash-inbox-actions">
          <button className="dash-inbox-action-btn dash-inbox-action-btn--primary"
            onClick={() => navigate('/inbox?compose=1')}>✏ Compose</button>
          <Link to="/inbox" className="dash-inbox-action-btn">View All →</Link>
        </div>
      </div>

      {loading ? (
        <div className="dash-inbox-empty">Loading…</div>
      ) : messages.length === 0 ? (
        <div className="dash-inbox-empty">No messages</div>
      ) : (
        <div className="dash-inbox-messages">
          {messages.map(msg => {
            const isUnread = !msg.is_read
            const icon = TYPE_ICON[msg.message_type] || '✉'
            const iconColor = TYPE_COLOR[msg.message_type] || 'var(--text-muted)'
            const sender = msg.sender_team === 'SYSTEM' || msg.sender_team === 'COMMISSIONER'
              ? 'Commissioner' : msg.sender_team
            return (
              <Link key={msg.id} to={`/inbox`}
                className={`dash-inbox-msg-row ${isUnread ? 'dash-inbox-msg-unread' : ''}`}>
                <span className="dash-inbox-msg-icon" style={{color: iconColor}}>{icon}</span>
                <div className="dash-inbox-msg-content">
                  <div className="dash-inbox-msg-top">
                    <span className="dash-inbox-msg-sender">{sender}</span>
                    <span className="dash-inbox-msg-time">{timeSince(msg.created_at)}</span>
                  </div>
                  <div className="dash-inbox-msg-subject">
                    {isUnread && <span className="dash-inbox-unread-pip"/>}
                    {msg.subject}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {messages.length > 0 && (
        <div className="dash-inbox-footer">
          <Link to="/inbox" className="dash-widget-footer-link" style={{color:colors?.primary||'var(--orange)'}}>
            Open Inbox →
          </Link>
        </div>
      )}
    </GlassCard>
  )
}

// ── Standings Widget ──────────────────────────────────────────────────────────
function StandingsWidget({ standings, myAbbrev, view, setView, loaded, colors }) {
  if (!loaded) return (
    <div className="dash-standings-empty">Loading standings…</div>
  )

  const myTeam = standings.find(s => s.abbrev === myAbbrev)
  const myDiv  = myTeam?.division

  // ── Division view: only show manager's division ──────────────────────────
  if (view === 'division') {
    const divTeams = standings
      .filter(s => s.division === myDiv)
      .sort((a, b) => a.div_rank - b.div_rank || b.pts_for - a.pts_for)

    return (
      <div className="dash-standings-body">
        <div className="dash-standings-div-label">{myDiv} DIVISION</div>
        <table className="dash-standings-table">
          <thead>
            <tr>
              <th></th>
              <th className="dash-st-team">TEAM</th>
              <th>W</th>
              <th>L</th>
              <th>PF</th>
            </tr>
          </thead>
          <tbody>
            {divTeams.map((s, i) => {
              const isMe = s.abbrev === myAbbrev
              return (
                <tr key={s.abbrev} className={`dash-st-row ${isMe ? 'dash-st-row--me' : ''}`}
                  style={isMe ? { background: `${colors?.dim||'rgba(255,255,255,0.04)'}`, borderLeft: `2px solid ${colors?.primary||'var(--orange)'}` } : {}}>
                  <td className="dash-st-rank">{i + 1}</td>
                  <td className="dash-st-team">
                    {LOGOS[s.abbrev] && <img src={LOGOS[s.abbrev]} alt={s.abbrev} className="dash-st-logo"/>}
                    <span className="dash-st-abbrev">{s.abbrev}</span>
                  </td>
                  <td className="dash-st-num">{s.wins}</td>
                  <td className="dash-st-num">{s.losses}</td>
                  <td className="dash-st-num dash-st-pf">{s.pts_for > 0 ? s.pts_for.toFixed(1) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Playoff view: top 6 seeds + manager if outside top 6 ─────────────────
  const sorted   = [...standings].sort((a, b) => a.rank - b.rank || b.pts_for - a.pts_for)
  const top6     = sorted.slice(0, 6)
  const seed6    = top6[5]
  const myRank   = myTeam?.rank || 999
  const inTop6   = myRank <= 6
  const gb6      = seed6 && myTeam && !inTop6
    ? ((seed6.wins - myTeam.wins) + (myTeam.losses - seed6.losses)) / 2
    : null

  const rows = inTop6 ? top6 : [...top6, myTeam].filter(Boolean)

  return (
    <div className="dash-standings-body">
      <table className="dash-standings-table">
        <thead>
          <tr>
            <th></th>
            <th className="dash-st-team">TEAM</th>
            <th>W-L</th>
            <th>PF</th>
            <th>GB</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const isMe       = s.abbrev === myAbbrev
            const isCutline  = i === 5 && !inTop6 // line before manager's team
            const gbFrom6    = i < 6 && seed6
              ? ((seed6.wins - s.wins) + (s.losses - seed6.losses)) / 2
              : gb6
            const gbDisplay  = i === 5 && !inTop6
              ? gb6?.toFixed(1)
              : gbFrom6 !== null && gbFrom6 > 0
                ? gbFrom6.toFixed(1)
                : i < top6.length - 1 ? '—' : '—'

            return (
              <React.Fragment key={s.abbrev}>
                {isCutline && (
                  <tr className="dash-st-cutline">
                    <td colSpan={5}>
                      <div className="dash-st-cutline-line">
                        <span>— Playoff cutline —</span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr className={`dash-st-row ${isMe ? 'dash-st-row--me' : ''}`}
                  style={isMe ? { background: `${colors?.dim||'rgba(255,255,255,0.04)'}`, borderLeft: `2px solid ${colors?.primary||'var(--orange)'}` } : {}}>
                  <td className="dash-st-rank" style={i < 6 ? {color:'var(--orange)',fontWeight:800} : {}}>{i < 6 ? i+1 : myRank}</td>
                  <td className="dash-st-team">
                    {LOGOS[s.abbrev] && <img src={LOGOS[s.abbrev]} alt={s.abbrev} className="dash-st-logo"/>}
                    <span className="dash-st-abbrev">{s.abbrev}</span>
                  </td>
                  <td className="dash-st-num">{s.wins}-{s.losses}</td>
                  <td className="dash-st-num dash-st-pf">{s.pts_for > 0 ? s.pts_for.toFixed(1) : '—'}</td>
                  <td className="dash-st-num" style={{color: gbDisplay !== '—' && gbDisplay > 0 ? 'var(--red,#d94f4f)' : 'var(--text-muted)'}}>
                    {gbDisplay !== '—' && parseFloat(gbDisplay) > 0 ? `+${gbDisplay}` : '—'}
                  </td>
                </tr>
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
      {!inTop6 && gb6 !== null && (
        <div className="dash-st-gb-note">
          {gb6 <= 0 ? '✓ In playoff position' : `${gb6.toFixed(1)} GB from 6th seed`}
        </div>
      )}
    </div>
  )
}

// ── Alert Bar ─────────────────────────────────────────────────────────────────
// Shows only when there are actionable items needing the manager's attention.
function AlertBar({ roster, unread, pendingTrades, currentWeek, isOffseason }) {
  const alerts = []

  // Injured players (entire roster)
  const injured = (roster || []).filter(r => {
    const status = r.players?.injury_status
    return status && ['Out', 'IR', 'PUP'].includes(status)
  })
  injured.forEach(r => {
    const name = r.players?.full_name || 'Player'
    const status = r.players?.injury_status
    alerts.push({ type: 'red', icon: '🚨', text: `${name} is ${status}` })
  })

  // Questionable/Doubtful starters only
  const starters = (roster || []).filter(r =>
    (r.roster_slots?.[0]?.slot_type || 'active') === 'active'
  )
  const questionable = starters.filter(r => {
    const status = r.players?.injury_status
    return status && ['Questionable', 'Doubtful', 'Q', 'D'].includes(status)
  })
  questionable.forEach(r => {
    const name = r.players?.full_name || 'Player'
    const status = r.players?.injury_status
    alerts.push({ type: 'gold', icon: '⚠️', text: `${name} is ${status} (starter)` })
  })

  // Bye week starters (regular season only)
  if (!isOffseason && currentWeek) {
    const onBye = starters.filter(r => r.players?.bye_week === currentWeek)
    onBye.forEach(r => {
      const name = r.players?.full_name || 'Player'
      alerts.push({ type: 'gold', icon: '💤', text: `${name} on BYE (starter)` })
    })
  }

  // Pending trades
  if (pendingTrades > 0) {
    alerts.push({
      type: 'orange', icon: '🔄',
      text: `${pendingTrades} trade offer${pendingTrades > 1 ? 's' : ''} need${pendingTrades === 1 ? 's' : ''} your response`,
      link: '/trade?tab=history',
    })
  }

  // Unread messages
  if (unread > 0) {
    alerts.push({
      type: 'blue', icon: '💬',
      text: `${unread} unread message${unread > 1 ? 's' : ''}`,
      link: '/inbox',
    })
  }

  if (!alerts.length) return null

  return (
    <div className="dash-alert-bar">
      {alerts.map((a, i) => (
        <div key={i} className={`dash-alert-pill dash-alert-pill--${a.type}`}>
          <span>{a.icon}</span>
          {a.link
            ? <a href={a.link}>{a.text}</a>
            : <span>{a.text}</span>
          }
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { manager, isAdmin } = useAuth()
  const navigate  = useNavigate()
  const abbrev  = manager?.team_abbrev
  const team    = TEAMS.find(t=>t.abbrev===abbrev)
  const logoSrc = abbrev ? LOGOS[abbrev] : null
  const colors  = useTeamColors(logoSrc)
  const consts  = getSeasonConsts(CURRENT_SEASON)

  const { mode, adminOverride, setAdminOverride, nflMode } = useSeasonMode(isAdmin)
  const { roster, deadCap, sbData, loading } = useTeamData(abbrev)
  const { matchup, mLoading } = useCurrentMatchup(abbrev)

  // Unread count lifted to dashboard level for AlertBar
  const [dashUnread, setDashUnread] = useState(0)

  // Current NFL week for bye-week alerts
  const [currentWeek, setCurrentWeek] = useState(null)
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.nfl?.week) setCurrentWeek(d.nfl.week) })
      .catch(() => {})
  }, [])

  // Pending trades count for alert bar
  const [pendingTrades, setPendingTrades] = useState(0)
  useEffect(() => {
    if (!abbrev) return
    fetch(`${API_BASE}/trades?team=${abbrev}&status=pending`)
      .then(r => r.ok ? r.json() : [])
      .then(trades => {
        // Count trades where I haven't accepted yet
        const count = trades.filter(t => {
          const myTT = t.trade_teams?.find(tt => tt.team_abbrev === abbrev)
          return myTT && !myTT.has_accepted
        }).length
        setPendingTrades(count)
      })
      .catch(() => {})
  }, [abbrev])

  // Standings widget state
  const [standings,      setStandings]      = useState([])
  const [standingsView,  setStandingsView]  = useState('division')
  const [standingsLoaded,setStandingsLoaded]= useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/standings?season=${CURRENT_SEASON}`)
      .then(r => r.ok ? r.json() : { standings: [] })
      .then(d => { setStandings(d.standings || []); setStandingsLoaded(true) })
      .catch(() => setStandingsLoaded(true))
  }, [])

  // Cap calculations
  const totalCapHit = useMemo(()=>{
    const rHit = roster.reduce((s,r)=>{
      const slot = r.roster_slots?.[0]?.slot_type||'active'
      let h = parseFloat(r.salary||0)
      if (slot==='ps'||slot==='ir') h*=0.5
      if (r.is_max_contract) h*=0.8
      return s+h
    },0)
    const dcHit = deadCap.filter(d=>d.season===CURRENT_SEASON).reduce((s,d)=>s+parseFloat(d.amount),0)
    return parseFloat((rHit+dcHit).toFixed(2))
  },[roster,deadCap])

  const capRemaining = parseFloat((consts.hardCap - totalCapHit).toFixed(2))
  const ltlRemaining = parseFloat((consts.ltl - totalCapHit).toFixed(2))
  const capPct = Math.min(100,(totalCapHit/consts.hardCap)*100)
  const isOverCap = totalCapHit > consts.hardCap
  const isLux     = totalCapHit > consts.ltl

  const injured  = roster.filter(r=>r.players?.injury_status&&['Out','IR','PUP','Q','D'].includes(r.players.injury_status))
  const active   = roster.filter(r=>(r.roster_slots?.[0]?.slot_type||'active')==='active')
  const ps       = roster.filter(r=>r.roster_slots?.[0]?.slot_type==='ps')
  const deadCapCurrentSeason = deadCap.filter(d=>d.season===CURRENT_SEASON)

  if (!abbrev) return (
    <div className="dash-no-team">No team assigned — contact the commissioner.</div>
  )

  const cssVars = colors ? {
    '--team-primary':  colors.primary,
    '--team-accent':   colors.accent,
    '--team-dim':      colors.dim,
    '--team-dim-deep': colors.dimDeep,
    '--team-border':   colors.border,
    '--team-text':     colors.text,
  } : {}

  return (
    <div className="dash-root" style={cssVars}>
      {/* Atmospheric background */}
      <div className="dash-atmosphere"
        style={{ background: colors ? `radial-gradient(ellipse 70% 50% at 30% 0%, ${colors.dimDeep} 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 80% 100%, ${colors.dim} 0%, transparent 60%)` : '' }}/>

      {/* ── HERO BAR ── */}
      <div className="dash-hero" style={{ background: colors?.primary || 'var(--bg2)' }}>
        <div className="dash-hero-inner">
          <div className="dash-hero-left">
            {logoSrc && <img src={logoSrc} alt={team?.name} className="dash-logo"/>}
            <div>
              <h1 className="dash-team-name" style={{color:colors?.text}}>{team?.name||abbrev}</h1>
              <p className="dash-manager-name" style={{color:colors?`${colors.text}99`:'var(--text-muted)'}}>
                {manager?.display_name}
              </p>
              <div className="dash-hero-badges">
                <span className="dash-hero-badge" style={{borderColor:colors?.accent,color:colors?.text,background:`${colors?.accent}22`}}>
                  {abbrev}
                </span>
                <span className="dash-hero-badge" style={{borderColor:`${colors?.text}33`,color:colors?.text}}>
                  {CURRENT_SEASON} Season
                </span>
                <span className="dash-hero-badge" style={{
                  borderColor: mode==='regular' ? 'var(--green)' : `${colors?.text}33`,
                  color: mode==='regular' ? 'var(--green)' : colors?.text,
                }}>
                  {mode==='regular' ? '🏈 Regular Season' : '☁ Offseason'}
                </span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="dash-mode-toggle">
              <div className="dash-mode-label" style={{color:`${colors?.text}77`}}>Preview Mode</div>
              <div className="dash-mode-pills">
                {['offseason','regular'].map(m=>(
                  <button key={m} onClick={()=>setAdminOverride(m)}
                    className="dash-mode-pill"
                    style={{
                      background: (adminOverride||nflMode)===m ? (colors?.accent||'var(--orange)') : 'rgba(0,0,0,0.25)',
                      color: (adminOverride||nflMode)===m ? '#000' : colors?.text,
                      border: `1px solid ${(adminOverride||nflMode)===m ? (colors?.accent||'var(--orange)') : `${colors?.text}33`}`,
                    }}>
                    {m==='offseason' ? 'Offseason' : 'Regular Season'}
                  </button>
                ))}
              </div>
              <div className="dash-mode-api" style={{color:`${colors?.text}55`}}>API: {nflMode||'…'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Pending trades */}
      <PendingTradesWidget />

      {/* ── WIDGET CANVAS ── */}
      {loading ? (
        <div className="dash-loading">Loading…</div>
      ) : (
        <div className={`dash-canvas ${mode==='regular'?'dash-canvas--regular':'dash-canvas--offseason'}`}>

          {/* ── OFFSEASON LAYOUT ── */}
          <AlertBar
            roster={roster}
            unread={dashUnread}
            pendingTrades={pendingTrades}
            currentWeek={currentWeek}
            isOffseason={mode === 'offseason'}
          />

          {mode === 'offseason' && (<>

            {/* CAP SUMMARY */}
            <GlassCard className="dash-cap-card" colors={colors}>
              <WidgetLabel colors={colors}>Salary Cap</WidgetLabel>
              <div className="dash-cap-main">
                <div className="dash-cap-number-block">
                  <div className="dash-cap-big">${totalCapHit.toFixed(2)}</div>
                  <div className="dash-cap-sub">of ${consts.hardCap} hard cap</div>
                </div>
                <div className={`dash-cap-status-pill ${isOverCap?'over':isLux?'lux':'ok'}`}>
                  {isOverCap ? '🔴 Over Cap' : isLux ? '⚠ Luxury Tax' : '✓ Under Line'}
                </div>
              </div>
              <div className="dash-cap-track">
                <div className="dash-cap-fill" style={{
                  width:`${capPct.toFixed(1)}%`,
                  background: isOverCap ? 'var(--red)' : isLux ? 'var(--gold)' : colors?.primary||'var(--orange)',
                  boxShadow: `0 0 12px ${isOverCap?'var(--red)':isLux?'var(--gold)':colors?.primary||'var(--orange)'}`,
                }}/>
                <div className="dash-cap-ltl-line" style={{left:`${(consts.ltl/consts.hardCap*100).toFixed(1)}%`}}>
                  <span className="dash-cap-ltl-label">LTL</span>
                </div>
              </div>
              <div className="dash-cap-stats-row">
                <div className="dash-cap-stat">
                  <div className="dash-cap-stat-val" style={{color: capRemaining<5?'var(--red)':colors?.primary||'var(--green)'}}>
                    ${Math.abs(capRemaining).toFixed(2)}
                  </div>
                  <div className="dash-cap-stat-label">{capRemaining<0?'Over Cap':'Cap Space'}</div>
                </div>
                <div className="dash-cap-stat">
                  <div className="dash-cap-stat-val" style={{color:ltlRemaining<0?'var(--red)':'var(--text-muted)'}}>
                    {ltlRemaining<0?'-':''}${Math.abs(ltlRemaining).toFixed(2)}
                  </div>
                  <div className="dash-cap-stat-label">{ltlRemaining<0?'Over LTL':'Under LTL'}</div>
                </div>
                <div className="dash-cap-stat">
                  <div className="dash-cap-stat-val">{roster.length}</div>
                  <div className="dash-cap-stat-label">Rostered</div>
                </div>
                <div className="dash-cap-stat">
                  <Link to={`/team/${abbrev}/cap`} className="dash-cap-link" style={{color:colors?.primary||'var(--orange)'}}>
                    Full Cap Sheet →
                  </Link>
                </div>
              </div>
            </GlassCard>

            {/* SB BUDGET — declining balance view */}
            <GlassCard className="dash-sb-card" colors={colors} accent="var(--green)">
              <WidgetLabel colors={colors}>Signing Bonus Budget</WidgetLabel>
              <div className="dash-sb-big" style={{color:'var(--green)'}}>
                ${sbData?.balance?.toFixed(2)||'—'}
              </div>
              <div className="dash-sb-sub">remaining in {CURRENT_SEASON}</div>
              {sbData?.spent > 0 && (
                <div className="dash-sb-spent">
                  ${sbData.spent.toFixed(2)} spent this season
                </div>
              )}
              {sbData?.nextSeason?.atCurrentSpend && (
                <div className="dash-sb-next">
                  <div className="dash-sb-next-label">{CURRENT_SEASON+1} projection</div>
                  <div className="dash-sb-next-scenarios">
                    {sbData.nextSeason.scenarios?.slice(0,3).map((s,i) => (
                      <div key={i} className="dash-sb-scenario">
                        <span className="dash-sb-scenario-label">{s.label}</span>
                        <span className="dash-sb-scenario-val" style={{color:'var(--green)'}}>
                          ${s.nextSeasonBudget.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* ROSTER OVERVIEW */}
            <GlassCard className="dash-roster-card" colors={colors}>
              <WidgetLabel colors={colors}>Roster ({roster.length})</WidgetLabel>
              <div className="dash-roster-scroll">
                {['QB','RB','WR','TE'].map(pos=>{
                  const players = active.filter(r=>r.players?.position===pos)
                  if (!players.length) return null
                  return (
                    <div key={pos} className="dash-roster-group">
                      <div className="dash-roster-pos" style={{color:POS_COLOR[pos]}}>{pos}</div>
                      {players.map(r=>{
                        const p = r.players||{}
                        return (
                          <Link key={r.id} to={`/player/${p.sleeper_id}`} className="dash-roster-row">
                            <img src={`https://sleepercdn.com/content/nfl/players/thumb/${p.sleeper_id}.jpg`}
                              alt="" className="dash-roster-shot" onError={e=>e.target.style.opacity=0}/>
                            <span className="dash-roster-name">{p.full_name}</span>
                            {p.injury_status && <span className="dash-inj-dot" title={p.injury_status}>●</span>}
                            <span className="dash-roster-sal">${parseFloat(r.salary||0).toFixed(2)}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )
                })}
                {ps.length > 0 && (
                  <div className="dash-roster-group">
                    <div className="dash-roster-pos" style={{color:'var(--blue)'}}>PS ({ps.length})</div>
                    {ps.map(r=>(
                      <Link key={r.id} to={`/player/${r.players?.sleeper_id}`} className="dash-roster-row dash-roster-row--ps">
                        <img src={`https://sleepercdn.com/content/nfl/players/thumb/${r.players?.sleeper_id}.jpg`}
                          alt="" className="dash-roster-shot" onError={e=>e.target.style.opacity=0}/>
                        <span className="dash-roster-name">{r.players?.full_name}</span>
                        <span className="dash-roster-sal">${(parseFloat(r.salary||0)*0.5).toFixed(2)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <Link to={`/team/${abbrev}`} className="dash-widget-footer-link" style={{color:colors?.primary||'var(--orange)'}}>
                Manage Roster →
              </Link>
            </GlassCard>

            {/* INJURIES */}
            {injured.length > 0 && (
              <GlassCard className="dash-injury-card" colors={colors} accent="var(--red)">
                <WidgetLabel colors={colors}>⚠ Injuries ({injured.length})</WidgetLabel>
                {injured.map(r=>(
                  <Link key={r.id} to={`/player/${r.players?.sleeper_id}`} className="dash-inj-row">
                    <img src={`https://sleepercdn.com/content/nfl/players/thumb/${r.players?.sleeper_id}.jpg`}
                      alt="" className="dash-inj-shot" onError={e=>e.target.style.opacity=0}/>
                    <div>
                      <div className="dash-inj-name">{r.players?.full_name}</div>
                      <div className="dash-inj-nfl">{r.players?.nfl_team}</div>
                    </div>
                    <span className={`dash-inj-badge dash-inj-badge--${r.players?.injury_status?.toLowerCase()}`}>
                      {r.players?.injury_status}
                    </span>
                  </Link>
                ))}
              </GlassCard>
            )}

            {/* DEAD CAP */}
            {deadCapCurrentSeason.length > 0 && (
              <GlassCard className="dash-dc-card" colors={colors} accent="var(--red)">
                <WidgetLabel colors={colors}>Dead Cap</WidgetLabel>
                {deadCapCurrentSeason.map(d=>(
                  <div key={d.id} className="dash-dc-row">
                    <span className="dash-dc-name">{d.player_name}</span>
                    <span className="dash-dc-amt">${parseFloat(d.amount).toFixed(2)}</span>
                  </div>
                ))}
                <div className="dash-dc-total">
                  <span>Total</span>
                  <span style={{color:'var(--red)'}}>
                    ${deadCapCurrentSeason.reduce((s,d)=>s+parseFloat(d.amount),0).toFixed(2)}
                  </span>
                </div>
              </GlassCard>
            )}

            {/* STANDINGS WIDGET */}
            <GlassCard className="dash-standings-card" colors={colors}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <WidgetLabel colors={colors}>Standings</WidgetLabel>
                <div style={{display:'flex',gap:4}}>
                  {['division','playoff'].map(v => (
                    <button key={v}
                      onClick={() => setStandingsView(v)}
                      style={{
                        fontFamily:'var(--font-ui)', fontSize:10, fontWeight:700,
                        padding:'3px 10px', border:'1px solid var(--border-bright)',
                        background: standingsView===v ? (colors?.primary||'var(--orange)') : 'transparent',
                        color: standingsView===v ? '#fff' : 'var(--text-muted)',
                        cursor:'pointer', borderRadius:3,
                      }}>
                      {v === 'division' ? 'Division' : 'Playoff'}
                    </button>
                  ))}
                </div>
              </div>
              <StandingsWidget
                standings={standings}
                myAbbrev={abbrev}
                view={standingsView}
                setView={setStandingsView}
                loaded={standingsLoaded}
                colors={colors}
              />
              <Link to="/standings" className="dash-widget-footer-link" style={{color:colors?.primary||'var(--orange)'}}>
                Full Standings →
              </Link>
            </GlassCard>

            {/* DRAFT COUNTDOWN */}
            <GlassCard className="dash-draft-card" colors={colors}>
              <WidgetLabel colors={colors}>Rookie Draft</WidgetLabel>
              <div className="dash-draft-year">{CURRENT_SEASON}</div>
              <div className="dash-draft-sub">Approaching — Mid-July</div>
              <Link to="/draft" className="dash-draft-cta" style={{
                borderColor: colors?.primary||'var(--orange)',
                color: colors?.primary||'var(--orange)',
              }}>Draft Board →</Link>
            </GlassCard>

            {/* STANDINGS WIDGET */}


            {/* NEWS TICKER */}
            <GlassCard className="dash-news-card" colors={colors}>
              <WidgetLabel colors={colors}>League News</WidgetLabel>
              <NewsTickerWidget limit={6} />
            </GlassCard>

            {/* INBOX */}
            <InboxWidget abbrev={abbrev} colors={colors} navigate={navigate} onUnreadCount={setDashUnread}/>

            {/* CALENDAR */}
            <GlassCard className="dash-cal-card" colors={colors}>
              <CalendarWidget colors={colors}/>
            </GlassCard>

            {/* TRADE BLOCK */}
            <GlassCard className="dash-tb-card" colors={colors}>
              <TradeBlockWidget colors={colors}/>
            </GlassCard>

          </>)}

          {/* ── REGULAR SEASON LAYOUT ── */}
          {mode === 'regular' && (<>

            {/* LIVE MATCHUP WIDGET */}
            <MatchupWidget matchup={matchup} mLoading={mLoading} abbrev={abbrev} colors={colors} />

            {/* CAP SUMMARY compact */}
            <GlassCard className="dash-cap-compact" colors={colors}>
              <WidgetLabel colors={colors}>Cap</WidgetLabel>
              <div className="dash-cap-compact-num" style={{color:isOverCap?'var(--red)':colors?.primary||'var(--orange)'}}>
                ${capRemaining.toFixed(2)}
              </div>
              <div className="dash-cap-compact-label">remaining</div>
              <div className="dash-cap-track" style={{margin:'10px 0'}}>
                <div className="dash-cap-fill" style={{
                  width:`${capPct.toFixed(1)}%`,
                  background:isOverCap?'var(--red)':colors?.primary||'var(--orange)',
                }}/>
              </div>
              <Link to={`/team/${abbrev}/cap`} className="dash-widget-footer-link" style={{color:colors?.primary||'var(--orange)'}}>
                Cap Sheet →
              </Link>
            </GlassCard>

            {/* LINEUP */}
            <GlassCard className="dash-lineup-card" colors={colors}>
              <WidgetLabel colors={colors}>Active Lineup ({active.length})</WidgetLabel>
              <div className="dash-roster-scroll">
                {active.slice(0,10).map(r=>{
                  const p = r.players||{}
                  return (
                    <Link key={r.id} to={`/player/${p.sleeper_id}`} className="dash-roster-row">
                      <span style={{color:POS_COLOR[p.position],fontSize:10,fontWeight:800,width:22}}>{p.position}</span>
                      <img src={`https://sleepercdn.com/content/nfl/players/thumb/${p.sleeper_id}.jpg`}
                        alt="" className="dash-roster-shot" onError={e=>e.target.style.opacity=0}/>
                      <span className="dash-roster-name">{p.full_name}</span>
                      {p.injury_status && <span className="dash-inj-dot" style={{color:'var(--red)'}} title={p.injury_status}>●</span>}
                      <span className="dash-roster-sal">${parseFloat(r.salary||0).toFixed(2)}</span>
                    </Link>
                  )
                })}
              </div>
              <Link to={`/team/${abbrev}`} className="dash-widget-footer-link" style={{color:colors?.primary||'var(--orange)'}}>
                Full Roster →
              </Link>
            </GlassCard>

            {/* INJURIES */}
            {injured.length > 0 ? (
              <GlassCard className="dash-injury-card" colors={colors} accent="var(--red)">
                <WidgetLabel colors={colors}>⚠ Injuries ({injured.length})</WidgetLabel>
                {injured.map(r=>(
                  <Link key={r.id} to={`/player/${r.players?.sleeper_id}`} className="dash-inj-row">
                    <img src={`https://sleepercdn.com/content/nfl/players/thumb/${r.players?.sleeper_id}.jpg`}
                      alt="" className="dash-inj-shot" onError={e=>e.target.style.opacity=0}/>
                    <div>
                      <div className="dash-inj-name">{r.players?.full_name}</div>
                      <div className="dash-inj-nfl">{r.players?.nfl_team}</div>
                    </div>
                    <span className={`dash-inj-badge dash-inj-badge--${r.players?.injury_status?.toLowerCase()}`}>
                      {r.players?.injury_status}
                    </span>
                  </Link>
                ))}
              </GlassCard>
            ) : (
              <GlassCard className="dash-injury-card" colors={colors} accent="var(--green)">
                <WidgetLabel colors={colors}>Injuries</WidgetLabel>
                <div className="dash-all-clear">✓ All Clear</div>
                <div className="dash-all-clear-sub">No injury flags on your roster</div>
              </GlassCard>
            )}

            {/* SB BUDGET — declining balance, compact */}
            <GlassCard className="dash-sb-card" colors={colors} accent="var(--green)">
              <WidgetLabel colors={colors}>Signing Bonus</WidgetLabel>
              <div className="dash-sb-big" style={{color:'var(--green)'}}>
                ${sbData?.balance?.toFixed(2)||'—'}
              </div>
              <div className="dash-sb-sub" style={{marginTop:4}}>remaining · {CURRENT_SEASON}</div>
              {sbData?.nextSeason?.atCurrentSpend?.total && (
                <div className="dash-sb-proj" style={{marginTop:8}}>
                  Keep pace → <strong style={{color:'var(--green)'}}>
                    ${sbData.nextSeason.atCurrentSpend.total.toFixed(2)}
                  </strong> in {CURRENT_SEASON+1}
                </div>
              )}
            </GlassCard>

            {/* STANDINGS WIDGET */}
            <GlassCard className="dash-standings-card" colors={colors}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <WidgetLabel colors={colors}>Standings</WidgetLabel>
                <div style={{display:'flex',gap:4}}>
                  {['division','playoff'].map(v => (
                    <button key={v}
                      onClick={() => setStandingsView(v)}
                      style={{
                        fontFamily:'var(--font-ui)', fontSize:10, fontWeight:700,
                        padding:'3px 10px', border:'1px solid var(--border-bright)',
                        background: standingsView===v ? (colors?.primary||'var(--orange)') : 'transparent',
                        color: standingsView===v ? '#fff' : 'var(--text-muted)',
                        cursor:'pointer', borderRadius:3,
                      }}>
                      {v === 'division' ? 'Division' : 'Playoff'}
                    </button>
                  ))}
                </div>
              </div>
              <StandingsWidget
                standings={standings}
                myAbbrev={abbrev}
                view={standingsView}
                setView={setStandingsView}
                loaded={standingsLoaded}
                colors={colors}
              />
              <Link to="/standings" className="dash-widget-footer-link" style={{color:colors?.primary||'var(--orange)'}}>
                Full Standings →
              </Link>
            </GlassCard>

            {/* NEWS TICKER */}
            <GlassCard className="dash-news-card" colors={colors}>
              <WidgetLabel colors={colors}>League News</WidgetLabel>
              <NewsTickerWidget limit={6} />
            </GlassCard>

            {/* INBOX */}
            <InboxWidget abbrev={abbrev} colors={colors} navigate={navigate} onUnreadCount={setDashUnread}/>

            {/* CALENDAR */}
            <GlassCard className="dash-cal-card" colors={colors}>
              <CalendarWidget colors={colors}/>
            </GlassCard>

            {/* TRADE BLOCK */}
            <GlassCard className="dash-tb-card" colors={colors}>
              <TradeBlockWidget colors={colors}/>
            </GlassCard>

          </>)}

          {/* ── SHORTCUTS ROW (both modes) ── */}
          <div className="dash-shortcuts-row">
            <Shortcut to="/trade"               emoji="🔄" label="Trade"       colors={colors}/>
            <Shortcut to="/free-agents"         emoji="🆓" label="Free Agents" colors={colors}/>
            <Shortcut to="/draft"               emoji="🏈" label="Draft"       colors={colors}/>
            <Shortcut to={`/team/${abbrev}/cap`} emoji="💰" label="Cap Sheet"  colors={colors}/>
            <Shortcut to="/players"             emoji="👤" label="Players"     colors={colors}/>
            <Shortcut to="/standings"           emoji="🏆" label="Standings"   colors={colors}/>
            <Shortcut to="/scoreboard"          emoji="📊" label="Scores"      colors={colors}/>
            <Shortcut to="/rules"               emoji="📋" label="Rules"       colors={colors}/>
          </div>

        </div>
      )}
    </div>
  )
}