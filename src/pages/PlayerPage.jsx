import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ComposedChart, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Bar, Line, Cell } from 'recharts'
import { TEAMS, LOGOS } from '../data/league'
import { useAuth } from '../context/AuthContext'
import {
  calcFantasyPts,
  calcBoomBust,
  isRegularSeason,
  calcPercentile,
  getComputedStat,
  pctBarColor,
} from '../utils/scoringUtils'
import './PlayerPage.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '') + '/api'
const SEASONS  = Array.from({ length: 2025 - 2019 + 1 }, (_, i) => 2025 - i)

// Approximate pool sizes for position rank display
// Dynasty leagues carry large rosters — these are meaningful starters + key backups
const POS_POOL = { QB: 28, RB: 56, WR: 72, TE: 28 }
function computePosRankLabel(pct, pos) {
  if (!pct || pct === 0) return ''
  const pool = POS_POOL[pos] || 48
  const rank = Math.max(1, Math.round(pool * (1 - pct / 100)))
  return `${pos}${rank}`
}
const CURRENT_SEASON = new Date().getFullYear()

function formatHeight(inches) {
  if (!inches) return '—'
  const h = parseInt(inches)
  if (isNaN(h)) return inches
  return `${Math.floor(h / 12)}'${h % 12}"`
}
function fmt(n, decimals = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function headshotUrl(id)  { return `https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg` }
function nflLogoUrl(team) { return `https://sleepercdn.com/images/team_logos/nfl/${team?.toLowerCase()}.jpg` }
function rollingAvg(arr, n = 4) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - n + 1), i + 1)
    const valid = slice.filter(v => v !== null && v !== undefined)
    if (!valid.length) return null
    return parseFloat((valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(2))
  })
}
function ptColor(pts) {
  if (pts >= 25) return '#3dba6e'
  if (pts >= 15) return '#e8822a'
  if (pts >= 5)  return '#d4a843'
  return '#d94f4f'
}
function fmtStat(val, key) {
  if (val === null || val === undefined || val === 0) return '—'
  if (key === '_cpct') return val.toFixed(1) + '%'
  if (key === '_ypc' || key === '_ypr') return val.toFixed(1)
  if (Number.isInteger(val)) return val.toLocaleString()
  return parseFloat(val.toFixed(1)).toLocaleString()
}
function timeAgo(ts) {
  const diff = Date.now() - ts * 1000
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(ts * 1000).toLocaleDateString()
}

const TB_LABELS  = { available: 'On the Block', listening: 'Will Listen', untouchable: 'Untouchable' }
const TB_COLORS  = { available: '#3dba6e', listening: '#d4a843', untouchable: '#d94f4f' }
const TB_OPTIONS = [
  { status: 'available',   label: '🟢 On the Block' },
  { status: 'listening',   label: '🟡 Will Listen'  },
  { status: 'untouchable', label: '🔴 Untouchable'  },
]

const FLAT_STATS = {
  QB: [
    { key: 'pass_cmp',     label: 'CMP'  },
    { key: 'pass_att',     label: 'ATT'  },
    { key: '_cpct',        label: 'CMP%' },
    { key: 'pass_yd',      label: 'P YDS'},
    { key: 'pass_td',      label: 'P TD' },
    { key: 'pass_int',     label: 'INT',  invert: true },
    { key: 'pass_sack',    label: 'SCK',  invert: true },
    { key: 'fumbles_lost', label: 'FUM',  invert: true, sectionEnd: true },
    { key: 'rush_yd',      label: 'R YDS'},
    { key: '_ypc',         label: 'YPC'  },
    { key: 'rush_td',      label: 'R TD' },
  ],
  RB: [
    { key: 'rush_yd',      label: 'YDS'  },
    { key: 'rush_att',     label: 'CAR'  },
    { key: '_ypc',         label: 'YPC'  },
    { key: 'rush_td',      label: 'R TD' },
    { key: 'fumbles_lost', label: 'FUM',  invert: true, sectionEnd: true },
    { key: 'targets',      label: 'TAR'  },
    { key: 'rec',          label: 'REC'  },
    { key: 'rec_yd',       label: 'C YDS'},
    { key: '_ypr',         label: 'YPR'  },
    { key: 'rec_td',       label: 'C TD' },
  ],
  WR: [
    { key: 'targets',      label: 'TAR'  },
    { key: 'rec',          label: 'REC'  },
    { key: 'rec_yd',       label: 'YDS'  },
    { key: '_ypr',         label: 'YPR'  },
    { key: 'rec_td',       label: 'TD'   },
    { key: 'fumbles_lost', label: 'FUM',  invert: true, sectionEnd: true },
    { key: 'rush_yd',      label: 'R YDS'},
    { key: '_ypc',         label: 'YPC'  },
    { key: 'rush_td',      label: 'R TD' },
  ],
  TE: [
    { key: 'targets',      label: 'TAR'  },
    { key: 'rec',          label: 'REC'  },
    { key: 'rec_yd',       label: 'YDS'  },
    { key: '_ypr',         label: 'YPR'  },
    { key: 'rec_td',       label: 'TD'   },
    { key: 'fumbles_lost', label: 'FUM',  invert: true },
  ],
}

function StatBar({ label, value, pct, isZero, sectionEnd }) {
  const color = isZero ? 'var(--border-bright)' : pctBarColor(pct)
  const fillH = isZero ? 0 : Math.max(3, Math.min(100, pct))
  return (
    <div className={`pp-sbar${isZero ? ' pp-sbar--zero' : ''}${sectionEnd ? ' pp-sbar--section-end' : ''}`}>
      <div className="pp-sbar-pct" style={{ color: isZero ? 'transparent' : color }}>
        {!isZero && pct > 0 ? pct : ''}
      </div>
      <div className="pp-sbar-track">
        <div className="pp-sbar-fill" style={{ height: `${fillH}%`, background: isZero ? 'transparent' : color }}/>
      </div>
      <div className="pp-sbar-lbl">{label}</div>
      <div className="pp-sbar-val">{value}</div>
    </div>
  )
}

function VertBar({ value, label, pct = 0, color = '#e8822a' }) {
  const fill = Math.max(4, Math.min(100, pct))
  return (
    <div className="pp-vbar-wrap">
      <div className="pp-vbar-track">
        <div className="pp-vbar-fill" style={{ height: `${fill}%`, background: color, boxShadow: `0 0 10px ${color}66` }}/>
      </div>
      <div className="pp-vbar-val" style={{ color }}>{value ?? '—'}</div>
      <div className="pp-vbar-label">{label}</div>
    </div>
  )
}

function TrendsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const pts  = payload.find(p => p.dataKey === 'pts')?.value
  const roll = payload.find(p => p.dataKey === 'rolling')?.value
  return (
    <div className="pp-tooltip">
      <div className="pp-tooltip-week">Week {label}</div>
      {pts  !== undefined && <div className="pp-tooltip-row"><span>Pts</span><span style={{ color: ptColor(pts) }}>{fmt(pts, 1)}</span></div>}
      {roll != null      && <div className="pp-tooltip-row"><span>4-wk avg</span><span style={{ color: '#e8822a' }}>{fmt(roll, 1)}</span></div>}
    </div>
  )
}


// ── Analytics Panel ───────────────────────────────────────────────────────
// Uses same StatBar + pp-sbars-row format as the season stats section.

const A_BENCHMARKS = {
  sack_rate:      { good: 5,   ok: 8,   lower: true  },
  to_rate_pass:   { good: 2,   ok: 4,   lower: true  },
  td_rate_pass:   { good: 6,   ok: 4,   lower: false },
  yds_per_att:    { good: 8,   ok: 6.5, lower: false },
  yds_per_cmp:    { good: 12,  ok: 9.5, lower: false },
  rsh_share:      { good: 60,  ok: 35,  lower: false },
  rsh_td_share:   { good: 40,  ok: 20,  lower: false },
  carry_rate:     { good: 45,  ok: 25,  lower: false },
  to_rate_rush:   { good: 1,   ok: 3,   lower: true  },
  td_rate_rush:   { good: 6,   ok: 3,   lower: false },
  tar_share:      { good: 22,  ok: 12,  lower: false },
  rec_share:      { good: 20,  ok: 10,  lower: false },
  rec_td_share:   { good: 30,  ok: 15,  lower: false },
  catch_rate:     { good: 68,  ok: 55,  lower: false },
  yds_per_target: { good: 9,   ok: 7,   lower: false },
  target_rate:    { good: 20,  ok: 12,  lower: false },
  td_rate_rec:    { good: 8,   ok: 4,   lower: false },
}

// Convert analytics metric value to 0-100 percentile using benchmarks
function aPct(val, key) {
  const bm = A_BENCHMARKS[key]
  if (!bm || val == null) return 0
  const { good, ok, lower } = bm
  if (lower) {
    if (val <= 0)    return 99
    if (val <= good) return Math.min(99, 85 + ((good - val) / good) * 14)
    if (val <= ok)   return 50 + ((ok - val) / (ok - good)) * 35
    return Math.max(5, 50 - ((val - ok) / ok) * 45)
  } else {
    if (val <= 0)    return 5
    if (val >= good) return Math.min(99, 85 + ((val - good) / good) * 14)
    if (val >= ok)   return 50 + ((val - ok) / (good - ok)) * 35
    return Math.max(5, (val / ok) * 50)
  }
}

function afmt(val, suffix = '%') {
  if (val == null) return '—'
  return val.toFixed(1) + suffix
}
function afmt0(val, suffix = '') {
  if (val == null) return '—'
  return Math.round(val) + suffix
}

// Reuses the StatBar component already defined above
const PP_ANALYTICS_RANK_KEY = {
  carry_rate:'carry_rate', td_rate_rush:'td_rate_rush', target_rate:'target_rate',
  catch_rate:'catch_rate', yds_per_target:'yds_per_target', td_rate_rec:'td_rate_rec',
  yds_per_att:'yds_per_att', td_rate_pass:'td_rate_pass', sack_rate:'sack_rate',
}

function AnalyticsGroup({ title, bars, analyticsRanks, playerPos }) {
  const visible = bars.filter(Boolean)
  if (!visible.length) return null
  return (
    <div className="pp-stat-panel" style={{ marginTop: 10 }}>
      <div className="pp-stat-panel-label">{title}</div>
      <div className="pp-sbars-row">
        {visible.map((b, i) => {
          const rf = b.rankKey ? PP_ANALYTICS_RANK_KEY[b.rankKey] : null
          const rn = rf && analyticsRanks ? analyticsRanks[rf] : null
          const pl = rn && playerPos ? `${playerPos}${rn}` : null
          return (
            <StatBar
              key={b.key}
              label={b.label}
              value={b.display}
              pct={Math.round(aPct(b.raw, b.key))}
              isZero={b.raw == null}
              sectionEnd={b.sectionEnd}
              posRankLabel={pl}
            />
          )
        })}
      </div>
    </div>
  )
}

function AnalyticsPanel({ analytics, pos, analyticsRanks, playerPos }) {
  const { passing: qb, rushing: ru, receiving: re } = analytics

  return (
    <>
      {/* QB */}
      {pos === 'QB' && qb && (
        <>
          <AnalyticsGroup analyticsRanks={analyticsRanks} playerPos={playerPos} title="PASSING EFFICIENCY" bars={[
            { key:'dropbacks_pg', label:'DRBK/G',  raw: qb.dropbacks_pg,  display: afmt(qb.dropbacks_pg, '') },
            { key:'sack_rate',    rankKey:'sack_rate',    label:'SACK%',   raw: qb.sack_rate,     display: afmt(qb.sack_rate),      sectionEnd: false },
            { key:'to_rate_pass', label:'TO%',     raw: qb.to_rate,       display: afmt(qb.to_rate)         },
            { key:'td_rate_pass', rankKey:'td_rate_pass', label:'TD%',     raw: qb.td_rate,       display: afmt(qb.td_rate)         },
            { key:'yds_per_att',  rankKey:'yds_per_att',  label:'YD/ATT',  raw: qb.yds_per_att,   display: afmt(qb.yds_per_att, '') },
            { key:'yds_per_cmp',  label:'YD/CMP',  raw: qb.yds_per_cmp,   display: afmt(qb.yds_per_cmp, '') },
            qb.rush_to_pass != null && { key:'rush_to_pass', label:'RU/PS%', raw: qb.rush_to_pass, display: afmt(qb.rush_to_pass) },
          ]} />
          {qb.epa != null && (
            <AnalyticsGroup analyticsRanks={analyticsRanks} playerPos={playerPos} title="ADVANCED (QB)" bars={[
              { key:'epa', label:'EPA', raw: qb.epa, display: `${qb.epa > 0 ? '+' : ''}${afmt(qb.epa, '')}` },
            ]} />
          )}
        </>
      )}

      {/* RB */}
      {pos === 'RB' && (
        <>
          {ru && (
            <AnalyticsGroup analyticsRanks={analyticsRanks} playerPos={playerPos} title="RUSHING USAGE" bars={[
              { key:'carry_rate', rankKey:'carry_rate',   label:'CAR/SNP', raw: ru.carry_rate,   display: afmt(ru.carry_rate)   },
              { key:'rsh_share',    rankKey:null,           label:'RSH SHR', raw: ru.rsh_share,    display: afmt(ru.rsh_share)    },
              { key:'rsh_td_share', label:'TD SHR',  raw: ru.rsh_td_share, display: afmt(ru.rsh_td_share) },
              { key:'td_rate_rush', rankKey:'td_rate_rush', label:'TD RATE', raw: ru.td_rate,      display: afmt(ru.td_rate)      },
              { key:'to_rate_rush', label:'TO RATE', raw: ru.to_rate,      display: afmt(ru.to_rate)      },
              ru.first_downs_pg != null && { key:'first_downs_pg', label:'1D/G', raw: ru.first_downs_pg, display: afmt(ru.first_downs_pg, '') },
            ]} />
          )}
          {re && (
            <AnalyticsGroup analyticsRanks={analyticsRanks} playerPos={playerPos} title="RECEIVING USAGE" bars={[
              { key:'target_rate',    label:'TGT/SNP', raw: re.target_rate,    display: afmt(re.target_rate)    },
              { key:'tar_share',      label:'TAR SHR', raw: re.tar_share,      display: afmt(re.tar_share)      },
              { key:'catch_rate',     rankKey:'catch_rate',    label:'CATCH%',  raw: re.catch_rate,     display: afmt(re.catch_rate)     },
              { key:'yds_per_target', rankKey:'yds_per_target', label:'YD/TGT',  raw: re.yds_per_target, display: afmt(re.yds_per_target, '') },
              re.yac_per_rec != null && { key:'yac_per_rec', label:'YAC/REC', raw: re.yac_per_rec, display: afmt(re.yac_per_rec, '') },
            ]} />
          )}
          {(ru?.epa != null) && (
            <AnalyticsGroup analyticsRanks={analyticsRanks} playerPos={playerPos} title="ADVANCED" bars={[
              { key:'epa', label:'EPA', raw: ru.epa, display: `${ru.epa > 0 ? '+' : ''}${afmt(ru.epa, '')}` },
            ]} />
          )}
        </>
      )}

      {/* WR / TE */}
      {(pos === 'WR' || pos === 'TE') && re && (
        <>
          <AnalyticsGroup analyticsRanks={analyticsRanks} playerPos={playerPos} title="TARGET SHARE" bars={[
            { key:'tar_share',    rankKey:null,           label:'TAR SHR', raw: re.tar_share,    display: afmt(re.tar_share)    },
            { key:'rec_share',    rankKey:null,           label:'REC SHR', raw: re.rec_share,    display: afmt(re.rec_share)    },
            { key:'rec_td_share', rankKey:null,           label:'TD SHR',  raw: re.rec_td_share, display: afmt(re.rec_td_share) },
            { key:'target_rate', rankKey:'target_rate',  label:'TGT/SNP', raw: re.target_rate,  display: afmt(re.target_rate)  },
          ]} />
          <AnalyticsGroup analyticsRanks={analyticsRanks} playerPos={playerPos} title="EFFICIENCY" bars={[
            { key:'catch_rate',     label:'CATCH%',  raw: re.catch_rate,       display: afmt(re.catch_rate)         },
            { key:'yds_per_target', label:'YD/TGT',  raw: re.yds_per_target,   display: afmt(re.yds_per_target, '') },
            { key:'td_rate_rec',    rankKey:'td_rate_rec',   label:'TD RATE', raw: re.td_rate,          display: afmt(re.td_rate)            },
            re.yac_per_rec    != null && { key:'yac_per_rec',    label:'YAC/REC',  raw: re.yac_per_rec,    display: afmt(re.yac_per_rec, '')    },
            re.pct_yds_in_air != null && { key:'pct_yds_in_air', label:'AIR YD%',  raw: re.pct_yds_in_air, display: afmt(re.pct_yds_in_air)     },
            re.first_downs_pg != null && { key:'first_downs_pg', label:'1D/G',     raw: re.first_downs_pg, display: afmt(re.first_downs_pg, '') },
          ]} />
          {re.epa != null && (
            <AnalyticsGroup analyticsRanks={analyticsRanks} playerPos={playerPos} title="ADVANCED" bars={[
              { key:'epa', label:'EPA', raw: re.epa, display: `${re.epa > 0 ? '+' : ''}${afmt(re.epa, '')}` },
            ]} />
          )}
        </>
      )}
    </>
  )
}


export default function PlayerPage() {
  const { id } = useParams()
  const { manager, isAdmin } = useAuth()
  const inSeason = isRegularSeason()

  const [player,            setPlayer]            = useState(null)
  const [contract,          setContract]          = useState(null)
  const [stats,             setStats]             = useState(null)
  const [career,            setCareer]            = useState(null)
  const [news,              setNews]              = useState(null)
  const [ownership,         setOwnership]         = useState(null)
  const [tradeBlockStatus,  setTradeBlockStatus]  = useState(null)
  const [tradeBlockPicker,  setTradeBlockPicker]  = useState(false)
  const [tradeBlockLoading, setTradeBlockLoading] = useState(false)
  const [onWatchlist,       setOnWatchlist]       = useState(false)
  const [watchlistLoading,  setWatchlistLoading]  = useState(false)
  const [activeTab,         setActiveTab]         = useState('season')
  const [season,            setSeason]            = useState(CURRENT_SEASON)
  const [viewMode,          setViewMode]          = useState('total')
  const [loading,           setLoading]           = useState(true)
  const [statsLoading,      setStatsLoading]      = useState(false)
  const [careerLoading,     setCareerLoading]     = useState(false)
  const [newsLoading,       setNewsLoading]       = useState(false)
  const [newsFilter,        setNewsFilter]        = useState('health')
  const [analytics,         setAnalytics]         = useState(null)
  const [posRanks,          setPosRanks]          = useState(null)

  const myTeam     = manager?.team_abbrev
  const teamAbbrev = myTeam

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`${API_BASE}/players/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setPlayer(data.player || data)
          setContract(data.contract || null)
          if (data.latest_season) setSeason(data.latest_season)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    fetch(`${API_BASE}/trade-block`)
      .then(r => r.ok ? r.json() : [])
      .then(blocks => {
        const block = (Array.isArray(blocks) ? blocks : []).find(b => b.sleeper_id === id && b.asset_type === 'player')
        setTradeBlockStatus(block?.status || null)
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!id || !teamAbbrev) return
    fetch(`${API_BASE}/watchlist`, { headers: { 'x-team-abbrev': teamAbbrev } })
      .then(r => r.ok ? r.json() : [])
      .then(wl => setOnWatchlist((Array.isArray(wl) ? wl : []).some(e => e.sleeper_id === id)))
      .catch(() => {})
  }, [id, teamAbbrev])

  useEffect(() => {
    if (id && season) {
      fetch(`${API_BASE}/stats/player/${id}/analytics?season=${season}`)
        .then(r => r.ok ? r.json() : null)
        .then(setAnalytics)
        .catch(() => {})
    }
  }, [id, season])

  useEffect(() => {
    setStatsLoading(true)
    fetch(`${API_BASE}/stats/player/${id}?season=${season}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setStats(data); setStatsLoading(false) })
      .catch(() => setStatsLoading(false))
  }, [player?.sleeper_id, season])

  useEffect(() => {
    if (activeTab !== 'career' || career || !id) return
    setCareerLoading(true)
    fetch(`${API_BASE}/stats/player/${id}/career`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setCareer(data); setCareerLoading(false) })
      .catch(() => setCareerLoading(false))
  }, [activeTab, player?.sleeper_id])

  useEffect(() => {
    if (activeTab !== 'news' || !id) return
    setNewsLoading(true)
    fetch(`${API_BASE}/news/player/${id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setNews(Array.isArray(data) ? data : []); setNewsLoading(false) })
      .catch(() => { setNews([]); setNewsLoading(false) })
  }, [activeTab, id])

  useEffect(() => {
    if (!id) return
    fetch(`${API_BASE}/stats/player/${id}/ownership`)
      .then(r => r.ok ? r.json() : null)
      .then(setOwnership)
      .catch(() => {})
  }, [player?.sleeper_id])

  async function handleTradeBlockSet(status) {
    if (!teamAbbrev) return
    setTradeBlockLoading(true)
    try {
      const r = await fetch(`${API_BASE}/trade-block/player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-team-abbrev': teamAbbrev },
        body: JSON.stringify({ sleeper_id: id, status }),
      })
      if (r.ok) { setTradeBlockStatus(status); setTradeBlockPicker(false) }
    } catch { }
    setTradeBlockLoading(false)
  }

  async function handleTradeBlockRemove() {
    if (!teamAbbrev) return
    setTradeBlockLoading(true)
    try {
      const r = await fetch(`${API_BASE}/trade-block/player/${id}`, {
        method: 'DELETE', headers: { 'x-team-abbrev': teamAbbrev },
      })
      if (r.ok) { setTradeBlockStatus(null); setTradeBlockPicker(false) }
    } catch { }
    setTradeBlockLoading(false)
  }

  async function toggleWatchlist() {
    if (!teamAbbrev || watchlistLoading) return
    setWatchlistLoading(true)
    try {
      if (onWatchlist) {
        await fetch(`${API_BASE}/watchlist/${id}`, { method: 'DELETE', headers: { 'x-team-abbrev': teamAbbrev } })
        setOnWatchlist(false)
      } else {
        await fetch(`${API_BASE}/watchlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-team-abbrev': teamAbbrev },
          body: JSON.stringify({ sleeper_id: id }),
        })
        setOnWatchlist(true)
      }
    } catch { }
    setWatchlistLoading(false)
  }

  const pos    = player?.position || 'WR'
  const nflTeam = player?.nfl_team
  const games  = stats?.games ?? null
  const totals = stats?.totals || {}
  const weekly = stats?.weekly || []

  const correctedWeekly = useMemo(() =>
    weekly.map(w => ({ ...w, fantasy_pts: calcFantasyPts(w, pos) })),
    [weekly, pos]
  )

  const ptsTotal   = calcFantasyPts(totals, pos)
  const ptsPerG    = games ? parseFloat((ptsTotal / games).toFixed(2)) : null
  const isBoomBust = useMemo(() => calcBoomBust(correctedWeekly), [correctedWeekly])

  function statVal(key)           { return getComputedStat(key, totals, games, viewMode) }
  function statPct(key, invert)   { return calcPercentile(key, statVal(key), pos, invert, viewMode) }
  function statDisplay(key)       { return fmtStat(statVal(key), key) }
  function isZeroStat(key)        { return getComputedStat(key, totals, games, 'total') === 0 }

  const fantasyTeam = contract?.teams?.abbrev ? TEAMS.find(t => t.abbrev === contract.teams.abbrev) : null
  const teamColor   = fantasyTeam?.color || null
  const isMyPlayer  = contract?.teams?.abbrev === myTeam

  const headerStyle = teamColor ? {
    background: `linear-gradient(135deg, ${teamColor.primary}ee 0%, ${teamColor.primary}88 50%, #0d1117 100%)`,
    borderBottom: `1px solid ${teamColor.accent}44`,
  } : {}
  const teamBarStyle = teamColor ? { background: `linear-gradient(90deg, ${teamColor.accent}99, transparent 70%)` } : {}

  const posAvgPts = { QB: 22.4, RB: 11.2, WR: 12.6, TE: 9.1 }
  const pctRank   = Math.min(99, Math.max(1, ((ptsPerG || 0) / (posAvgPts[pos] || 12)) * 50))
  const posRank   = Math.max(1, Math.round(80 * (1 - pctRank / 100)))

  const chartData = useMemo(() => {
    const pts     = correctedWeekly.map(w => ({ week: w.week, pts: parseFloat((w.fantasy_pts || 0).toFixed(2)) }))
    const rollArr = rollingAvg(pts.map(p => p.pts))
    return pts.map((p, i) => ({ ...p, rolling: rollArr[i] }))
  }, [correctedWeekly])

  const seasonAvg = games ? parseFloat((ptsTotal / games).toFixed(2)) : 0

  const fullSchedule = useMemo(() => {
    const rows = []
    for (let w = 1; w <= 18; w++) {
      const weekData = correctedWeekly.find(g => g.week === w)
      if (weekData) rows.push({ ...weekData, isBye: false })
      else if (player?.bye_week && player.bye_week === w) rows.push({ week: w, isBye: true })
    }
    return rows
  }, [correctedWeekly, player?.bye_week])

  const flatStats   = FLAT_STATS[pos] || FLAT_STATS['WR']
  const accentColor = teamColor?.accent || '#e8822a'

  const TABS = [
    { id: 'season',   label: 'Season Stats' },
    { id: 'gamelog',  label: 'Game Log'     },
    { id: 'trends',   label: 'Trends'       },
    { id: 'news',     label: 'News & Notes' },
    { id: 'career',   label: 'Career'       },
    { id: 'contract', label: 'Contract'     },
  ]

  if (loading) return <div className="pp-root pp-loading"><div className="pp-loading-text">Loading player…</div></div>
  if (!player) return <div className="pp-root pp-loading"><div className="pp-loading-text">Player not found.</div></div>

  return (
    <div className="pp-root">

      {/* HERO */}
      <div className="pp-header" style={headerStyle}>
        {fantasyTeam && LOGOS[fantasyTeam.abbrev] && (
          <img src={LOGOS[fantasyTeam.abbrev]} alt="" className="pp-team-watermark" aria-hidden="true"/>
        )}
        <div className="pp-team-bar" style={teamBarStyle}/>
        <div className="pp-header-inner">
          <div className="pp-identity">
            <div className="pp-headshot-wrap">
              <img src={headshotUrl(id)} alt={player.full_name} className="pp-headshot"
                onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.full_name||'P')}&background=1c2a3d&color=8a9bb0&size=200` }}/>
              {nflTeam && (
                <img src={nflLogoUrl(nflTeam)} alt={nflTeam} className="pp-nfl-logo"
                  onError={e => e.target.style.display = 'none'}/>
              )}
            </div>

            <div className="pp-bio">
              <div className="pp-pos-tag" style={{
                color: { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }[pos] || '#e8822a',
                background: '#000',
              }}>{pos}</div>
              <h1 className="pp-name">{player.full_name}</h1>
              <div className="pp-meta-row">
                <span className="pp-nfl-team">{nflTeam || 'FA'}</span>
                <span className="pp-dot">·</span>
                <span className="pp-detail">#{player.number || '—'}</span>
              </div>
              <div className="pp-meta-row pp-physical">
                <span>{formatHeight(player.height)}</span>
                <span className="pp-dot">·</span>
                <span>{player.weight ? `${player.weight} lbs` : '—'}</span>
                <span className="pp-dot">·</span>
                <span>Age {player.age || '—'}</span>
                {player.college && <><span className="pp-dot">·</span><span>{player.college}</span></>}
              </div>
              <div className="pp-meta-row pp-quick-info">
                {inSeason && ownership?.pct_owned != null && (
                  <span className="pp-owned-badge">{ownership.pct_owned}% owned</span>
                )}
                {player.bye_week && (
                  <span className="pp-bye-badge">Bye: Wk {player.bye_week}</span>
                )}
              </div>

              {/* Badges row — boom/bust removed */}
              {(player.injury_status || tradeBlockStatus) && (
                <div className="pp-badges-row">
                  {player.injury_status && (
                    <span className="pp-badge pp-badge--injury">🏥 {player.injury_status}</span>
                  )}
                  {tradeBlockStatus && (
                    <span className="pp-badge" style={{
                      color: TB_COLORS[tradeBlockStatus],
                      borderColor: `${TB_COLORS[tradeBlockStatus]}55`,
                      background: `${TB_COLORS[tradeBlockStatus]}18`,
                    }}>⇄ {TB_LABELS[tradeBlockStatus]}</span>
                  )}
                </div>
              )}

              {/* Action row */}
              <div className="pp-action-row">
                {contract ? (
                  <>
                    <span className="pp-fl">
                      <Link to={`/team/${contract.teams?.abbrev}`} className="pp-team-link"
                        style={teamColor ? { color: teamColor.accent } : {}}>
                        {contract.teams?.name}
                      </Link>
                      <span className="pp-dot" style={{ margin:'0 5px' }}>·</span>
                      ${contract.salary}M / {contract.years}yr
                    </span>
                    {manager && (
                      <button className={`pp-watchlist-btn-sm ${onWatchlist ? 'pp-watchlist-btn-sm--active' : ''}`}
                        onClick={toggleWatchlist} disabled={watchlistLoading}>
                        {watchlistLoading ? '…' : onWatchlist ? '★ Watchlist' : '☆ Watch'}
                      </button>
                    )}
                    {!isMyPlayer && (
                      <Link to={`/trade?player=${id}`} className="pp-trade-btn-sm">⇄ Trade For</Link>
                    )}
                    {isMyPlayer && (
                      <div className="pp-tb-wrap">
                        {tradeBlockPicker ? (
                          <div className="pp-tb-picker">
                            {TB_OPTIONS.map(({ status, label }) => (
                              <button key={status}
                                className={`pp-tb-opt ${tradeBlockStatus === status ? 'pp-tb-opt--active' : ''}`}
                                style={tradeBlockStatus === status ? { background: TB_COLORS[status], borderColor: TB_COLORS[status], color:'#fff' } : {}}
                                onClick={() => handleTradeBlockSet(status)} disabled={tradeBlockLoading}>
                                {label}
                              </button>
                            ))}
                            {tradeBlockStatus && (
                              <button className="pp-tb-opt pp-tb-opt--remove"
                                onClick={handleTradeBlockRemove} disabled={tradeBlockLoading}>
                                ✕ Remove
                              </button>
                            )}
                            <button className="pp-tb-cancel" onClick={() => setTradeBlockPicker(false)}>Cancel</button>
                          </div>
                        ) : (
                          <button className="pp-trade-btn-sm" onClick={() => setTradeBlockPicker(true)}>
                            {tradeBlockStatus ? `⇄ ${TB_LABELS[tradeBlockStatus]}` : '⇄ Trade Block'}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="pp-fa-badge">FREE AGENT</span>
                    {manager && (
                      <button className={`pp-watchlist-btn-sm ${onWatchlist ? 'pp-watchlist-btn-sm--active' : ''}`}
                        onClick={toggleWatchlist} disabled={watchlistLoading}>
                        {watchlistLoading ? '…' : onWatchlist ? '★ Watchlist' : '☆ Watch'}
                      </button>
                    )}
                    <Link to={'/fa-bid?player=' + id + '&name=' + encodeURIComponent(player?.full_name || '')} className="pp-bid-btn-sm">
                      + Submit Bid
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="pp-ranks">
            <VertBar value={games > 0 ? `#${posRank}` : '—'} label="POS RANK"
              pct={games > 0 ? Math.max(0, 100 - (posRank / 80) * 100) : 0} color={accentColor}/>
            <VertBar value={games > 0 ? ptsPerG.toFixed(1) : '—'} label="PTS/GAME"
              pct={games > 0 ? Math.min(100, (ptsPerG / 40) * 100) : 0} color="#3a9fd4"/>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="pp-tabs-bar">
        <div className="pp-tabs-inner">
          <div className="pp-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`pp-tab ${activeTab === t.id ? 'pp-tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>
          {!['contract','career','news'].includes(activeTab) && (
            <div className="pp-tabs-season">
              <button className="pp-season-arrow" onClick={() => setSeason(s => Math.min(CURRENT_SEASON, s+1))}>‹</button>
              <select className="pp-season-select" value={season} onChange={e => setSeason(parseInt(e.target.value))}>
                {SEASONS.map(y => <option key={y} value={y}>{y} Season</option>)}
              </select>
              <button className="pp-season-arrow" onClick={() => setSeason(s => Math.max(2019, s-1))}>›</button>
            </div>
          )}
        </div>
      </div>

      <div className="pp-tab-content">

        {/* SEASON STATS */}
        {activeTab === 'season' && (
          <div className="pp-season">
            {statsLoading && <div className="pp-inner-loading">Loading stats…</div>}
            {!statsLoading && (!games || games === 0) && (
              <div className="pp-no-data">No stats recorded for {season}.</div>
            )}
            {!statsLoading && games > 0 && (
              <>
                <div className="pp-season-header">
                  <div className="pp-season-summary">
                    <span className="pp-season-label">{season} SEASON</span>
                    <span className="pp-season-games">{games}G</span>
                    <span className="pp-season-pts" style={{ color: accentColor }}>{ptsTotal.toFixed(1)} PTS</span>
                    <span className="pp-season-ppg" style={{ color: '#3a9fd4' }}>{ptsPerG?.toFixed(1)} PTS/G</span>
                    {/* boom/bust label removed */}
                  </div>
                  <div className="pp-view-toggle">
                    <button className={`pp-toggle-btn ${viewMode==='total'?'pp-toggle-btn--active':''}`}
                      onClick={() => setViewMode('total')}>Season Total</button>
                    <button className={`pp-toggle-btn ${viewMode==='perGame'?'pp-toggle-btn--active':''}`}
                      onClick={() => setViewMode('perGame')}>Per Game</button>
                  </div>
                </div>

                <div className="pp-stat-panel">
                  <div className="pp-sbars-row">
                    {flatStats.map(s => {
                      const zero       = isZeroStat(s.key)
                      const rankSource = viewMode === 'perGame' ? posRanks?.perGame : posRanks?.total
                      const RANKABLE   = { pass_cmp:1, pass_att:1, pass_yd:1, pass_td:1, pass_int:1, pass_sack:1, rush_yd:1, rush_att:1, rush_td:1, targets:1, rec:1, rec_yd:1, rec_td:1 }
                      const rankNum    = RANKABLE[s.key] && rankSource ? rankSource[s.key] : null
                      const posLabel   = rankNum && pos ? `${pos}${rankNum}` : null
                      return (
                        <StatBar key={s.key} label={s.label}
                          value={zero ? '—' : statDisplay(s.key)}
                          pct={zero ? 0 : statPct(s.key, s.invert)}
                          isZero={zero} sectionEnd={s.sectionEnd}
                          posRankLabel={posLabel}/>
                      )
                    })}
                  </div>
                </div>

                <div className="pp-stat-panel pp-fantasy-panel">
                  <div className="pp-stat-panel-label">FANTASY</div>
                  <div className="pp-fantasy-summary">
                    {[
                      { label:'Total Pts',  val: ptsTotal.toFixed(1),  color: accentColor },
                      { label:'Pts/Game',   val: ptsPerG?.toFixed(1),  color: '#3a9fd4'   },
                      { label:'20+ Pt Wks', val: correctedWeekly.filter(w=>(w.fantasy_pts||0)>=20).length, color:'#3dba6e' },
                      { label:'10+ Pt Wks', val: correctedWeekly.filter(w=>(w.fantasy_pts||0)>=10).length, color:'#d4a843' },
                      { label:'Best Week',  val: correctedWeekly.length ? Math.max(...correctedWeekly.map(w=>w.fantasy_pts||0)).toFixed(1) : '—', color:'#a78bfa' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="pp-fant-cell">
                        <div className="pp-fant-val" style={{ color }}>{val ?? '—'}</div>
                        <div className="pp-fant-lbl">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analytics */}
                {analytics && games > 0 && (
                  <AnalyticsPanel analytics={analytics} pos={pos} accentColor={accentColor} analyticsRanks={posRanks?.analytics} playerPos={pos} />
                )}
              </>
            )}
          </div>
        )}

        {/* GAME LOG */}
        {activeTab === 'gamelog' && (
          <div className="pp-gamelog">
            {statsLoading && <div className="pp-inner-loading">Loading game log…</div>}
            {!statsLoading && correctedWeekly.length === 0 && <div className="pp-no-data">No game log data for {season}.</div>}
            {!statsLoading && correctedWeekly.length > 0 && (
              <div className="pp-gl-wrap">
                <table className="pp-gl-table">
                  <thead>
                    <tr>
                      <th>WK</th><th>OPP</th><th className="pp-gl-pts-col">PTS</th>
                      {pos==='QB'&&<><th>PASS YD</th><th>TD</th><th>INT</th><th>RUSH YD</th></>}
                      {pos==='RB'&&<><th>CAR</th><th>RUSH YD</th><th>REC</th><th>REC YD</th><th>TD</th></>}
                      {(pos==='WR'||pos==='TE')&&<><th>TGT</th><th>REC</th><th>REC YD</th><th>TD</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {fullSchedule.map(w => {
                      if (w.isBye) return (
                        <tr key={`bye-${w.week}`} className="pp-gl-row pp-gl-bye">
                          <td className="pp-gl-week">{w.week}</td>
                          <td className="pp-gl-opp" style={{color:'var(--text-muted)'}}>BYE</td>
                          <td colSpan={99} style={{color:'var(--text-muted)',fontStyle:'italic',fontSize:11}}>Bye Week</td>
                        </tr>
                      )
                      const pts = parseFloat((w.fantasy_pts||0).toFixed(2))
                      return (
                        <tr key={w.week} className="pp-gl-row">
                          <td className="pp-gl-week">{w.week}</td>
                          <td className="pp-gl-opp">{w.opponent||'—'}</td>
                          <td className="pp-gl-pts" style={{color:ptColor(pts)}}>{pts>0?pts.toFixed(2):'—'}</td>
                          {pos==='QB'&&<><td>{w.pass_yd||'—'}</td><td>{w.pass_td||'—'}</td><td>{w.pass_int||'—'}</td><td>{w.rush_yd||'—'}</td></>}
                          {pos==='RB'&&<><td>{w.rush_att||'—'}</td><td>{w.rush_yd||'—'}</td><td>{w.rec||'—'}</td><td>{w.rec_yd||'—'}</td><td>{(w.rush_td||0)+(w.rec_td||0)||'—'}</td></>}
                          {(pos==='WR'||pos==='TE')&&<><td>{w.targets||'—'}</td><td>{w.rec||'—'}</td><td>{w.rec_yd||'—'}</td><td>{w.rec_td||'—'}</td></>}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="pp-gl-totals">
                      <td colSpan={2}>TOTAL</td>
                      <td style={{color:'#e8822a'}}>{fmt(ptsTotal,1)}</td>
                      {pos==='QB'&&<><td>{fmt(totals.pass_yd)}</td><td>{fmt(totals.pass_td)}</td><td>{fmt(totals.pass_int)}</td><td>{fmt(totals.rush_yd)}</td></>}
                      {pos==='RB'&&<><td>{fmt(totals.rush_att)}</td><td>{fmt(totals.rush_yd)}</td><td>{fmt(totals.rec)}</td><td>{fmt(totals.rec_yd)}</td><td>{fmt((totals.rush_td||0)+(totals.rec_td||0))}</td></>}
                      {(pos==='WR'||pos==='TE')&&<><td>{fmt(totals.targets)}</td><td>{fmt(totals.rec)}</td><td>{fmt(totals.rec_yd)}</td><td>{fmt(totals.rec_td)}</td></>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TRENDS */}
        {activeTab === 'trends' && (
          <div className="pp-trends">
            {statsLoading && <div className="pp-inner-loading">Loading trends…</div>}
            {!statsLoading && chartData.length === 0 && <div className="pp-no-data">No trend data for {season}.</div>}
            {!statsLoading && chartData.length > 0 && (
              <>
                <div className="pp-trends-header">
                  <div className="pp-trends-title">Weekly Fantasy Points — {season}</div>
                  <div className="pp-trends-legend">
                    <span className="pp-legend-dot" style={{background:accentColor}}/> 4-wk avg
                    <span className="pp-legend-dot pp-legend-dot--dashed"/> season avg
                  </div>
                </div>
                <div className="pp-trends-chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={chartData} margin={{top:10,right:16,bottom:0,left:0}}>
                      <XAxis dataKey="week" tick={{fill:'var(--text-muted)',fontSize:11}} axisLine={false} tickLine={false}
                        label={{value:'Week',position:'insideBottom',offset:-2,fill:'var(--text-muted)',fontSize:11}}/>
                      <YAxis tick={{fill:'var(--text-muted)',fontSize:11}} axisLine={false} tickLine={false} width={32}/>
                      <Tooltip content={<TrendsTooltip/>}/>
                      <ReferenceLine y={seasonAvg} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 3"
                        label={{value:`avg ${seasonAvg}`,fill:'var(--text-muted)',fontSize:10,position:'right'}}/>
                      <Bar dataKey="pts" radius={[4,4,0,0]} maxBarSize={40}>
                        {chartData.map((entry,i) => <Cell key={i} fill={ptColor(entry.pts)} opacity={0.85}/>)}
                      </Bar>
                      <Line dataKey="rolling" type="monotone" stroke={accentColor} strokeWidth={2.5} dot={false} connectNulls/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="pp-trends-form">
                  <div className="pp-form-title">RECENT FORM</div>
                  <div className="pp-form-games">
                    {chartData.slice(-4).map((w,i) => (
                      <div key={i} className="pp-form-game">
                        <div className="pp-form-week">WK {w.week}</div>
                        <div className="pp-form-pts" style={{color:ptColor(w.pts)}}>{w.pts>0?w.pts.toFixed(1):'—'}</div>
                      </div>
                    ))}
                  </div>
                  <div className="pp-form-stats">
                    <div className="pp-form-stat"><span>Last 4 avg</span>
                      <span style={{color:accentColor}}>
                        {chartData.slice(-4).filter(w=>w.pts>0).length
                          ? fmt(chartData.slice(-4).reduce((s,w)=>s+w.pts,0)/chartData.slice(-4).filter(w=>w.pts>0).length,1):'—'}
                      </span></div>
                    <div className="pp-form-stat"><span>Season avg</span><span style={{color:'#3a9fd4'}}>{fmt(seasonAvg,1)}</span></div>
                    <div className="pp-form-stat"><span>Season high</span><span style={{color:'#3dba6e'}}>{fmt(Math.max(...chartData.map(w=>w.pts||0)),1)}</span></div>
                    <div className="pp-form-stat"><span>Games 15+</span><span>{chartData.filter(w=>w.pts>=15).length} / {games}</span></div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* NEWS & NOTES */}
        {activeTab === 'news' && (
          <div className="pp-news">
            <div className="pp-news-filters">
              <button className={`pp-news-filter-btn ${newsFilter==='health'?'pp-news-filter-btn--active':''}`}
                onClick={() => setNewsFilter('health')}>Health / Injury</button>
              <button className={`pp-news-filter-btn ${newsFilter==='transaction'?'pp-news-filter-btn--active':''}`}
                onClick={() => setNewsFilter('transaction')}>Transactions</button>
            </div>
            {newsLoading && <div className="pp-inner-loading">Loading news…</div>}
            {!newsLoading && (() => {
              const filtered = (news || []).filter(i => i.category === newsFilter)
              if (!filtered.length) {
                return <div className="pp-no-data">
                  No {newsFilter === 'health' ? 'health/injury' : 'transaction'} history recorded for this player.
                </div>
              }
              return (
                <div className="pp-news-list">
                  {filtered.map((item, i) => (
                    <div key={i} className="pp-news-item">
                      <div className="pp-news-meta">
                        <span className={`pp-news-type ${item.type === 'late_scratch' ? 'pp-news-type--urgent' : ''}`}>
                          {item.type === 'late_scratch' ? '⚠ LATE SCRATCH' : item.type.replace(/_/g, ' ')}
                        </span>
                        {item.is_new && <span className="pp-news-new">NEW</span>}
                        <span className="pp-news-time">{item.created_at ? timeAgo(new Date(item.created_at).getTime()/1000) : ''}</span>
                      </div>
                      <div className="pp-news-title">{item.headline}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* CAREER */}
        {activeTab === 'career' && (
          <div className="pp-career">
            {careerLoading && <div className="pp-inner-loading">Loading career stats…</div>}
            {!careerLoading && (!career||career.length===0) && <div className="pp-no-data">No career data found.</div>}
            {!careerLoading && career && career.length > 0 && (
              <div className="pp-career-wrap">
                <table className="pp-career-table">
                  <thead>
                    <tr>
                      <th>YEAR</th><th>G</th><th>PTS</th><th>PTS/G</th>
                      {(pos==='QB'||career.some(s=>s.pass_yd>0))&&<th>PASS YD</th>}
                      {(pos==='QB'||career.some(s=>s.pass_td>0))&&<th>PASS TD</th>}
                      {(pos==='QB'||career.some(s=>s.pass_int>0))&&<th>INT</th>}
                      {(pos!=='QB'||career.some(s=>s.rush_yd>0))&&<th>RUSH YD</th>}
                      <th>RUSH TD</th>
                      {(pos!=='QB'||career.some(s=>s.rec_yd>0))&&<th>REC YD</th>}
                      <th>REC TD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {career.map(s => (
                      <tr key={s.season} className={`pp-career-row ${s.season===CURRENT_SEASON?'pp-career-row--current':''}`}>
                        <td className="pp-career-year">{s.season}</td>
                        <td>{s.games}</td>
                        <td style={{color:accentColor,fontWeight:700}}>{fmt(calcFantasyPts(s,pos),1)}</td>
                        <td>{s.games?fmt(calcFantasyPts(s,pos)/s.games,1):'—'}</td>
                        {(pos==='QB'||career.some(c=>c.pass_yd>0))&&<td>{fmt(s.pass_yd)||'—'}</td>}
                        {(pos==='QB'||career.some(c=>c.pass_td>0))&&<td>{fmt(s.pass_td)||'—'}</td>}
                        {(pos==='QB'||career.some(c=>c.pass_int>0))&&<td>{fmt(s.pass_int)||'—'}</td>}
                        {(pos!=='QB'||career.some(c=>c.rush_yd>0))&&<td>{fmt(s.rush_yd)||'—'}</td>}
                        <td>{fmt(s.rush_td)||'—'}</td>
                        {(pos!=='QB'||career.some(c=>c.rec_yd>0))&&<td>{fmt(s.rec_yd)||'—'}</td>}
                        <td>{fmt(s.rec_td)||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pp-career-note">Stats reflect seasons with recorded data in the Sickos Only database.</div>
              </div>
            )}
          </div>
        )}

        {/* CONTRACT */}
        {activeTab === 'contract' && (
          <div className="pp-contract">
            {!contract ? (
              <div className="pp-no-data">This player is a free agent — no active contract.</div>
            ) : (
              <div className="pp-contract-grid">
                {[
                  { label:'TEAM',   val: <Link to={`/team/${contract.teams?.abbrev}`} style={teamColor?{color:teamColor.accent}:{}}>{contract.teams?.name}</Link> },
                  { label:'SALARY', val:`$${contract.salary}M`, money:true },
                  { label:'YEARS',  val:`${contract.years} yr` },
                  { label:'TYPE',   val: contract.contract_type || 'Standard' },
                  ...(contract.signing_bonus>0 ? [{ label:'SIGNING BONUS', val:`$${contract.signing_bonus}M`, money:true }] : []),
                  ...(contract.guaranteed_years>0 ? [{ label:'GUARANTEED YRS', val: contract.guaranteed_years }] : []),
                ].map(({ label, val, money }) => (
                  <div key={label} className="pp-contract-card">
                    <div className="pp-contract-label">{label}</div>
                    <div className={`pp-contract-val ${money?'pp-contract-money':''}`}>{val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
