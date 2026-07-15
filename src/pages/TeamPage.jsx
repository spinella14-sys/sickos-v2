import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { TEAMS, LOGOS, CAP } from '../data/league'
import { useTeamColors } from '../hooks/useTeamColors'
import PendingTradesWidget from '../components/PendingTradesWidget'
import { useAuth } from '../context/AuthContext'
import { headshotUrl, nflTeamLogoUrl } from '../hooks/useSleeper'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import DefenseRankBadge, { OppRankCell } from '../components/DefenseRankBadge'
import { normalizeTeamAbbrev } from '../utils/defenseRankUtils'
import NewsCard from '../components/NewsCard'
import './TeamPage.css'
import '../components/DefenseRankBadge.css'
import '../components/NewsCard.css'

const API_BASE        = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const CURRENT_SEASON  = 2026
const TAX_LINE        = 120
const PS_SALARY_LIMIT = 20

const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843', K:'#8a9bb0' }

// ── Transactions tab description builder (new schema has no flat description) ──
function describeTeamPageTx(t) {
  const assets = t.assets || []
  const first = assets[0]
  const name = first?.player?.full_name || first?.player_id || 'player'
  if (t.type === 'signing') {
    const years = first?.contract_years ? Object.keys(first.contract_years).length : null
    const total = first?.contract_years
      ? Object.values(first.contract_years).reduce((s,y)=>s+(parseFloat(y.salary)||0),0)
      : null
    return `Signed ${name}${years ? ` · ${years}yr / $${total.toFixed(2)}` : ''}`
  }
  if (t.type === 'release') return `Released ${name}`
  if (t.type === 'bid_lost') return `Lost bid on ${name}`
  if (t.type === 'trade') {
    const names = assets.filter(a=>a.player).map(a=>a.player?.full_name||a.player_id)
    return names.length ? `Trade: ${names.join(', ')}` : 'Trade'
  }
  if (t.type === 'draft_batch') return t.notes || 'Draft results'
  return (t.type||'').replace(/_/g,' ')
}
const INJ_COLOR = { Q:'#d4a843', D:'#d94f4f', O:'#d94f4f', IR:'#d94f4f', PUP:'#d94f4f' }

const LINEUP_SLOTS = [
  { key:'QB',   eligible:['QB'],           label:'QB'   },
  { key:'RB1',  eligible:['RB'],           label:'RB'   },
  { key:'RB2',  eligible:['RB'],           label:'RB'   },
  { key:'WR1',  eligible:['WR'],           label:'WR'   },
  { key:'WR2',  eligible:['WR'],           label:'WR'   },
  { key:'WR3',  eligible:['WR'],           label:'WR'   },
  { key:'TE',   eligible:['TE'],           label:'TE'   },
  { key:'FLEX', eligible:['RB','WR','TE'], label:'FLEX' },
]
const BENCH_SLOTS = 5

function keyToSlotType(key) { return key.replace(/\d+$/, '') }

function buildLineupAssign(weeklyLineup, roster) {
  const assign = {}
  const counts = {}
  const STARTING = new Set(['QB','RB','WR','TE','FLEX'])
  for (const row of (weeklyLineup || [])) {
    const type = row.slot_type
    if (!STARTING.has(type)) continue
    const contract = roster.find(r => (r.players?.sleeper_id || r.sleeper_id) === row.sleeper_id)
    if (!contract) continue
    const cid = contract.id || contract.sleeper_id
    counts[type] = (counts[type] || 0) + 1
    const key = (type === 'QB' || type === 'TE' || type === 'FLEX') ? type : `${type}${counts[type]}`
    assign[key] = cid
  }
  return assign
}

function InjuryBadge({ status, onClick }) {
  if (!status) return null
  const labels = { Q:'Q', D:'D', O:'OUT', IR:'IR', PUP:'PUP' }
  return (
    <span onClick={onClick} title={onClick ? 'Click for injury history' : undefined} style={{
      fontFamily:'var(--font-ui)', fontSize:9, fontWeight:800, letterSpacing:'0.1em',
      padding:'2px 5px', border:`1px solid ${INJ_COLOR[status]||'#888'}`,
      color:INJ_COLOR[status]||'#888', background:`${INJ_COLOR[status]||'#888'}18`,
      borderRadius:2, textTransform:'uppercase', flexShrink:0, display:'inline-block',
      cursor: onClick ? 'pointer' : 'default',
    }}>{labels[status]||status}</span>
  )
}

function NewsIcon({ onClick }) {
  return (
    <span className="rtr-news-icon" onClick={onClick} title="Recent transaction news">📰</span>
  )
}

function CapBar({ capUsed, hardCap, taxLine }) {
  const pct    = Math.min(100, (capUsed / hardCap) * 100)
  const luxPct = (taxLine / hardCap) * 100
  const isLux  = capUsed > taxLine
  return (
    <div className="tp-cap-bar">
      <div className="tp-cap-track">
        <div className={`tp-cap-fill ${isLux ? 'fill-gold' : 'fill-ok'}`} style={{ width:`${pct}%` }}/>
        <div className="tp-cap-lux-line" style={{ left:`${luxPct}%` }}/>
      </div>
      <div className="tp-cap-meta">
        <span className="tp-cap-pct">{pct.toFixed(1)}% of cap used</span>
        <span className={isLux ? 'tp-cap-over' : 'tp-cap-under'}>
          {isLux ? `$${(capUsed-taxLine).toFixed(2)} over tax` : `$${(taxLine-capUsed).toFixed(2)} under tax`}
        </span>
      </div>
    </div>
  )
}

// Multi-year cap bars (shown at top of cap view)
function CapYearBars({ roster, hardCap, taxLine }) {
  const data = useMemo(() => {
    const totals = {}
    roster.forEach(r => {
      const slot = r.roster_slots?.[0]?.slot_type || 'active'
      // cap_hit already has the max-contract 80% discount baked in at the DB level —
      // only the PS/IR slot discount needs to be applied here, or it gets double-counted.
      const disc = (slot === 'ps' || slot === 'ir') ? 0.5 : 1
      ;(r.contract_years || []).forEach(cy => {
        const y = cy.season
        totals[y] = (totals[y] || 0) + parseFloat(cy.cap_hit || cy.salary || 0) * disc
      })
    })
    return Object.entries(totals).sort(([a],[b]) => a - b)
  }, [roster])

  if (!data.length) return null

  return (
    <div className="tp-year-bars">
      {data.map(([year, total]) => {
        const pct    = Math.min(100, (total / hardCap) * 100)
        const isOver = total > hardCap
        const isLux  = total > taxLine
        return (
          <div key={year} className="tp-yb-col">
            <div className="tp-yb-label">{year}</div>
            <div className="tp-yb-track">
              <div
                className={`tp-yb-fill ${isOver ? 'yb-over' : isLux ? 'yb-lux' : 'yb-ok'}`}
                style={{ height:`${pct}%` }}
              />
              <div className="tp-yb-tax-line" style={{ bottom:`${(taxLine/hardCap)*100}%` }}/>
            </div>
            <div className={`tp-yb-total ${isOver ? 'tp-red' : isLux ? 'tp-gold' : ''}`}>
              ${total.toFixed(0)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MoveDropdown({ contract, lineupAssign, onMove, currentSlotOverride, activeRoster, psRoster, isLocked }) {
  const p          = contract.players || {}
  const pos        = p.position
  const contractId = contract.id || contract.sleeper_id
  const dbSlot     = contract.roster_slots?.[0]?.slot_type || 'active'
  const effectiveSlot = currentSlotOverride || dbSlot
  const isInLineup = Object.values(lineupAssign).includes(contractId)
  const isOnPS     = effectiveSlot === 'ps'
  const isOnIR     = effectiveSlot === 'ir'

  const activeQBs = (activeRoster || []).filter(r =>
    r.players?.position === 'QB' && (r.id || r.sleeper_id) !== contractId
  ).length

  const opts = []

  if (isOnPS || isOnIR) {
    const canActivate = pos !== 'QB' || activeQBs < 2
    opts.push({ value:'bench', label:'← Move to Active Roster', disabled: !canActivate })
    if (canActivate) {
      for (const slot of LINEUP_SLOTS) {
        if (!slot.eligible.includes(pos)) continue
        const occupant = lineupAssign[slot.key]
        opts.push({ value:`lineup:${slot.key}`, label: occupant ? `↕ Start at ${slot.label} (swap)` : `↑ Start at ${slot.label}` })
      }
    }
  } else {
    // Active player
    for (const slot of LINEUP_SLOTS) {
      if (!slot.eligible.includes(pos)) continue
      const occupant      = lineupAssign[slot.key]
      const isCurrent     = occupant === contractId
      opts.push({
        value: `lineup:${slot.key}`,
        label: isCurrent ? `★ ${slot.label} (starting)` : occupant ? `↕ ${slot.label} (swap)` : `↑ ${slot.label} (empty)`,
        disabled: isLocked,
      })
    }
    if (isInLineup) opts.push({ value:'bench', label:'↓ Move to Bench', disabled: isLocked })
    const psQBs = (psRoster || []).filter(r => r.players?.position === 'QB').length
    opts.push({ value:'ps', label:'→ Practice Squad', disabled: pos === 'QB' && psQBs >= 1 })
  }

  if (['Out','IR','PUP'].includes(p.injury_status) && !isOnIR) {
    opts.push({ value:'ir', label:'🏥 Move to IR' })
  } else if (isOnIR) {
    opts.push({ value:'bench', label:'← Activate from IR', disabled: pos === 'QB' && activeQBs >= 2 })
  }

  const currentLabel = isInLineup
    ? (LINEUP_SLOTS.find(s => lineupAssign[s.key] === contractId)?.label || 'Lineup')
    : isOnPS ? 'PS' : isOnIR ? 'IR' : 'Bench'

  return (
    <select className="rtr-move-select" value=""
      onChange={e => { if (e.target.value && !e.target.options[e.target.selectedIndex].disabled) onMove(contractId, e.target.value) }}>
      <option value="" disabled>{currentLabel} ▾</option>
      {opts.map(o => (
        <option key={o.value} value={o.value} disabled={!!o.disabled}>{o.label}</option>
      ))}
    </select>
  )
}

function PlayerRow({ contract, slotLabel, slotColor, lineupAssign, onMove, slotOverride,
  playerStats, isLineupSlot, activeRoster, psRoster, isLocked, canEdit, opponents, defRankings, transNewsIds, onShowNews }) {
  const p    = contract.players || {}
  const sid  = p.sleeper_id || contract.sleeper_id
  const sal  = parseFloat(contract.salary || 0)
  const slot = slotOverride || contract.roster_slots?.[0]?.slot_type || 'active'
  const disc = (slot === 'ps' || slot === 'ir') ? 0.5 : contract.is_max_contract ? 0.8 : 1
  const capHit = sal * disc
  const ps   = playerStats || {}
  const isPending = !!slotOverride

  return (
    <tr className={`rtr ${isPending ? 'rtr--pending' : ''} ${isLineupSlot ? 'rtr--lineup' : ''} ${isLocked ? 'rtr--locked' : ''}`}>
      <td className="rtr-slot">
        <span className="rtr-slot-label" style={{ borderLeftColor: slotColor || POS_COLOR[p.position] || 'var(--border)' }}>
          {slotLabel}{isLocked && <span className="rtr-lock" title="Locked">🔒</span>}
        </span>
      </td>
      <td className="rtr-player">
        <div className="rtr-player-link">
          <div className="rtr-img-wrap">
            <img src={headshotUrl(sid)} alt={p.full_name} className="rtr-headshot" onError={e => e.target.style.opacity = 0}/>
            {p.nfl_team && <img src={nflTeamLogoUrl(p.nfl_team)} alt={p.nfl_team} className="rtr-nfl-sm" onError={e => e.target.style.display = 'none'}/>}
          </div>
          <div className="rtr-pinfo">
            <div className="rtr-pname-row">
              <PlayerLink playerId={sid} className="rtr-pname">{p.full_name || '—'}</PlayerLink>
              {p.injury_status && (
                <InjuryBadge status={p.injury_status} onClick={() => onShowNews && onShowNews(sid, p.full_name, 'health')}/>
              )}
              {transNewsIds && transNewsIds.has(sid) && (
                <NewsIcon onClick={() => onShowNews && onShowNews(sid, p.full_name, 'transaction')}/>
              )}
              {isPending && <span style={{ fontFamily:'var(--font-ui)', fontSize:9, color:'var(--orange)', marginLeft:4 }}>PENDING</span>}
            </div>
            <div className="rtr-pmeta">
              <span className="rtr-pos" style={{ color: POS_COLOR[p.position] }}>{p.position}</span>
              <span className="rtr-nfl">{p.nfl_team || 'FA'}</span>
            </div>
          </div>
        </div>
      </td>
      {canEdit && (
        <td className="rtr-action">
          <MoveDropdown contract={contract} lineupAssign={lineupAssign} onMove={onMove}
            currentSlotOverride={slotOverride} activeRoster={activeRoster}
            psRoster={psRoster} isLocked={isLocked}/>
        </td>
      )}
      <td className="rtr-stat">{p.age || '—'}</td>
      <td className="rtr-stat">{p.bye_week || '—'}</td>
      <td className="rtr-stat rtr-rank">{ps.posRank || '—'}</td>
      <td className="rtr-stat rtr-fpts">{ps.fpts != null ? ps.fpts : '—'}</td>
      <td className="rtr-stat">{ps.avg != null ? ps.avg : '—'}</td>
      <td className="rtr-stat rtr-proj">—</td>
      <td className="rtr-stat">{p.search_rank ? `${Math.max(0,(100-p.search_rank/100)).toFixed(0)}%` : '—'}</td>
      <td className="rtr-stat rtr-opp">
        <DefenseRankBadge
          opponent={opponents?.[normalizeTeamAbbrev(p.nfl_team)]?.opponent}
          isBye={!!opponents?.[normalizeTeamAbbrev(p.nfl_team)] && opponents[normalizeTeamAbbrev(p.nfl_team)].opponent === null}
          rankings={defRankings}
        />
      </td>
      <td className="rtr-stat">
        <OppRankCell
          opponent={opponents?.[normalizeTeamAbbrev(p.nfl_team)]?.opponent}
          position={p.position}
          rankings={defRankings}
        />
      </td>
      <td className="rtr-salary">
        <span className="rtr-sal">${sal.toFixed(2)}</span>
        {disc < 1 && <span className="rtr-hit">${capHit.toFixed(2)} cap</span>}
      </td>
      <td className="rtr-contract">{contract.years}yr</td>
    </tr>
  )
}

function EmptySlotRow({ slot, canEdit }) {
  const extraCols = canEdit ? 10 : 9
  return (
    <tr className="rtr rtr--empty">
      <td className="rtr-slot">
        <span className="rtr-slot-label" style={{ borderLeftColor:'var(--border)', color:'var(--text-muted)' }}>
          {slot.label}
        </span>
      </td>
      <td className="rtr-player">
        <div className="rtr-empty-cell">
          <div className="rtr-empty-avatar"/>
          <span className="rtr-empty-text">Empty — move a {slot.eligible.join('/')} here</span>
        </div>
      </td>
      <td colSpan={extraCols}/>
    </tr>
  )
}

export default function TeamPage() {
  const { abbrev }         = useParams()
  const navigate = useNavigate()
  const { manager, isAdmin } = useAuth()
  const team   = TEAMS.find(t => t.abbrev === abbrev?.toUpperCase())
  const colors = useTeamColors(LOGOS[abbrev?.toUpperCase()])

  const [teamData,        setTeamData]        = useState(null)
  const [roster,          setRoster]          = useState([])
  const [weeklyLineup,    setWeeklyLineup]    = useState([])
  const [savedLineupAssign, setSavedLineupAssign] = useState({})
  const [lineupAssign,    setLineupAssign]    = useState({})
  const [slotOverrides,   setSlotOverrides]   = useState({}) // contractId → new slot type
  const [currentWeek,     setCurrentWeek]     = useState(1)
  const [opponents,       setOpponents]       = useState({})
  const [defRankings,     setDefRankings]     = useState(null)
  const [schedSeason,     setSchedSeason]     = useState(null)
  const [transNewsIds,    setTransNewsIds]    = useState(new Set())
  const [newsModal,       setNewsModal]       = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/news/transactions-active?days=14`)
      .then(r => r.ok ? r.json() : [])
      .then(ids => setTransNewsIds(new Set(ids)))
      .catch(() => {})
  }, [])

  function showNews(sleeperId, name, tab) {
    setNewsModal({ sleeperId, name, tab })
  }

  useEffect(() => {
    // FIX: Sleeper's state API returns season:2025 during the offseason (the
    // last completed NFL season). Our nfl_schedule table has 2026 data, so we
    // always use CURRENT_SEASON for schedule lookups regardless of what Sleeper
    // returns. The week from Sleeper is still used (defaults to 1 if missing).
    fetch(`${API_BASE}/schedule/current-week`)
      .then(r => r.ok ? r.json() : { week: 1 })
      .then(({ week }) => {
        const safeWeek = week || 1
        setSchedSeason(CURRENT_SEASON)
        setCurrentWeek(safeWeek)
        fetch(`${API_BASE}/schedule/opponents?season=${CURRENT_SEASON}&week=${safeWeek}`)
          .then(r => r.ok ? r.json() : {})
          .then(setOpponents)
          .catch(() => {})
        fetch(`${API_BASE}/schedule/defense-rankings?season=${CURRENT_SEASON}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => setDefRankings(d?.rankings || null))
          .catch(() => {})
      })
      .catch(() => {})
  }, [])
  const [stats,           setStats]           = useState({})
  const [record,          setRecord]          = useState({ wins: 0, losses: 0 })
  const [loading,         setLoading]         = useState(true)
  const [activeTab,       setActiveTab]       = useState('roster')
  // Stats tab
  const [statsSeason,     setStatsSeason]     = useState(CURRENT_SEASON)
  const [teamStatsMap,    setTeamStatsMap]    = useState({})
  const [statsLoading,    setStatsLoading]    = useState(false)
  const [statsSortKey,    setStatsSortKey]    = useState('pts_pg')
  const [statsSortDir,    setStatsSortDir]    = useState('desc')
  const [statsPosFilter,  setStatsPosFilter]  = useState('ALL')
  // Draft Picks tab
  const [ownedPicks,      setOwnedPicks]      = useState([])
  const [pickHistory,     setPickHistory]     = useState([])
  const [historyNames,    setHistoryNames]    = useState({})
  const [picksLoading,    setPicksLoading]    = useState(false)
  // Transactions tab
  const [txSeason,        setTxSeason]        = useState(String(CURRENT_SEASON))
  const [transactions,    setTransactions]    = useState([])
  const [txLoading,       setTxLoading]       = useState(false)
  // Schedule tab
  const [teamMatchups,    setTeamMatchups]    = useState([])
  const [schedTabLoading, setSchedTabLoading] = useState(false)

  // ── Stats tab fetch ── (reuses the same leaderboard endpoint as Free Agents)
  useEffect(() => {
    if (activeTab !== 'stats' || !abbrev) return
    setStatsLoading(true)
    const rosterIds = new Set(roster.map(r => r.players?.sleeper_id || r.sleeper_id))
    Promise.all([
      fetch(`${API_BASE}/stats/leaderboard?position=QB&season=${statsSeason}&window=season&min_games=0`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/stats/leaderboard?position=FLEX&season=${statsSeason}&window=season&min_games=0`).then(r => r.ok ? r.json() : []),
    ]).then(([qbRes, flexRes]) => {
      const all = [...(Array.isArray(qbRes) ? qbRes : []), ...(Array.isArray(flexRes) ? flexRes : [])]
      const byPos = {}
      all.forEach(p => { if (!byPos[p.position]) byPos[p.position] = []; byPos[p.position].push(p) })
      Object.values(byPos).forEach(g => g.sort((a, b) => b.pts_pg - a.pts_pg))
      const map = {}
      Object.entries(byPos).forEach(([pos, group]) => {
        group.forEach((p, i) => {
          if (rosterIds.has(p.sleeper_id)) map[p.sleeper_id] = { ...p, pos_rank: i + 1 }
        })
      })
      setTeamStatsMap(map)
      setStatsLoading(false)
    }).catch(() => setStatsLoading(false))
  }, [activeTab, abbrev, statsSeason, roster])

  // ── Draft Picks tab fetch ──
  useEffect(() => {
    if (activeTab !== 'picks' || !abbrev) return
    setPicksLoading(true)
    Promise.all([
      fetch(`${API_BASE}/draft-picks?team=${abbrev.toUpperCase()}`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/draft-picks/history?team=${abbrev.toUpperCase()}`).then(r => r.ok ? r.json() : []),
    ]).then(([owned, history]) => {
      setOwnedPicks(owned || [])
      setPickHistory(history || [])
      // Resolve player names for historical picks (small bounded list)
      const ids = [...new Set((history || []).map(h => h.used_on_player).filter(Boolean))]
      if (ids.length) {
        Promise.all(ids.map(id =>
          fetch(`${API_BASE}/players/${id}`).then(r => r.ok ? r.json() : null).catch(() => null)
        )).then(results => {
          const names = {}
          results.forEach((r, i) => { if (r) names[ids[i]] = (r.player || r)?.full_name })
          setHistoryNames(names)
        })
      }
      setPicksLoading(false)
    }).catch(() => setPicksLoading(false))
  }, [activeTab, abbrev])

  // ── Schedule tab fetch ──
  useEffect(() => {
    if (activeTab !== 'schedule' || !abbrev) return
    setSchedTabLoading(true)
    fetch(`${API_BASE}/matchups?season=${CURRENT_SEASON}&team=${abbrev.toUpperCase()}&sort=asc`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setTeamMatchups(Array.isArray(data) ? data : []); setSchedTabLoading(false) })
      .catch(() => setSchedTabLoading(false))
  }, [activeTab, abbrev])

    // ── Schedule tab fetch ──
  useEffect(() => {
    if (activeTab !== 'schedule' || !abbrev) return
    setSchedTabLoading(true)
    fetch(`${API_BASE}/matchups?season=${CURRENT_SEASON}&team=${abbrev.toUpperCase()}&sort=asc`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setTeamMatchups(Array.isArray(data) ? data : []); setSchedTabLoading(false) })
      .catch(() => setSchedTabLoading(false))
  }, [activeTab, abbrev])

    // ── Transactions tab fetch ──
  useEffect(() => {
    if (activeTab !== 'transactions' || !abbrev) return
    setTxLoading(true)
    fetch(`${API_BASE}/transactions?team=${abbrev.toUpperCase()}&season=${txSeason}&limit=200`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setTransactions(data || []); setTxLoading(false) })
      .catch(() => setTxLoading(false))
  }, [activeTab, abbrev, txSeason])
  const [saving,          setSaving]          = useState(false)
  const [saveMsg,         setSaveMsg]         = useState('')
  const [sbBalance,       setSbBalance]       = useState(null)

  const canEdit   = isAdmin || manager?.team_abbrev === abbrev?.toUpperCase()
  const EXTRA_COL = canEdit ? 1 : 0  // the MOVE column

  // ── Fetch record from standings ────────────────────────────────────────
  useEffect(() => {
    if (!abbrev) return
    fetch(`${API_BASE}/standings`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const entry = (Array.isArray(data) ? data : data.standings || [])
          .find(s => s.abbrev === abbrev.toUpperCase())
        if (entry) setRecord({ wins: entry.wins || 0, losses: entry.losses || 0 })
      })
      .catch(() => {})
  }, [abbrev])

  // ── Fetch current week ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/lineup/meta/current-week`)
      .then(r => r.ok ? r.json() : { week: 1 })
      .then(d => setCurrentWeek(d.week || 1))
      .catch(() => {})
  }, [])

  // ── Fetch team + roster ────────────────────────────────────────────────
  const loadTeam = useCallback(() => {
    if (!abbrev) return
    setLoading(true)
    fetch(`${API_BASE}/bids/sb-balances?season=${CURRENT_SEASON}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setSbBalance(d[abbrev.toUpperCase()] ?? null))
      .catch(() => {})
    fetch(`${API_BASE}/teams/${abbrev.toUpperCase()}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        setTeamData(data)
        setRoster(data.roster || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [abbrev])

  useEffect(() => { loadTeam() }, [loadTeam])

  // ── Fetch weekly lineup ────────────────────────────────────────────────
  useEffect(() => {
    if (!abbrev || !currentWeek || !roster.length) return
    fetch(`${API_BASE}/lineup/${abbrev.toUpperCase()}?season=${CURRENT_SEASON}&week=${currentWeek}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setWeeklyLineup(Array.isArray(data) ? data : []) })
      .catch(() => {})
  }, [abbrev, currentWeek, roster.length])

  // ── Build lineup from DB data (or auto-assign fallback) ────────────────
  useEffect(() => {
    if (!roster.length) return
    let assign = {}
    if (weeklyLineup.length) {
      assign = buildLineupAssign(weeklyLineup, roster)
    } else {
      const active = roster.filter(r => (r.roster_slots?.[0]?.slot_type || 'active') === 'active')
      const used   = new Set()
      for (const slot of LINEUP_SLOTS) {
        const eligible = active.filter(r => slot.eligible.includes(r.players?.position) && !used.has(r.id || r.sleeper_id))
        if (eligible.length) {
          const cid = eligible[0].id || eligible[0].sleeper_id
          assign[slot.key] = cid
          used.add(cid)
        }
      }
    }
    setSavedLineupAssign(assign)
    setLineupAssign(assign)
    setSlotOverrides({})
  }, [weeklyLineup, roster])

  // ── Stats ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roster.length) return
    const ids = roster.map(r => r.players?.sleeper_id || r.sleeper_id).filter(Boolean)
    Promise.all([
      ...ids.map(id =>
        fetch(`${API_BASE}/players/${id}/weekly?season=${CURRENT_SEASON}`)
          .then(r => r.ok ? r.json() : []).catch(() => [])
      ),
      fetch(`${API_BASE}/stats/leaderboard?position=QB&season=${CURRENT_SEASON}&window=season&min_games=0`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_BASE}/stats/leaderboard?position=FLEX&season=${CURRENT_SEASON}&window=season&min_games=0`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(results => {
      const weeklyResults = results.slice(0, ids.length)
      const qbBoard       = results[ids.length]   || []
      const flexBoard     = results[ids.length+1] || []
      const rankMap = {}
      qbBoard.forEach((p,i) => { rankMap[p.sleeper_id] = `QB${i+1}` })
      const byPos = {}
      flexBoard.forEach(p => { if (!byPos[p.position]) byPos[p.position] = []; byPos[p.position].push(p) })
      Object.entries(byPos).forEach(([pos,players]) => { players.forEach((p,i) => { rankMap[p.sleeper_id] = `${pos}${i+1}` }) })
      const map = {}
      ids.forEach((id,i) => {
        const weeks = weeklyResults[i] || []
        const total = weeks.reduce((s,w) => s + (w.fantasy_pts||0), 0)
        const games = weeks.filter(w => w.week > 0).length || 0
        map[id] = { fpts: parseFloat(total.toFixed(1)), avg: games ? parseFloat((total/games).toFixed(1)) : 0, posRank: rankMap[id] || '—' }
      })
      setStats(map)
    })
  }, [roster])

  // ── Derived state ──────────────────────────────────────────────────────
  const capUsed       = teamData?.cap_used       ?? 0
  const capSpace      = teamData?.cap_space      ?? 0
  const hardCap       = teamData?.hard_cap       ?? CAP.hardCap
  const isLux         = teamData?.over_tax       ?? false
  const isOver        = teamData?.over_cap       ?? false
  const psSalaryUsed  = teamData?.ps_salary_used ?? 0
  const psSalaryOver  = teamData?.ps_salary_over ?? false

  const activeRoster  = roster.filter(r => (r.roster_slots?.[0]?.slot_type||'active') === 'active')
  const psRoster      = roster.filter(r => r.roster_slots?.[0]?.slot_type === 'ps')
  const irRoster      = roster.filter(r => r.roster_slots?.[0]?.slot_type === 'ir')
  const lineupIds     = new Set(Object.values(lineupAssign))
  const benchPlayers  = activeRoster.filter(r => !lineupIds.has(r.id||r.sleeper_id))

  // ── Pending change detection ───────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (Object.keys(slotOverrides).length > 0) return true
    const allKeys = new Set([...Object.keys(lineupAssign), ...Object.keys(savedLineupAssign)])
    for (const key of allKeys) {
      if (lineupAssign[key] !== savedLineupAssign[key]) return true
    }
    return false
  }, [lineupAssign, savedLineupAssign, slotOverrides])

  const pendingCount = useMemo(() => {
    let count = Object.keys(slotOverrides).length
    const allKeys = new Set([...Object.keys(lineupAssign), ...Object.keys(savedLineupAssign)])
    for (const key of allKeys) {
      if (lineupAssign[key] !== savedLineupAssign[key]) count++
    }
    return count
  }, [lineupAssign, savedLineupAssign, slotOverrides])

  function isPlayerLocked(contract) {
    const sleeperId = contract.players?.sleeper_id || contract.sleeper_id
    return weeklyLineup.find(r => r.sleeper_id === sleeperId)?.is_locked ?? false
  }

  // ── Handle move — only updates UI state, no API calls ─────────────────
  function handleMove(contractId, newSlot) {
    if (newSlot.startsWith('lineup:')) {
      const targetKey = newSlot.split(':')[1]
      setLineupAssign(prev => {
        const next     = { ...prev }
        const currKey  = Object.entries(next).find(([,v]) => v === contractId)?.[0]
        const occupant = next[targetKey]
        if (currKey) { if (occupant) next[currKey] = occupant; else delete next[currKey] }
        else if (occupant) { delete next[targetKey] }
        next[targetKey] = contractId
        return next
      })
      // Clear slot override if being moved to lineup (they're now active)
      setSlotOverrides(prev => { const n = {...prev}; delete n[contractId]; return n })

    } else if (newSlot === 'bench') {
      setLineupAssign(prev => {
        const next = {...prev}
        Object.entries(next).forEach(([k,v]) => { if (v === contractId) delete next[k] })
        return next
      })
      // If coming from PS/IR, track slot change
      const dbSlot = contract => roster.find(r => (r.id||r.sleeper_id) === contractId)?.roster_slots?.[0]?.slot_type || 'active'
      const current = dbSlot(contractId)
      if (current === 'ps' || current === 'ir') {
        setSlotOverrides(prev => ({...prev, [contractId]: 'active'}))
      } else {
        setSlotOverrides(prev => { const n = {...prev}; delete n[contractId]; return n })
      }

    } else if (newSlot === 'ps' || newSlot === 'ir') {
      setLineupAssign(prev => {
        const next = {...prev}
        Object.entries(next).forEach(([k,v]) => { if (v === contractId) delete next[k] })
        return next
      })
      setSlotOverrides(prev => ({...prev, [contractId]: newSlot}))
    }
  }

  // ── Save all pending changes ───────────────────────────────────────────
  async function saveChanges() {
    setSaving(true)
    let ok = 0, fail = 0
    const headers = {
      'Content-Type':     'application/json',
      'x-team-abbrev':    manager?.team_abbrev || '',
      'x-admin-password': isAdmin ? (localStorage.getItem('adminPw') || '') : '',
    }

    // 1. Save lineup moves (diff vs saved state)
    const allSlotKeys = new Set([...Object.keys(lineupAssign), ...Object.keys(savedLineupAssign)])
    for (const slotKey of allSlotKeys) {
      if (lineupAssign[slotKey] === savedLineupAssign[slotKey]) continue
      const contractId = lineupAssign[slotKey]
      if (!contractId) continue  // slot was cleared — bench move handled elsewhere
      const contract   = roster.find(r => (r.id||r.sleeper_id) === contractId)
      const sleeperId  = contract?.players?.sleeper_id || contract?.sleeper_id
      if (!sleeperId) { fail++; continue }
      const slotType = keyToSlotType(slotKey)
      try {
        const r = await fetch(`${API_BASE}/lineup/${abbrev.toUpperCase()}/move`, {
          method:'PATCH', headers,
          body: JSON.stringify({ sleeper_id: sleeperId, new_slot: slotType, season: CURRENT_SEASON, week: currentWeek }),
        })
        r.ok ? ok++ : fail++
      } catch { fail++ }
    }

    // 2. Save bench moves (starters removed from lineup)
    for (const [slotKey, savedCid] of Object.entries(savedLineupAssign)) {
      if (lineupAssign[slotKey]) continue  // still has someone
      const contract  = roster.find(r => (r.id||r.sleeper_id) === savedCid)
      const sleeperId = contract?.players?.sleeper_id || contract?.sleeper_id
      if (!sleeperId) continue
      try {
        const r = await fetch(`${API_BASE}/lineup/${abbrev.toUpperCase()}/move`, {
          method:'PATCH', headers,
          body: JSON.stringify({ sleeper_id: sleeperId, new_slot: 'BN', season: CURRENT_SEASON, week: currentWeek }),
        })
        r.ok ? ok++ : fail++
      } catch { fail++ }
    }

    // 3. Save PS/IR slot changes
    for (const [contractId, newSlot] of Object.entries(slotOverrides)) {
      const contract  = roster.find(r => (r.id||r.sleeper_id) === contractId)
      const sleeperId = contract?.players?.sleeper_id || contract?.sleeper_id
      if (!sleeperId) { fail++; continue }
      try {
        const r = await fetch(`${API_BASE}/teams/${abbrev.toUpperCase()}/slot-move`, {
          method:'PATCH', headers,
          body: JSON.stringify({ sleeper_id: sleeperId, new_slot: newSlot }),
        })
        if (r.ok) { const updated = await r.json(); setTeamData(prev => ({...prev, ...updated})); ok++ }
        else fail++
      } catch { fail++ }
    }

    setSaving(false)
    setSlotOverrides({})
    setSaveMsg(fail ? `${ok} saved, ${fail} failed ✗` : `${ok} change${ok!==1?'s':''} saved ✓`)
    setTimeout(() => setSaveMsg(''), 3000)
    loadTeam()
  }

  function cancelChanges() {
    setLineupAssign(savedLineupAssign)
    setSlotOverrides({})
    setSaveMsg('Changes discarded')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  if (!team) return <div className="tp-loading">Team not found</div>

  const extraColSpan = canEdit ? 11 : 10  // colSpan for empty rows (added OPP RNK column)

  function TableHeader() {
    return (
      <thead>
        <tr>
          <th className="th-slot">SLOT</th>
          <th className="th-player">PLAYER</th>
          {canEdit && <th className="th-action">MOVE</th>}
          <th className="th-stat">AGE</th>
          <th className="th-stat">BYE</th>
          <th className="th-stat">POS RK</th>
          <th className="th-stat">FPTS</th>
          <th className="th-stat">PPG</th>
          <th className="th-stat">PROJ</th>
          <th className="th-stat">% OWN</th>
          <th className="th-stat">OPP</th>
          <th className="th-stat">OPP RNK</th>
          <th className="th-salary">SALARY</th>
          <th className="th-contract">YRS</th>
        </tr>
      </thead>
    )
  }

  return (
    <div className="tp-root">

      {/* Hero Header */}
      <div className="tp-header" style={{
        background: colors?.primary || 'var(--bg2)',
        borderBottom: `1px solid ${colors?.primary || 'var(--border)'}`,
      }}>
        <div className="tp-header-accent" style={{ background: colors?.accent }}/>
        <div className="tp-header-inner">
          <div className="tp-identity">
            <img src={LOGOS[abbrev.toUpperCase()]} alt={team.name} className="tp-logo"
              style={{ filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}/>
            <div className="tp-bio" style={{ background:"rgba(0,0,0,0.32)", padding:"8px 14px", borderRadius:8, backdropFilter:"blur(4px)" }}>
              <div className="tp-badge" style={{
                borderColor: colors?.accent || 'var(--orange)',
                color: colors?.text || 'var(--text-primary)',
                background: colors ? `${colors.accent}33` : 'transparent',
              }}>{team.abbrev}</div>
              <h1 className="tp-name" style={{ color: colors?.text || 'var(--text-primary)', textShadow:'0 1px 4px rgba(0,0,0,0.3)' }}>{team.name}</h1>
              <div className="tp-mgr" style={{ color: colors ? `${colors.text}99` : 'var(--text-muted)' }}>{team.manager}</div>
            </div>
          </div>
          <div className="tp-header-stats" style={{ background:"rgba(0,0,0,0.32)", padding:"8px 14px", borderRadius:8, backdropFilter:"blur(4px)" }}>
            {[
              { label:'Record',    val:`${record.wins}-${record.losses}`,                                                           cls:'' },
              { label:'Cap Used',  val:`$${capUsed.toFixed(2)}`,                                                                    cls: isOver ? 'tp-red' : isLux ? 'tp-gold' : '' },
              { label:'Cap Space', val: isOver ? `($${Math.abs(capSpace).toFixed(2)})` : `$${capSpace.toFixed(2)}`,                cls: capSpace < 5 ? 'tp-red' : 'tp-green' },
              { label:'SB Budget', val: sbBalance != null ? `$${parseFloat(sbBalance).toFixed(2)}` : '—',                          cls: '' },
              { label:'PS Space',  val:`$${Math.max(0, PS_SALARY_LIMIT - psSalaryUsed).toFixed(2)}`,                               cls: psSalaryOver ? 'tp-red' : '' },
            ].map(s => (
              <div key={s.label} className="tp-hstat">
                <span style={{ fontFamily:'var(--font-ui)', fontSize:9, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.7)', display:'block', marginBottom:2 }}>{s.label}</span>
                <span className={`tp-hs-val ${s.cls}`} style={!s.cls ? { color:'rgba(255,255,255,0.95)' } : {}}>{s.val}</span>
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, flexWrap:'wrap' }}>
              <span className={`tp-tax-badge ${isOver ? 'tax-over' : isLux ? 'tax-lux' : 'tax-ok'}`}>
                {isOver ? 'OVER CAP' : isLux ? 'OVER TAX' : 'UNDER TAX'}
              </span>
              {/* Propose Trade — compact, inline with badge, visible on other teams only */}
              {manager?.team_abbrev && manager.team_abbrev !== abbrev?.toUpperCase() && (
                <button
                  onClick={() => navigate(`/trade?teams=${manager.team_abbrev},${abbrev?.toUpperCase()}`)}
                  style={{
                    background: '#e8822a', border: 'none', color: '#000',
                    fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 800,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  ⇄ Propose Trade
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="tp-cap-section" style={{ background:"rgba(0,0,0,0.28)", padding:"6px 14px", borderRadius:6, backdropFilter:"blur(4px)" }}>
          <CapBar capUsed={capUsed} hardCap={hardCap} taxLine={TAX_LINE}/>
        </div>
      </div>

      <PendingTradesWidget teamAbbrev={manager?.team_abbrev} isAdmin={isAdmin} compact={true}/>
      {abbrev?.toUpperCase() === manager?.team_abbrev && <PendingTradesWidget/>}

      {/* Tabs + save bar */}
      <div className="tp-tabs-wrap">
        <div className="tp-tabs">
          <button className={`tp-tab ${activeTab==='roster'?'tp-tab--active':''}`} onClick={() => setActiveTab('roster')}>Roster</button>
          <button className="tp-tab" onClick={() => navigate(`/team/${abbrev}/cap`)}>Cap Sheet</button>
          <button className={`tp-tab ${activeTab==='injuries'?'tp-tab--active':''}`} onClick={() => setActiveTab('injuries')}>
            Injuries{roster.filter(r=>r.players?.injury_status).length > 0 ? ` (${roster.filter(r=>r.players?.injury_status).length})` : ''}
          </button>
          <button className={`tp-tab ${activeTab==='stats'?'tp-tab--active':''}`} onClick={() => setActiveTab('stats')}>Stats</button>
          <button className={`tp-tab ${activeTab==='picks'?'tp-tab--active':''}`} onClick={() => setActiveTab('picks')}>Draft Picks</button>
          <button className={`tp-tab ${activeTab==='transactions'?'tp-tab--active':''}`} onClick={() => setActiveTab('transactions')}>Transactions</button>
          <button className={`tp-tab ${activeTab==='schedule'?'tp-tab--active':''}`} onClick={() => setActiveTab('schedule')}>Schedule</button>
        </div>
        <div className="tp-tab-right">
          <span className="tp-week-label">Week {currentWeek}</span>
          {saveMsg && <span className="tp-save-msg">{saveMsg}</span>}
          {isDirty && canEdit && (
            <>
              <span className="tp-pending-note">{pendingCount} unsaved change{pendingCount !== 1 ? 's' : ''}</span>
              <button className="tp-save-btn" onClick={saveChanges} disabled={saving}>{saving ? 'Saving…' : 'Save Lineup'}</button>
              <button className="tp-cancel-btn" onClick={cancelChanges}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="tp-content">

        {activeTab === 'roster' && (
          <div className="tp-roster-view">
            {loading ? (
              <div className="tp-loading-sm"><div className="tp-spinner"/><span>Loading roster…</span></div>
            ) : roster.length === 0 ? (
              <div className="tp-empty"><span>No roster data yet</span><p>Rosters populate when contracts are entered</p></div>
            ) : (
              <>
                {/* Starting Lineup */}
                <div className="tp-section-hdr tp-section-lineup">
                  <span>STARTING LINEUP</span>
                  <span className="tp-section-note">1 QB · 2 RB · 3 WR · 1 TE · 1 FLEX — locks at individual game kick-offs</span>
                </div>
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {LINEUP_SLOTS.map(slot => {
                        const cid      = lineupAssign[slot.key]
                        const contract = cid ? roster.find(r => (r.id||r.sleeper_id) === cid) : null
                        if (!contract) return <EmptySlotRow key={slot.key} slot={slot} canEdit={canEdit}/>
                        const sid = contract.players?.sleeper_id || contract.sleeper_id
                        return (
                          <PlayerRow key={slot.key} contract={contract}
                            slotLabel={slot.label}
                            slotColor={POS_COLOR[contract.players?.position] || 'var(--orange)'}
                            lineupAssign={lineupAssign} onMove={handleMove}
                            slotOverride={slotOverrides[contract.id||contract.sleeper_id]}
                            playerStats={stats[sid]} isLineupSlot={true}
                            activeRoster={activeRoster} psRoster={psRoster}
                            isLocked={isPlayerLocked(contract)} canEdit={canEdit}
                            opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}/>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="tr-total">
                        <td colSpan={canEdit ? 6 : 5}>LINEUP TOTAL</td>
                        <td className="rtr-stat rtr-fpts">
                          {Object.values(lineupAssign).reduce((s,cid) => {
                            const r = roster.find(x => (x.id||x.sleeper_id) === cid)
                            const sid = r?.players?.sleeper_id || r?.sleeper_id
                            return s + (stats[sid]?.fpts || 0)
                          }, 0).toFixed(1)}
                        </td>
                        <td colSpan={5}/>
                        <td className="rtr-salary">
                          <span className="rtr-sal">
                            ${Object.values(lineupAssign).reduce((s,cid) => {
                              const r = roster.find(x => (x.id||x.sleeper_id) === cid)
                              return s + parseFloat(r?.salary || 0)
                            }, 0).toFixed(2)}
                          </span>
                        </td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Bench */}
                <div className="tp-section-hdr tp-section-bench">
                  <span>BENCH ({benchPlayers.length}/{BENCH_SLOTS})</span>
                  <span className="tp-section-note">Active roster · Full cap hit · No scoring</span>
                </div>
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {benchPlayers.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="Bench"
                          slotColor="var(--text-muted)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}/>
                      ))}
                      {Array.from({length:Math.max(0,BENCH_SLOTS-benchPlayers.length)}).map((_,i) => (
                        <tr key={`eb${i}`} className="rtr rtr--empty">
                          <td className="rtr-slot"><span className="rtr-slot-label" style={{borderLeftColor:'var(--border)',color:'var(--text-muted)'}}>Bench</span></td>
                          <td className="rtr-player"><div className="rtr-empty-cell"><div className="rtr-empty-avatar"/><span className="rtr-empty-text">Empty bench slot</span></div></td>
                          <td colSpan={extraColSpan}/>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Practice Squad */}
                <div className="tp-section-hdr tp-section-ps">
                  <span>PRACTICE SQUAD ({psRoster.length}/4)</span>
                  <span className="tp-section-note">
                    50% cap hit · Salary ≤ $20 total ({psSalaryOver && <strong style={{color:'var(--red)'}}>OVER LIMIT</strong>}{!psSalaryOver && `$${psSalaryUsed.toFixed(2)} used`}) · Max 1 QB
                  </span>
                </div>
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {psRoster.length === 0 ? (
                        <tr className="rtr rtr--empty">
                          <td className="rtr-slot"><span className="rtr-slot-label" style={{borderLeftColor:'var(--blue)',color:'var(--text-muted)'}}>PS</span></td>
                          <td className="rtr-player"><div className="rtr-empty-cell"><div className="rtr-empty-avatar"/><span className="rtr-empty-text">No players on practice squad</span></div></td>
                          <td colSpan={extraColSpan}/>
                        </tr>
                      ) : psRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="PS"
                          slotColor="var(--blue)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}/>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* IR */}
                <div className="tp-section-hdr tp-section-ir">
                  <span>INJURED RESERVE ({irRoster.length})</span>
                  <span className="tp-section-note">50% cap hit · Must have Out/IR/PUP designation · Unlimited slots</span>
                </div>
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {irRoster.length === 0 ? (
                        <tr className="rtr rtr--empty">
                          <td className="rtr-slot"><span className="rtr-slot-label" style={{borderLeftColor:'var(--red)',color:'var(--text-muted)'}}>IR</span></td>
                          <td className="rtr-player"><div className="rtr-empty-cell"><div className="rtr-empty-avatar"/><span className="rtr-empty-text">No players on injured reserve</span></div></td>
                          <td colSpan={extraColSpan}/>
                        </tr>
                      ) : irRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="IR"
                          slotColor="var(--red)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}/>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'injuries' && (() => {
          const injured = roster.filter(r => r.players?.injury_status)
          if (!injured.length) return (
            <div className="tp-empty tp-empty--good"><span>✓ No injuries reported</span><p>All players healthy</p></div>
          )
          return (
            <div className="tp-table-wrap" style={{marginTop:16}}>
              <table className="tp-table">
                <thead><tr>
                  <th colSpan={2} className="th-player">Player</th>
                  <th>Injury</th><th>Slot</th><th className="th-salary">Salary</th><th>IR Eligible</th>
                </tr></thead>
                <tbody>
                  {injured.map((r,i) => {
                    const p   = r.players || {}
                    const sid = p.sleeper_id || r.sleeper_id
                    const slot = r.roster_slots?.[0]?.slot_type || 'active'
                    const irOk = ['Out','IR','PUP'].includes(p.injury_status)
                    return (
                      <tr key={i} className="rtr">
                        <td className="rtr-slot"><span className="rtr-slot-label" style={{borderLeftColor:POS_COLOR[p.position]||'var(--border)'}}>{p.position}</span></td>
                        <td className="rtr-player">
                          <div className="rtr-player-link">
                            <img src={headshotUrl(sid)} alt="" className="rtr-headshot" onError={e=>e.target.style.opacity=0}/>
                            <div className="rtr-pinfo">
                              <PlayerLink playerId={sid} className="rtr-pname">{p.full_name}</PlayerLink>
                              <div className="rtr-pmeta">
                                <span className="rtr-pos" style={{color:POS_COLOR[p.position]}}>{p.position}</span>
                                <span className="rtr-nfl">{p.nfl_team}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td><InjuryBadge status={p.injury_status} onClick={() => showNews(sid, p.full_name, 'health')}/></td>
                        <td style={{fontFamily:'var(--font-ui)',fontSize:12,color:'var(--text-muted)'}}>{slot.toUpperCase()}</td>
                        <td className="rtr-salary"><span className="rtr-sal">${parseFloat(r.salary||0).toFixed(2)}</span></td>
                        <td>{irOk
                          ? <span style={{color:'var(--green)',fontFamily:'var(--font-ui)',fontSize:11,fontWeight:700}}>✓ ELIGIBLE</span>
                          : <span style={{color:'var(--red)',fontFamily:'var(--font-ui)',fontSize:11,fontWeight:700}}>✗ NOT ELIGIBLE</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}

        {/* ── STATS TAB ── */}
        {activeTab === 'stats' && (
          <div className="tp-stats-tab" style={{marginTop:16}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14,flexWrap:'wrap'}}>
              <div className="tp-pos-tabs" style={{display:'flex',gap:4}}>
                {['ALL','QB','RB','WR','TE'].map(pos => (
                  <button key={pos}
                    className={`tp-tab-sm ${statsPosFilter===pos?'tp-tab-sm--active':''}`}
                    onClick={() => setStatsPosFilter(pos)}
                    style={{
                      fontFamily:'var(--font-ui)', fontSize:11, fontWeight:700, padding:'5px 12px',
                      border:'1px solid var(--border-bright)', background: statsPosFilter===pos?(POS_COLOR[pos]||'var(--orange)'):'transparent',
                      color: statsPosFilter===pos?'#fff':'var(--text-muted)', cursor:'pointer',
                    }}>{pos}</button>
                ))}
              </div>
              <select value={statsSeason} onChange={e=>setStatsSeason(parseInt(e.target.value))}
                style={{fontFamily:'var(--font-ui)',fontSize:12,padding:'5px 10px',border:'1px solid var(--border-bright)',background:'var(--bg1)'}}>
                {Array.from({length:6},(_,i)=>CURRENT_SEASON-i).map(y=>(
                  <option key={y} value={y}>{y} Season</option>
                ))}
              </select>
            </div>

            {statsLoading && <div className="tp-empty"><span>Loading stats…</span></div>}
            {!statsLoading && (() => {
              const rows = roster
                .map(r => ({ r, p: r.players || {}, sid: r.players?.sleeper_id || r.sleeper_id, st: teamStatsMap[r.players?.sleeper_id || r.sleeper_id] }))
                .filter(({ p }) => statsPosFilter==='ALL' || p.position===statsPosFilter)
                .sort((a,b) => {
                  const av = a.st?.[statsSortKey] ?? -1
                  const bv = b.st?.[statsSortKey] ?? -1
                  return statsSortDir==='desc' ? bv-av : av-bv
                })

              function SortTh({ label, k }) {
                const active = statsSortKey===k
                return (
                  <th onClick={() => { if(active) setStatsSortDir(d=>d==='desc'?'asc':'desc'); else { setStatsSortKey(k); setStatsSortDir('desc') } }}
                    style={{cursor:'pointer',userSelect:'none'}}>
                    {label}{active?(statsSortDir==='desc'?' ↓':' ↑'):''}
                  </th>
                )
              }

              if (!rows.length) return <div className="tp-empty"><span>No stats recorded for {statsSeason}.</span></div>

              return (
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <thead><tr>
                      <th colSpan={2} className="th-player">Player</th>
                      <th>NFL</th>
                      <SortTh label="FPTS" k="fantasy_pts"/>
                      <SortTh label="PTS/G" k="pts_pg"/>
                      <SortTh label="GMS" k="games"/>
                      <th>POS RK</th>
                    </tr></thead>
                    <tbody>
                      {rows.map(({ p, sid, st }, i) => (
                        <tr key={sid||i} className="rtr">
                          <td className="rtr-slot"><span className="rtr-slot-label" style={{borderLeftColor:POS_COLOR[p.position]||'var(--border)'}}>{p.position}</span></td>
                          <td className="rtr-player">
                            <div className="rtr-player-link">
                              <img src={headshotUrl(sid)} alt="" className="rtr-headshot" onError={e=>e.target.style.opacity=0}/>
                              <div className="rtr-pinfo">
                                <PlayerLink playerId={sid} className="rtr-pname">{p.full_name}</PlayerLink>
                              </div>
                            </div>
                          </td>
                          <td style={{fontFamily:'var(--font-ui)',fontSize:12}}>{p.nfl_team || 'FA'}</td>
                          <td style={{fontFamily:'var(--font-ui)',fontSize:13,fontWeight:700,color:'var(--orange)'}}>{st?.fantasy_pts!=null?st.fantasy_pts.toFixed(1):'—'}</td>
                          <td style={{fontFamily:'var(--font-ui)',fontSize:13}}>{st?.pts_pg!=null?st.pts_pg.toFixed(1):'—'}</td>
                          <td style={{fontFamily:'var(--font-ui)',fontSize:12,color:'var(--text-muted)'}}>{st?.games ?? '—'}</td>
                          <td style={{fontFamily:'var(--font-ui)',fontSize:12}}>{st?.pos_rank ? `${p.position}${st.pos_rank}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── DRAFT PICKS TAB ── */}
        {activeTab === 'picks' && (
          <div className="tp-picks-tab" style={{marginTop:16}}>
            {picksLoading && <div className="tp-empty"><span>Loading draft picks…</span></div>}
            {!picksLoading && (
              <>
                <div className="tp-section-label" style={{fontFamily:'var(--font-ui)',fontSize:12,fontWeight:800,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text-muted)',margin:'8px 0'}}>
                  Owned Picks
                </div>
                {!ownedPicks.length ? (
                  <div className="tp-empty"><span>No future draft picks on record.</span></div>
                ) : (
                  <div className="tp-table-wrap">
                    <table className="tp-table">
                      <thead><tr><th>Season</th><th>Round</th><th>Pick</th><th>Origin</th><th>Cap Value</th></tr></thead>
                      <tbody>
                        {ownedPicks.map(p => (
                          <tr key={p.id} className="rtr">
                            <td style={{fontFamily:'var(--font-ui)',fontWeight:700}}>{p.season}</td>
                            <td style={{fontFamily:'var(--font-ui)'}}>Round {p.round}</td>
                            <td style={{fontFamily:'var(--font-ui)',color:'var(--text-muted)'}}>{p.pick_number ?? 'TBD'}</td>
                            <td style={{fontFamily:'var(--font-ui)',fontSize:12,color:'var(--text-muted)'}}>
                              {p.original_team_abbrev === abbrev?.toUpperCase() ? '—' : `via ${p.original_team_abbrev}`}
                            </td>
                            <td style={{fontFamily:'var(--font-ui)',color:'var(--orange)'}}>{p.cap_value ? `$${parseFloat(p.cap_value).toFixed(2)}` : '$TBD'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="tp-section-label" style={{fontFamily:'var(--font-ui)',fontSize:12,fontWeight:800,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text-muted)',margin:'20px 0 8px'}}>
                  Draft History
                </div>
                {!pickHistory.length ? (
                  <div className="tp-empty"><span>No completed draft selections yet.</span></div>
                ) : (
                  <div className="tp-table-wrap">
                    <table className="tp-table">
                      <thead><tr><th>Season</th><th>Round</th><th>Pick</th><th colSpan={2} className="th-player">Player Selected</th></tr></thead>
                      <tbody>
                        {pickHistory.map(p => (
                          <tr key={p.id} className="rtr">
                            <td style={{fontFamily:'var(--font-ui)',fontWeight:700}}>{p.season}</td>
                            <td style={{fontFamily:'var(--font-ui)'}}>Round {p.round}</td>
                            <td style={{fontFamily:'var(--font-ui)',color:'var(--text-muted)'}}>{p.pick_number}</td>
                            <td colSpan={2} className="rtr-player">
                              {p.used_on_player ? (
                                <PlayerLink playerId={p.used_on_player} className="rtr-pname">
                                  {historyNames[p.used_on_player] || p.used_on_player}
                                </PlayerLink>
                              ) : <span style={{color:'var(--text-muted)'}}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TRANSACTIONS TAB ── */}
        {activeTab === 'transactions' && (
          <div className="tp-transactions-tab" style={{marginTop:16}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
              <select value={txSeason} onChange={e=>setTxSeason(e.target.value)}
                style={{fontFamily:'var(--font-ui)',fontSize:12,padding:'5px 10px',border:'1px solid var(--border-bright)',background:'var(--bg1)'}}>
                {Array.from({length:5},(_,i)=>CURRENT_SEASON-i).map(y=>(
                  <option key={y} value={y}>{y} Season</option>
                ))}
                <option value="all">All Time</option>
              </select>
            </div>

            {txLoading && <div className="tp-empty"><span>Loading transactions…</span></div>}
            {!txLoading && !transactions.length && (
              <div className="tp-empty"><span>No transactions recorded for this period.</span></div>
            )}
            {!txLoading && transactions.length > 0 && (
              <div className="tp-tx-list">
                {transactions.map((t,i) => {
                  const players = (t.assets||[]).filter(a => a.player)
                  const desc = describeTeamPageTx(t)
                  return (
                  <div key={t.id||i} style={{
                    padding:'10px 14px', borderBottom:'1px solid var(--border)',
                    fontFamily:'var(--font-ui)',
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom: players.length ? 6 : 0}}>
                      <span style={{
                        fontSize:9, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase',
                        padding:'2px 7px', border:'1px solid var(--border-bright)', color:'var(--text-muted)',
                        whiteSpace:'nowrap', flexShrink:0,
                      }}>{(t.type||'').replace(/_/g,' ')}</span>
                      <span style={{flex:1,fontSize:13,color:'var(--text-primary)'}}>{desc}</span>
                      <span style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>
                        {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : ''}
                      </span>
                    </div>
                    {/* Player cards for anyone mentioned in this transaction */}
                    {players.length > 0 && (
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',paddingLeft:4}}>
                        {players.map(a => (
                          <div key={a.player.sleeper_id} style={{display:'flex',alignItems:'center',gap:6}}>
                            <img
                              src={`https://sleepercdn.com/content/nfl/players/thumb/${a.player.sleeper_id}.jpg`}
                              alt=""
                              style={{width:24,height:24,objectFit:'cover',objectPosition:'top',borderRadius:3,background:'var(--bg3)'}}
                              onError={e=>e.target.style.opacity=0}
                            />
                            <PlayerLink playerId={a.player.sleeper_id} style={{fontSize:12,fontWeight:600}}>
                              {a.player.full_name || a.player.sleeper_id}
                            </PlayerLink>
                            {a.player.position && (
                              <span style={{fontSize:10,fontWeight:700,color:POS_COLOR[a.player.position]||'var(--text-muted)'}}>
                                {a.player.position}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        )}

      </div>

        {/* ── SCHEDULE TAB ── */}
        {activeTab === 'schedule' && (
          <div className="tp-schedule-tab" style={{marginTop:16}}>
            {schedTabLoading && <div className="tp-empty"><span>Loading schedule…</span></div>}
            {!schedTabLoading && (() => {
              if (!teamMatchups.length) return (
                <div className="tp-empty"><span>No schedule data found.</span></div>
              )

              // Compute running record as we walk through weeks
              let wins = 0, losses = 0

              return (
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <thead>
                      <tr>
                        <th style={{width:50}}>WK</th>
                        <th>OPP</th>
                        <th style={{width:40}}>H/A</th>
                        <th style={{width:60}}>RESULT</th>
                        <th style={{width:70}}>PF</th>
                        <th style={{width:70}}>PA</th>
                        <th style={{width:80}}>RECORD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMatchups.map((m, i) => {
                        const isHome   = m.home_team === abbrev?.toUpperCase()
                        const opp      = isHome ? m.away_team : m.home_team
                        const oppTeam  = TEAMS?.find(t => t.abbrev === opp)
                        const pf       = parseFloat(isHome ? (m.home_score||0) : (m.away_score||0))
                        const pa       = parseFloat(isHome ? (m.away_score||0) : (m.home_score||0))
                        const isFinal  = m.status === 'final'
                        const isLive   = m.status === 'in_progress' || m.status === 'live'
                        const isPlayoff = m.week > 14
                        const won      = isFinal && pf > pa
                        const lost     = isFinal && pf < pa

                        if (won)  wins++
                        if (lost) losses++

                        const weekLabel = m.week === 15 ? 'R1' : m.week === 16 ? 'SF' : m.week === 17 ? 'CHMP' : m.week

                        return (
                          <tr key={m.id} className="rtr" style={isPlayoff ? {background:'var(--bg2)'} : {}}>
                            <td style={{fontFamily:'var(--font-ui)',fontWeight:700,fontSize:13}}>
                              {isPlayoff ? (
                                <span style={{color:'var(--orange)'}}>{weekLabel}</span>
                              ) : weekLabel}
                            </td>
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:8}}>
                                {opp !== 'TBD' && LOGOS?.[opp] && (
                                  <img src={LOGOS[opp]} alt={opp} style={{width:24,height:24,objectFit:'contain'}}/>
                                )}
                                <div>
                                  <div style={{fontFamily:'var(--font-ui)',fontWeight:700,fontSize:13}}>
                                    {oppTeam?.name || opp}
                                  </div>
                                  {oppTeam?.manager && (
                                    <div style={{fontFamily:'var(--font-ui)',fontSize:10,color:'var(--text-muted)'}}>
                                      {oppTeam.manager}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{fontFamily:'var(--font-ui)',fontSize:11,color:'var(--text-muted)',textAlign:'center'}}>
                              {isHome ? 'H' : 'A'}
                            </td>
                            <td style={{textAlign:'center'}}>
                              {isFinal ? (
                                <span style={{
                                  fontFamily:'var(--font-ui)', fontWeight:800, fontSize:13,
                                  color: won ? 'var(--green,#3dba6e)' : 'var(--red,#d94f4f)'
                                }}>{won ? 'W' : 'L'}</span>
                              ) : isLive ? (
                                <span style={{color:'var(--orange)',fontWeight:700,fontSize:11}}>LIVE</span>
                              ) : (
                                <span style={{color:'var(--text-muted)',fontSize:11}}>–</span>
                              )}
                            </td>
                            <td style={{fontFamily:'var(--font-ui)',fontSize:13,fontWeight: isFinal?600:400,color: won?'var(--green,#3dba6e)': isFinal?'var(--red,#d94f4f)':'var(--text-muted)'}}>
                              {isFinal || isLive ? pf.toFixed(2) : '—'}
                            </td>
                            <td style={{fontFamily:'var(--font-ui)',fontSize:13,color:'var(--text-muted)'}}>
                              {isFinal || isLive ? pa.toFixed(2) : '—'}
                            </td>
                            <td style={{fontFamily:'var(--font-ui)',fontSize:12,color:'var(--text-muted)'}}>
                              {isFinal ? `${wins}-${losses}` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )}

      {newsModal && (
        <NewsCard
          sleeperId={newsModal.sleeperId}
          playerName={newsModal.name}
          defaultTab={newsModal.tab}
          onClose={() => setNewsModal(null)}
        />
      )}
    </div>
  )
}
