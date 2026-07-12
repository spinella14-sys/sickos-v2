import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import DefenseRankBadge, { OppRankCell } from '../components/DefenseRankBadge'
import NewsCard from '../components/NewsCard'
import { headshotUrl } from '../hooks/useSleeper'
import { normalizeTeamAbbrev } from '../utils/defenseRankUtils'
import './FreeAgentsPage.css'
import '../components/DefenseRankBadge.css'
import '../components/NewsCard.css'

const API_BASE       = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const CURRENT_SEASON = new Date().getFullYear()

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE']
const POS_COLOR = { QB: '#e8822a', RB: '#3dba6e', WR: '#3a9fd4', TE: '#d4a843' }

const NFL_TEAMS = [
  'All','ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE',
  'DAL','DEN','DET','GB','HOU','IND','JAX','KC','LA',
  'LAC','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI',
  'PIT','SEA','SF','TB','TEN','WAS','FA'
]

const INJ_COLOR = { Q:'#d4a843', D:'#d94f4f', O:'#d94f4f', IR:'#d94f4f', PUP:'#d94f4f' }

function fmt1(n) {
  if (n == null || n === 0) return '—'
  return Number(n).toFixed(1)
}

export default function FreeAgentsPage() {
  // NFL schedule + defense rankings (real-world NFL schedule, not fantasy matchups)
  const [opponents,   setOpponents]   = useState({})   // { TEAM: { opponent, is_home } }
  const [defRankings, setDefRankings] = useState(null) // { QB:{TEAM:{rank,ppg,total_teams}}, ... }
  const [schedWeek,   setSchedWeek]   = useState(null)
  const [schedSeason, setSchedSeason] = useState(null)
  const [transNewsIds, setTransNewsIds] = useState(new Set())
  const [newsModal,    setNewsModal]    = useState(null) // { sleeperId, name, tab }

  useEffect(() => {
    fetch(`${API_BASE}/news/transactions-active?days=14`)
      .then(r => r.ok ? r.json() : [])
      .then(ids => setTransNewsIds(new Set(ids)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/schedule/current-week`)
      .then(r => r.json())
      .then(({ season, week }) => {
        setSchedSeason(season)
        setSchedWeek(week)
        fetch(`${API_BASE}/schedule/opponents?season=${season}&week=${week}`)
          .then(r => r.ok ? r.json() : {})
          .then(setOpponents)
          .catch(() => {})
        fetch(`${API_BASE}/schedule/defense-rankings?season=${season}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => setDefRankings(d?.rankings || null))
          .catch(() => {})
      })
      .catch(() => {})
  }, [])

  const { manager } = useAuth()
  const myTeam = manager?.team_abbrev

  const [allPlayers,   setAllPlayers]   = useState([])
  const [statsMap,     setStatsMap]     = useState({})
  const [ownershipMap,  setOwnershipMap]  = useState({})
  const [ownershipMode, setOwnershipMode] = useState('adp') // 'adp' | 'owned'
  const [rosteredIds,  setRosteredIds]  = useState(new Set())
  const [watchlist,    setWatchlist]    = useState(new Set())
  const [wlBusy,       setWlBusy]       = useState({})
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [pos,          setPos]          = useState('All')
  const [nflTeam,      setNflTeam]      = useState('All')
  const [showRostered, setShowRostered] = useState(false)
  const [sortKey,      setSortKey]      = useState('pts_pg')
  const [sortDir,      setSortDir]      = useState('desc')

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/players?mode=fa`)
      .then(r => r.ok ? r.json() : { players: [] })
      .then(d => { setAllPlayers(d.players || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      const [qbRes, flexRes] = await Promise.all([
        fetch(`${API_BASE}/stats/leaderboard?position=QB&season=${CURRENT_SEASON}&window=season&min_games=0`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/stats/leaderboard?position=FLEX&season=${CURRENT_SEASON}&window=season&min_games=0`).then(r => r.ok ? r.json() : []),
      ])
      const all = [...(Array.isArray(qbRes) ? qbRes : []), ...(Array.isArray(flexRes) ? flexRes : [])]
      const byPos = {}
      all.forEach(p => { if (!byPos[p.position]) byPos[p.position] = []; byPos[p.position].push(p) })
      Object.values(byPos).forEach(g => g.sort((a, b) => b.pts_pg - a.pts_pg))
      const map = {}
      Object.entries(byPos).forEach(([pos, group]) => {
        group.forEach((p, i) => { map[p.sleeper_id] = { fantasy_pts: p.fantasy_pts, pts_pg: p.pts_pg, games: p.games, pos_rank: i + 1 } })
      })
      setStatsMap(map)
    }
    fetchStats().catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/stats/ownership-bulk`)
      .then(r => r.ok ? r.json() : { __mode: 'adp', data: {} })
      .then(res => {
        const mode = res.__mode || 'owned'
        const map  = res.data || res  // handle old format too
        setOwnershipMode(mode)
        setOwnershipMap(map)
      })

  useEffect(() => {
    fetch(`${API_BASE}/contracts?season=${CURRENT_SEASON}`)
      .then(r => r.ok ? r.json() : [])
      .then(contracts => setRosteredIds(new Set((contracts || []).map(c => c.sleeper_id))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!myTeam) return
    fetch(`${API_BASE}/watchlist`, { headers: { 'x-team-abbrev': myTeam } })
      .then(r => r.ok ? r.json() : [])
      .then(wl => setWatchlist(new Set((Array.isArray(wl) ? wl : []).map(e => e.sleeper_id))))
      .catch(() => {})
  }, [myTeam])

  async function toggleWatchlist(sleeperId, e) {
    e.preventDefault(); e.stopPropagation()
    if (!myTeam || wlBusy[sleeperId]) return
    setWlBusy(p => ({ ...p, [sleeperId]: true }))
    try {
      if (watchlist.has(sleeperId)) {
        await fetch(`${API_BASE}/watchlist/${sleeperId}`, { method: 'DELETE', headers: { 'x-team-abbrev': myTeam } })
        setWatchlist(prev => { const n = new Set(prev); n.delete(sleeperId); return n })
      } else {
        await fetch(`${API_BASE}/watchlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-team-abbrev': myTeam },
          body: JSON.stringify({ sleeper_id: sleeperId }),
        })
        setWatchlist(prev => new Set([...prev, sleeperId]))
      }
    } catch { /* ignore */ }
    setWlBusy(p => ({ ...p, [sleeperId]: false }))
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let rows = allPlayers.filter(p => {
      if (!showRostered && rosteredIds.has(p.sleeper_id)) return false
      if (pos !== 'All' && p.position !== pos) return false
      if (nflTeam === 'FA') { if (p.nfl_team) return false }
      else if (nflTeam !== 'All') { if (p.nfl_team !== nflTeam) return false }
      if (search) {
        const q = search.toLowerCase()
        return p.full_name?.toLowerCase().includes(q) || p.nfl_team?.toLowerCase().includes(q)
      }
      return true
    })

    rows = [...rows].sort((a, b) => {
      let av, bv
      if (sortKey === 'pts_pg') {
        av = statsMap[a.sleeper_id]?.pts_pg ?? -1
        bv = statsMap[b.sleeper_id]?.pts_pg ?? -1
      } else if (sortKey === 'fantasy_pts') {
        av = statsMap[a.sleeper_id]?.fantasy_pts ?? -1
        bv = statsMap[b.sleeper_id]?.fantasy_pts ?? -1
      } else if (sortKey === 'pct_owned') {
        av = ownershipMap[a.sleeper_id] ?? -1
        bv = ownershipMap[b.sleeper_id] ?? -1
      } else if (sortKey === 'pos_rank') {
        av = statsMap[a.sleeper_id]?.pos_rank ?? 9999
        bv = statsMap[b.sleeper_id]?.pos_rank ?? 9999
        return sortDir === 'asc' ? bv - av : av - bv
      } else if (sortKey === 'name') {
        av = a.full_name || ''; bv = b.full_name || ''
        return sortDir === 'asc' ? bv.localeCompare(av) : av.localeCompare(bv)
      } else if (sortKey === 'age') {
        av = a.age ?? 99; bv = b.age ?? 99
      } else {
        av = a.search_rank ?? 9999; bv = b.search_rank ?? 9999
        return av - bv
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return rows
  }, [allPlayers, rosteredIds, pos, nflTeam, search, showRostered, sortKey, sortDir, statsMap, ownershipMap])

  const availableCount = allPlayers.filter(p => !rosteredIds.has(p.sleeper_id)).length

  function SortHeader({ colKey, label, title }) {
    const active = sortKey === colKey
    return (
      <span className={`fa-th-sortable ${active ? 'fa-th--active' : ''}`}
        onClick={() => toggleSort(colKey)} title={title}>
        {label}{active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </span>
    )
  }

  return (
    <div className="fa-root">
      <div className="fa-header">
        <div className="fa-header-inner">
          <div>
            <h1 className="fa-title">Free Agents</h1>
            <p className="fa-sub">
              {loading ? 'Loading…' : `${availableCount.toLocaleString()} available · ${allPlayers.length.toLocaleString()} in pool`}
            </p>
          </div>
          <Link to="/fa-bid" className="fa-bid-btn">Submit FA Bid →</Link>
        </div>
      </div>

      <div className="fa-filters">
        <div className="fa-filters-inner">
          <input className="fa-search" placeholder="Search players or NFL teams…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <div className="fa-pos-tabs">
            {POSITIONS.map(p => (
              <button key={p} className={`fa-pos-tab ${pos === p ? 'active' : ''}`}
                onClick={() => setPos(p)}
                style={pos === p && POS_COLOR[p] ? { borderColor: POS_COLOR[p], color: POS_COLOR[p] } : {}}>
                {p}
              </button>
            ))}
          </div>
          <select className="fa-team-select" value={nflTeam} onChange={e => setNflTeam(e.target.value)}>
            {NFL_TEAMS.map(t => (
              <option key={t} value={t}>
                {t === 'All' ? 'All NFL Teams' : t === 'FA' ? 'Real-life FAs Only' : t}
              </option>
            ))}
          </select>
          <label className="fa-rostered-toggle">
            <input type="checkbox" checked={showRostered} onChange={e => setShowRostered(e.target.checked)} />
            Show rostered
          </label>
        </div>
      </div>

      <div className="fa-content">
        {loading ? (
          <div className="fa-loading"><div className="fa-spinner" /><span>Loading player pool…</span></div>
        ) : (
          <>
            <div className="fa-count">{filtered.length.toLocaleString()} players</div>
            <div className="fa-table-wrap">
              <table className="fa-table">
                <thead>
                  <tr className="fa-thead-row">
                    {/* Player column — name + injury status underneath */}
                    <th className="fa-th fa-th-player"><SortHeader colKey="name" label="PLAYER" title="Player Name" /></th>
                    <th className="fa-th"><SortHeader colKey="default" label="NFL" title="NFL Team" /></th>
                    <th className="fa-th">POS</th>
                    <th className="fa-th"><SortHeader colKey="age" label="AGE" title="Age" /></th>
                    <th className="fa-th">EXP</th>
                    <th className="fa-th"><SortHeader colKey="fantasy_pts" label="PTS" title="Season Fantasy Points" /></th>
                    <th className="fa-th"><SortHeader colKey="pts_pg" label="PTS/G" title="Fantasy Points Per Game" /></th>
                    <th className="fa-th"><SortHeader colKey="pos_rank" label="POS RK" title="Position Rank by PTS/G" /></th>
                    <th className="fa-th"><SortHeader colKey="pct_owned" label={ownershipMode === 'adp' ? 'ADP RK' : '% OWN'} title="% Owned" /></th>
                    <th className="fa-th">BYE</th>
                    <th className="fa-th">OPP</th>
                    <th className="fa-th">OPP RNK</th>
                    {/* ACTION — merged: watchlist star + bid button (no separate STATUS column) */}
                    <th className="fa-th fa-th-action">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map(p => {
                    const isRostered = rosteredIds.has(p.sleeper_id)
                    const onWl       = watchlist.has(p.sleeper_id)
                    const st         = statsMap[p.sleeper_id]
                    const pctOwned   = {ownershipMap[p.sleeper_id]
                    ? ownershipMode === 'adp'
                      ? `#${ownershipMap[p.sleeper_id]}`
                      : `${ownershipMap[p.sleeper_id].toFixed(1)}%`
                    : '—'}
                    const injColor   = p.injury_status ? INJ_COLOR[p.injury_status] || '#888' : null

                    return (
                      <tr key={p.sleeper_id} className={`fa-row ${isRostered ? 'fa-row--rostered' : ''}`}>

                        {/* Player: headshot + name + injury status under name */}
                        <td className="fa-td fa-td-player">
                          <div className="fa-player-cell">
                            <img src={headshotUrl(p.sleeper_id)} alt={p.full_name}
                              className="fa-headshot" loading="lazy"
                              onError={e => e.target.style.opacity = 0} />
                            <div className="fa-player-info">
                              <PlayerLink playerId={p.sleeper_id} className="fa-pname">
                                {p.full_name}
                              </PlayerLink>
                              {/* Injury status under name — replaces college, clickable for history */}
                              {p.injury_status ? (
                                <span
                                  className="fa-inj-sub"
                                  style={{ color: injColor || '#888', cursor: 'pointer', textDecoration: 'underline' }}
                                  onClick={e => { e.preventDefault(); e.stopPropagation(); setNewsModal({ sleeperId: p.sleeper_id, name: p.full_name, tab: 'health' }) }}
                                  title="Click for injury history"
                                >
                                  {p.injury_status === 'Q' ? 'Questionable'
                                    : p.injury_status === 'D' ? 'Doubtful'
                                    : p.injury_status === 'O' ? 'Out'
                                    : p.injury_status === 'IR' ? 'Injured Reserve'
                                    : p.injury_status === 'PUP' ? 'PUP List'
                                    : p.injury_status}
                                </span>
                              ) : isRostered ? (
                                <span className="fa-rostered-sub">Rostered</span>
                              ) : null}
                              {transNewsIds.has(p.sleeper_id) && (
                                <span
                                  className="fa-news-icon"
                                  onClick={e => { e.preventDefault(); e.stopPropagation(); setNewsModal({ sleeperId: p.sleeper_id, name: p.full_name, tab: 'transaction' }) }}
                                  title="Recent transaction news"
                                >📰</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="fa-td fa-td-center">
                          {p.nfl_team
                            ? <span className="fa-nfl-team">{p.nfl_team}</span>
                            : <span className="fa-no-team">FA</span>}
                        </td>
                        <td className="fa-td fa-td-center" style={{ color: POS_COLOR[p.position], fontWeight: 700 }}>
                          {p.position}
                        </td>
                        <td className="fa-td fa-td-center fa-stat">{p.age || '—'}</td>
                        <td className="fa-td fa-td-center fa-stat">
                          {p.years_exp === 0 ? <span className="fa-rookie">R</span> : p.years_exp != null ? `${p.years_exp}yr` : '—'}
                        </td>
                        <td className="fa-td fa-td-center fa-stat fa-pts">{st ? fmt1(st.fantasy_pts) : '—'}</td>
                        <td className="fa-td fa-td-center fa-stat fa-pts">{st ? fmt1(st.pts_pg) : '—'}</td>
                        <td className="fa-td fa-td-center fa-stat">
                          {st?.pos_rank ? <span className="fa-pos-rank">{p.position}{st.pos_rank}</span> : '—'}
                        </td>
                        <td className="fa-td fa-td-center fa-stat">
                          {pctOwned != null ? `${pctOwned}%` : '—'}
                        </td>
                        <td className="fa-td fa-td-center fa-stat">{p.bye_week || '—'}</td>
                        <td className="fa-td fa-td-center fa-stat fa-opp">
                          <DefenseRankBadge
                            opponent={opponents[normalizeTeamAbbrev(p.nfl_team)]?.opponent}
                            isBye={!!opponents[normalizeTeamAbbrev(p.nfl_team)] && opponents[normalizeTeamAbbrev(p.nfl_team)].opponent === null}
                            rankings={defRankings}
                          />
                        </td>
                        <td className="fa-td fa-td-center fa-stat">
                          <OppRankCell
                            opponent={opponents[normalizeTeamAbbrev(p.nfl_team)]?.opponent}
                            position={p.position}
                            rankings={defRankings}
                          />
                        </td>

                        {/* Single ACTION column: watchlist star + bid/rostered */}
                        <td className="fa-td fa-col-action">
                          {myTeam && (
                            <button
                              className={`fa-wl-btn ${onWl ? 'fa-wl-btn--active' : ''}`}
                              onClick={e => toggleWatchlist(p.sleeper_id, e)}
                              disabled={!!wlBusy[p.sleeper_id]}
                              title={onWl ? 'Remove from Watchlist' : 'Add to Watchlist'}
                            >
                              {wlBusy[p.sleeper_id] ? '…' : onWl ? '★' : '☆'}
                            </button>
                          )}
                          {isRostered ? (
                            <span className="fa-rostered-badge">Rostered</span>
                          ) : (
                            <Link
                              to={`/fa-bid?player=${p.sleeper_id}&name=${encodeURIComponent(p.full_name || '')}`}
                              className="fa-bid-row-btn"
                              onClick={e => e.stopPropagation()}
                            >Bid</Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {filtered.length > 500 && (
                <div className="fa-overflow-note">
                  Showing 500 of {filtered.length.toLocaleString()} — refine filters to narrow results.
                </div>
              )}
            </div>
          </>
        )}
      </div>

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
