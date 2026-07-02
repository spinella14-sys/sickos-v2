import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import { useAuth } from '../context/AuthContext'
import { normalizeTeamAbbrev } from '../utils/defenseRankUtils'
import './PlayerStatsPage.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '') + '/api'
const CURRENT_SEASON = new Date().getFullYear()
const SEASONS = Array.from({ length: CURRENT_SEASON - 2018 }, (_, i) => CURRENT_SEASON - i)

const NFL_TEAMS = [
  'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN',
  'DET','GB','HOU','IND','JAX','KC','LA','LAC','LV','MIA',
  'MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'
]

const BYE_WEEKS = {
  ARI:5,ATL:11,BAL:14,BUF:12,CAR:11,CHI:7,CIN:12,CLE:10,
  DAL:7,DEN:14,DET:5,GB:6,HOU:14,IND:12,JAX:12,KC:6,
  LA:6,LAC:5,LV:10,MIA:6,MIN:6,NE:14,NO:12,NYG:11,
  NYJ:12,PHI:5,PIT:12,SEA:10,SF:11,TB:11,TEN:6,WAS:14
}

const WINDOWS = [
  { value:'season',       label:'Full Season'    },
  { value:'last1',        label:'Last Week'      },
  { value:'last4',        label:'Last 4 Weeks'   },
  { value:'last8',        label:'Last 8 Weeks'   },
  { value:'last5games',   label:'Last 5 Games'   },
  { value:'last3seasons', label:'Last 3 Seasons' },
]
const POSITIONS = ['QB','RB','WR','TE','FLEX']
const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }

// tip = full tooltip label shown on header hover
const SNAP_COL = { key:'off_snp', label:'SNPS', tip:'Offensive Snaps', fmt:'int', color:false }

const COLS = {
  QB: [
    { key:'games',        label:'G',       tip:'Games Played',               fmt:'int',  color:false            },
    { key:'off_snp',      label:'SNPS',    tip:'Offensive Snaps',             fmt:'int',  color:false            },
    { key:'fantasy_pts',  label:'PTS',     tip:'Fantasy Points (Sickos)',     fmt:'dec1', color:true             },
    { key:'pass_yd',      label:'P YDS',   tip:'Passing Yards',               fmt:'int',  color:true             },
    { key:'pass_cmp',     label:'CMP',     tip:'Completions',                 fmt:'int',  color:true             },
    { key:'pass_att',     label:'ATT',     tip:'Pass Attempts',               fmt:'int',  color:false            },
    { key:'cmp_pct',      label:'CMP%',    tip:'Completion Percentage',       fmt:'pct',  color:true, rate:true  },
    { key:'pass_td',      label:'P TD',    tip:'Passing Touchdowns',          fmt:'dec1', color:true             },
    { key:'pass_int',     label:'INT',     tip:'Interceptions',               fmt:'dec1', color:true, invert:true},
    { key:'pass_sack',    label:'SCK',     tip:'Sacks Taken',                 fmt:'dec1', color:true, invert:true},
    { key:'rush_yd',      label:'R YDS',   tip:'Rushing Yards',               fmt:'int',  color:true             },
    { key:'rush_att',     label:'CAR',     tip:'Carries',                     fmt:'int',  color:false            },
    { key:'rush_td',      label:'R TD',    tip:'Rushing Touchdowns',          fmt:'dec1', color:true             },
    { key:'fumbles_lost', label:'FUM',     tip:'Fumbles Lost',                fmt:'dec1', color:true, invert:true},
  ],
  RB: [
    { key:'games',        label:'G',       tip:'Games Played',               fmt:'int',  color:false            },
    { key:'off_snp',      label:'SNPS',    tip:'Offensive Snaps',             fmt:'int',  color:false            },
    { key:'fantasy_pts',  label:'PTS',     tip:'Fantasy Points (Sickos)',     fmt:'dec1', color:true             },
    { key:'rush_yd',      label:'R YDS',   tip:'Rushing Yards',               fmt:'int',  color:true             },
    { key:'rush_att',     label:'CAR',     tip:'Carries',                     fmt:'int',  color:true             },
    { key:'ypc',          label:'YPC',     tip:'Yards Per Carry',             fmt:'dec1', color:true, rate:true  },
    { key:'rush_td',      label:'R TD',    tip:'Rushing Touchdowns',          fmt:'dec1', color:true             },
    { key:'targets',      label:'TAR',     tip:'Targets',                     fmt:'int',  color:true             },
    { key:'rec',          label:'REC',     tip:'Receptions',                  fmt:'int',  color:true             },
    { key:'catch_pct',    label:'CTH%',    tip:'Catch Rate',                  fmt:'pct',  color:true, rate:true  },
    { key:'rec_yd',       label:'C YDS',   tip:'Receiving Yards',             fmt:'int',  color:true             },
    { key:'ypr',          label:'YPR',     tip:'Yards Per Reception',         fmt:'dec1', color:true, rate:true  },
    { key:'rec_td',       label:'C TD',    tip:'Receiving Touchdowns',        fmt:'dec1', color:true             },
    { key:'fumbles_lost', label:'FUM',     tip:'Fumbles Lost',                fmt:'dec1', color:true, invert:true},
  ],
  WR: [
    { key:'games',        label:'G',       tip:'Games Played',               fmt:'int',  color:false            },
    { key:'off_snp',      label:'SNPS',    tip:'Offensive Snaps',             fmt:'int',  color:false            },
    { key:'fantasy_pts',  label:'PTS',     tip:'Fantasy Points (Sickos)',     fmt:'dec1', color:true             },
    { key:'targets',      label:'TAR',     tip:'Targets',                     fmt:'int',  color:true             },
    { key:'rec',          label:'REC',     tip:'Receptions',                  fmt:'int',  color:true             },
    { key:'catch_pct',    label:'CTH%',    tip:'Catch Rate',                  fmt:'pct',  color:true, rate:true  },
    { key:'rec_yd',       label:'REC YDS', tip:'Receiving Yards',             fmt:'int',  color:true             },
    { key:'ypr',          label:'YPR',     tip:'Yards Per Reception',         fmt:'dec1', color:true, rate:true  },
    { key:'rec_td',       label:'TD',      tip:'Receiving Touchdowns',        fmt:'dec1', color:true             },
    { key:'rush_yd',      label:'R YDS',   tip:'Rushing Yards',               fmt:'int',  color:true             },
    { key:'rush_att',     label:'CAR',     tip:'Carries',                     fmt:'int',  color:false            },
    { key:'rush_td',      label:'R TD',    tip:'Rushing Touchdowns',          fmt:'dec1', color:true             },
    { key:'fumbles_lost', label:'FUM',     tip:'Fumbles Lost',                fmt:'dec1', color:true, invert:true},
  ],
  TE: [
    { key:'games',        label:'G',       tip:'Games Played',               fmt:'int',  color:false            },
    { key:'off_snp',      label:'SNPS',    tip:'Offensive Snaps',             fmt:'int',  color:false            },
    { key:'fantasy_pts',  label:'PTS',     tip:'Fantasy Points (Sickos)',     fmt:'dec1', color:true             },
    { key:'targets',      label:'TAR',     tip:'Targets',                     fmt:'int',  color:true             },
    { key:'rec',          label:'REC',     tip:'Receptions',                  fmt:'int',  color:true             },
    { key:'catch_pct',    label:'CTH%',    tip:'Catch Rate',                  fmt:'pct',  color:true, rate:true  },
    { key:'rec_yd',       label:'REC YDS', tip:'Receiving Yards',             fmt:'int',  color:true             },
    { key:'ypr',          label:'YPR',     tip:'Yards Per Reception',         fmt:'dec1', color:true, rate:true  },
    { key:'rec_td',       label:'TD',      tip:'Receiving Touchdowns',        fmt:'dec1', color:true             },
    { key:'fumbles_lost', label:'FUM',     tip:'Fumbles Lost',                fmt:'dec1', color:true, invert:true},
  ],
  FLEX: [
    { key:'games',        label:'G',       tip:'Games Played',               fmt:'int',  color:false            },
    { key:'off_snp',      label:'SNPS',    tip:'Offensive Snaps',             fmt:'int',  color:false            },
    { key:'fantasy_pts',  label:'PTS',     tip:'Fantasy Points (Sickos)',     fmt:'dec1', color:true             },
    { key:'targets',      label:'TAR',     tip:'Targets',                     fmt:'int',  color:true             },
    { key:'rec',          label:'REC',     tip:'Receptions',                  fmt:'int',  color:true             },
    { key:'rec_yd',       label:'REC YDS', tip:'Receiving Yards',             fmt:'int',  color:true             },
    { key:'rush_yd',      label:'R YDS',   tip:'Rushing Yards',               fmt:'int',  color:true             },
    { key:'rush_att',     label:'CAR',     tip:'Carries',                     fmt:'int',  color:false            },
    { key:'all_td',       label:'TD',      tip:'All Touchdowns',              fmt:'dec1', color:true             },
    { key:'fumbles_lost', label:'FUM',     tip:'Fumbles Lost',                fmt:'dec1', color:true, invert:true},
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dispVal(player, col, viewMode) {
  const raw = player[col.key]
  if (raw === null || raw === undefined) return '—'
  if (col.key === 'games') return raw
  if (col.key === 'off_snp') {
    if (!raw || raw === 0) return '—'
    return viewMode === 'pergame' && player.games > 0
      ? (raw / player.games).toFixed(0)
      : Math.round(raw).toLocaleString()
  }
  if (col.rate) {
    if (!raw || raw === 0) return '—'
    return col.fmt === 'pct' ? raw.toFixed(1) + '%' : raw.toFixed(1)
  }
  const val = viewMode === 'pergame' && player.games > 0 ? raw / player.games : raw
  if (!val || val === 0) return '—'
  if (viewMode === 'pergame') return val.toFixed(1)
  if (col.fmt === 'int') return Math.round(val).toLocaleString()
  if (col.fmt === 'dec1') return val.toFixed(1)
  return val
}

function sortVal(player, col, viewMode) {
  const raw = player[col.key]
  if (raw === null || raw === undefined) return -Infinity
  if (col.key === 'games' || col.rate) return raw
  return viewMode === 'pergame' && player.games > 0 ? raw / player.games : raw
}

function computePercentiles(players, cols, viewMode) {
  const map = {}
  for (const col of cols) {
    if (!col.color) continue
    const vals = players.map(p => {
      if (col.rate) return p[col.key] || 0
      return viewMode === 'pergame' && p.games > 0 ? (p[col.key]||0)/p.games : (p[col.key]||0)
    }).filter(v => v > 0).sort((a,b) => a-b)
    map[col.key] = {}
    players.forEach(p => {
      let val = col.rate ? (p[col.key]||0) : (viewMode === 'pergame' && p.games > 0 ? (p[col.key]||0)/p.games : (p[col.key]||0))
      if (!val || vals.length < 2) { map[col.key][p.sleeper_id] = null; return }
      let lo = 0, hi = vals.length - 1
      while (lo < hi) { const mid = Math.floor((lo+hi)/2); if (vals[mid] < val) lo = mid+1; else hi = mid }
      const rawPct = (lo / (vals.length-1)) * 100
      map[col.key][p.sleeper_id] = col.invert ? 100 - rawPct : rawPct
    })
  }
  return map
}

function pctStyle(pct) {
  if (pct === null || pct === undefined) return {}
  if (pct >= 90) return { background:'rgba(61,186,110,0.28)', color:'#1e8a4a', fontWeight:700 }
  if (pct >= 75) return { background:'rgba(61,186,110,0.15)', color:'#2aaa5c' }
  if (pct >= 60) return { background:'rgba(61,186,110,0.07)' }
  if (pct >= 40) return {}
  if (pct >= 25) return { background:'rgba(217,79,79,0.07)' }
  if (pct >= 10) return { background:'rgba(217,79,79,0.15)', color:'#c44' }
  return { background:'rgba(217,79,79,0.28)', color:'#b33', fontWeight:700 }
}

function applyNumFilter(val, filterVal, op) {
  const n = parseFloat(filterVal)
  if (isNaN(n)) return true
  if (op === 'gte') return val >= n
  if (op === 'lte') return val <= n
  return Math.abs(val - n) < 0.01
}

function NumFilter({ label, value, onChange, op, onOpChange }) {
  return (
    <div className="ps-filter-row">
      <span className="ps-filter-label">{label}</span>
      <div className="ps-filter-num">
        <select className="ps-op-select" value={op} onChange={e => onOpChange(e.target.value)}>
          <option value="gte">≥</option>
          <option value="lte">≤</option>
          <option value="eq">=</option>
        </select>
        <input type="number" className="ps-num-input" value={value} onChange={e => onChange(e.target.value)} />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PlayerStatsPage() {
  const { manager } = useAuth()
  const myTeam = manager?.team_abbrev

  const [position, setPosition] = useState('RB')
  const [season,   setSeason]   = useState(CURRENT_SEASON)
  const [window,   setWindow]   = useState('season')
  const [viewMode, setViewMode] = useState('total')
  const [sortKey,  setSortKey]  = useState('fantasy_pts')
  const [sortDir,  setSortDir]  = useState('desc')
  const [players,  setPlayers]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [watchlist,setWatchlist]= useState(new Set())
  const [wlBusy,   setWlBusy]   = useState({})

  const [fName,        setFName]        = useState('')
  const [fNflTeam,     setFNflTeam]     = useState('All')
  const [fFantasyTeam, setFFantasyTeam] = useState('All')
  const [fMinGames,    setFMinGames]    = useState('')
  const [fMinGamesOp,  setFMinGamesOp]  = useState('gte')
  const [fMinPts,      setFMinPts]      = useState('')
  const [fMinPtsOp,    setFMinPtsOp]    = useState('gte')
  const [fMinPpg,      setFMinPpg]      = useState('')
  const [fMinPpgOp,    setFMinPpgOp]    = useState('gte')

  const isThreeSeason  = window === 'last3seasons'
  const isCurrentSeason = season === CURRENT_SEASON

  useEffect(() => { if (isThreeSeason) setViewMode('pergame') }, [isThreeSeason])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        position, season, window,
        ...(fNflTeam !== 'All' ? { nfl_team: fNflTeam } : {}),
        ...(fName ? { name: fName } : {}),
        min_games: 0,
      })
      const r = await fetch(`${API_BASE}/stats/leaderboard?${params}`)
      const data = r.ok ? await r.json() : []
      setPlayers(Array.isArray(data) ? data : [])
    } catch { setPlayers([]) }
    setLoading(false)
  }, [position, season, window, fNflTeam, fName])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setSortKey('fantasy_pts'); setSortDir('desc') }, [position])

  useEffect(() => {
    if (!myTeam) return
    fetch(`${API_BASE}/watchlist`, { headers: { 'x-team-abbrev': myTeam } })
      .then(r => r.ok ? r.json() : [])
      .then(wl => setWatchlist(new Set((Array.isArray(wl) ? wl : []).map(e => e.sleeper_id))))
      .catch(() => {})
  }, [myTeam])

  async function toggleWatchlist(sleeperId, e) {
    e.stopPropagation()
    if (!myTeam || wlBusy[sleeperId]) return
    setWlBusy(p => ({ ...p, [sleeperId]: true }))
    try {
      if (watchlist.has(sleeperId)) {
        await fetch(`${API_BASE}/watchlist/${sleeperId}`, { method:'DELETE', headers:{ 'x-team-abbrev': myTeam } })
        setWatchlist(prev => { const n = new Set(prev); n.delete(sleeperId); return n })
      } else {
        await fetch(`${API_BASE}/watchlist`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'x-team-abbrev': myTeam },
          body: JSON.stringify({ sleeper_id: sleeperId }),
        })
        setWatchlist(prev => new Set([...prev, sleeperId]))
      }
    } catch { /* ignore */ }
    setWlBusy(p => ({ ...p, [sleeperId]: false }))
  }

  const cols = COLS[position] || COLS['RB']

  const fantasyTeams = useMemo(() => {
    const teams = new Set()
    players.forEach(p => { if (p.fantasy_team?.abbrev) teams.add(p.fantasy_team.abbrev) })
    return [...teams].sort()
  }, [players])

  const filtered = useMemo(() => {
    return players.filter(p => {
      if (!applyNumFilter(p.games, fMinGames, fMinGamesOp)) return false
      if (!applyNumFilter(p.fantasy_pts, fMinPts, fMinPtsOp)) return false
      if (!applyNumFilter(p.pts_pg, fMinPpg, fMinPpgOp)) return false
      if (fFantasyTeam !== 'All') {
        if (fFantasyTeam === 'FA' && p.fantasy_team) return false
        if (fFantasyTeam !== 'FA' && p.fantasy_team?.abbrev !== fFantasyTeam) return false
      }
      return true
    })
  }, [players, fMinGames, fMinGamesOp, fMinPts, fMinPtsOp, fMinPpg, fMinPpgOp, fFantasyTeam])

  const sorted = useMemo(() => {
    const col = cols.find(c => c.key === sortKey)
    return [...filtered].sort((a, b) => {
      const av = col ? sortVal(a, col, viewMode) : (a[sortKey] ?? -Infinity)
      const bv = col ? sortVal(b, col, viewMode) : (b[sortKey] ?? -Infinity)
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [filtered, sortKey, sortDir, viewMode, cols])

  const pctMap = useMemo(() => computePercentiles(filtered, cols, viewMode), [filtered, cols, viewMode])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function clearFilters() {
    setFName(''); setFNflTeam('All'); setFFantasyTeam('All')
    setFMinGames(''); setFMinPts(''); setFMinPpg('')
  }

  const colLabel = col => {
    if (col.rate || col.key === 'games' || col.key === 'off_snp' || col.key === 'fantasy_pts') return col.label
    return viewMode === 'pergame' ? col.label + '/G' : col.label
  }

  return (
    <div className="ps-root">

      <div className="ps-pos-tabs">
        {POSITIONS.map(p => (
          <button key={p} className={`ps-pos-tab ${position === p ? 'ps-pos-tab--active' : ''}`}
            onClick={() => setPosition(p)}>{p}</button>
        ))}
      </div>

      <div className="ps-controls">
        <div className="ps-controls-left">
          <select className="ps-select" value={season} onChange={e => setSeason(parseInt(e.target.value))}>
            {SEASONS.map(y => <option key={y} value={y}>{y} Season</option>)}
          </select>
          <select className="ps-select" value={window} onChange={e => setWindow(e.target.value)}>
            {WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
        <div className="ps-view-toggle">
          <button className={`ps-toggle-btn ${viewMode === 'total' ? 'ps-toggle-btn--active' : ''}`}
            onClick={() => setViewMode('total')} disabled={isThreeSeason}>Season Total</button>
          <button className={`ps-toggle-btn ${viewMode === 'pergame' ? 'ps-toggle-btn--active' : ''}`}
            onClick={() => setViewMode('pergame')}>Per Game</button>
        </div>
        <div className="ps-controls-right">
          <span className="ps-count">{sorted.length} players</span>
        </div>
      </div>

      <div className="ps-body">
        <div className="ps-sidebar">
          <div className="ps-sidebar-title">FILTERS</div>
          <div className="ps-filter-row">
            <span className="ps-filter-label">Name</span>
            <input className="ps-text-input" placeholder="Search…" value={fName} onChange={e => setFName(e.target.value)} />
          </div>
          <div className="ps-filter-row">
            <span className="ps-filter-label">NFL Team</span>
            <select className="ps-filter-select" value={fNflTeam} onChange={e => setFNflTeam(e.target.value)}>
              <option value="All">All NFL Teams</option>
              {NFL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="ps-filter-row">
            <span className="ps-filter-label">Fantasy Status</span>
            <select className="ps-filter-select" value={fFantasyTeam} onChange={e => setFFantasyTeam(e.target.value)}>
              <option value="All">All</option>
              <option value="FA">Free Agents Only</option>
              {fantasyTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="ps-filter-divider" />
          <NumFilter label="Min Games"  value={fMinGames} onChange={setFMinGames} op={fMinGamesOp} onOpChange={setFMinGamesOp} />
          <NumFilter label="Min PTS"    value={fMinPts}   onChange={setFMinPts}   op={fMinPtsOp}   onOpChange={setFMinPtsOp}   />
          <NumFilter label="Min PTS/G"  value={fMinPpg}   onChange={setFMinPpg}   op={fMinPpgOp}   onOpChange={setFMinPpgOp}   />
          <div className="ps-filter-divider" />
          <button className="ps-clear-btn" onClick={clearFilters}>Clear Filters</button>
          <div className="ps-sidebar-note">
            {isThreeSeason
              ? `Per-game averages pooled across ${season}, ${season-1}, and ${season-2}.`
              : 'Color scaling is relative to the visible filtered set.'}
          </div>
        </div>

        <div className="ps-table-wrap">
          {loading ? (
            <div className="ps-loading"><div className="ps-spinner" /><span>Loading stats…</span></div>
          ) : sorted.length === 0 ? (
            <div className="ps-empty">No players match the current filters.</div>
          ) : (
            <table className="ps-table">
              <thead>
                <tr>
                  <th className="ps-th-rk">RK</th>
                  <th className="ps-th-player">PLAYER</th>
                  {position === 'FLEX' && <th className="ps-th-pos" data-tip="Position">POS</th>}
                  <th className="ps-th-team" data-tip="NFL Team">NFL</th>
                  {isCurrentSeason && <th className="ps-th-fantasy" data-tip="Fantasy Team">FANTASY</th>}
                  {isCurrentSeason && <th className="ps-th-bye" data-tip="Bye Week">BYE</th>}
                  {cols.map(col => (
                    <th key={col.key}
                      className={`ps-th-stat ${sortKey === col.key ? 'ps-th--active' : ''}`}
                      data-tip={col.tip || col.label}
                      onClick={() => toggleSort(col.key)}
                    >
                      {colLabel(col)}
                      {sortKey === col.key && <span className="ps-sort-arrow">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>}
                    </th>
                  ))}
                  {isCurrentSeason && myTeam && <th className="ps-th-action">ACTION</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => {
                  const isMine     = p.fantasy_team?.abbrev === myTeam
                  const isRostered = !!p.fantasy_team
                  const onWl       = watchlist.has(p.sleeper_id)
                  const byeWk      = BYE_WEEKS[p.nfl_team] || '—'

                  return (
                    <tr key={p.sleeper_id} className={`ps-row ${i % 2 === 0 ? 'ps-row--even' : ''}`}>
                      <td className="ps-td-rk">{i + 1}</td>
                      <td className="ps-td-player">
                        <div className="ps-player-cell">
                          <img
                            src={`https://sleepercdn.com/content/nfl/players/thumb/${p.sleeper_id}.jpg`}
                            alt="" className="ps-headshot"
                            onError={e => e.target.style.opacity = 0}
                          />
                          <PlayerLink playerId={p.sleeper_id} className="ps-pname">
                            {p.full_name}
                          </PlayerLink>
                        </div>
                      </td>
                      {position === 'FLEX' && (
                        <td className="ps-td-pos" style={{ color: POS_COLOR[p.position] }}>{p.position}</td>
                      )}
                      <td className="ps-td-team">{p.nfl_team || '—'}</td>
                      {isCurrentSeason && (
                        <td className="ps-td-fantasy">
                          {isRostered
                            ? <Link to={`/team/${p.fantasy_team.abbrev}`} className="ps-fantasy-link">{p.fantasy_team.abbrev}</Link>
                            : <span className="ps-fa-chip">FA</span>
                          }
                        </td>
                      )}
                      {isCurrentSeason && <td className="ps-td-bye">{byeWk}</td>}
                      {isCurrentSeason && (
                        <td className="ps-td-stat">
                          <DefenseRankBadge
                            opponent={opponents[normalizeTeamAbbrev(p.nfl_team)]?.opponent}
                            isBye={!!opponents[normalizeTeamAbbrev(p.nfl_team)] && opponents[normalizeTeamAbbrev(p.nfl_team)].opponent === null}
                            rankings={defRankings}
                          />
                        </td>
                      )}
                      {isCurrentSeason && (
                        <td className="ps-td-stat">
                          <OppRankCell
                            opponent={opponents[normalizeTeamAbbrev(p.nfl_team)]?.opponent}
                            position={position === 'FLEX' ? p.position : position}
                            rankings={defRankings}
                          />
                        </td>
                      )}
                      {cols.map(col => {
                        const pct   = pctMap[col.key]?.[p.sleeper_id] ?? null
                        const style = col.color ? pctStyle(pct) : {}
                        return (
                          <td key={col.key}
                            className={`ps-td-stat ${sortKey === col.key ? 'ps-td--active' : ''}`}
                            style={style}
                          >
                            {dispVal(p, col, viewMode)}
                          </td>
                        )
                      })}
                      {isCurrentSeason && myTeam && (
                        <td className="ps-td-action">
                          <div className="ps-action-cell">
                            <button
                              className={`ps-act-btn ${onWl ? 'ps-act-btn--wl-active' : 'ps-act-btn--wl'}`}
                              onClick={e => toggleWatchlist(p.sleeper_id, e)}
                              disabled={!!wlBusy[p.sleeper_id]}
                              title={onWl ? 'Remove from Watchlist' : 'Add to Watchlist'}
                            >
                              {wlBusy[p.sleeper_id] ? '…' : onWl ? '★' : '☆'}
                            </button>
                            {!isRostered && (
                              <Link to={`/fa-bid?player=${p.sleeper_id}&name=${encodeURIComponent(p.full_name)}`}
                                className="ps-act-btn ps-act-btn--bid" onClick={e => e.stopPropagation()}>Bid</Link>
                            )}
                            {isRostered && !isMine && (
                              <Link to={`/trade?player=${p.sleeper_id}`}
                                className="ps-act-btn ps-act-btn--trade" onClick={e => e.stopPropagation()}>Trade</Link>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
