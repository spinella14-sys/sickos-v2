import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import { calcFantasyPts, isRegularSeason } from '../utils/scoringUtils'
import './WatchlistPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const CURRENT_SEASON = new Date().getFullYear()
const POS_COLOR = { QB: '#e8822a', RB: '#3dba6e', WR: '#3a9fd4', TE: '#d4a843' }

function headshotUrl(id) {
  return `https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`
}

export default function WatchlistPage() {
  const { manager } = useAuth()
  const [entries,  setEntries]  = useState([])
  const [players,  setPlayers]  = useState({}) // sleeper_id → { player, contract, stats }
  const [loading,  setLoading]  = useState(true)
  const [removing, setRemoving] = useState({})
  const inSeason = isRegularSeason()

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'x-team-abbrev': manager?.team_abbrev || '',
  }), [manager])

  const loadWatchlist = useCallback(async () => {
    if (!manager?.team_abbrev) return
    setLoading(true)
    try {
      const r = await fetch(`${API}/watchlist`, { headers: headers() })
      const data = await r.json()
      setEntries(Array.isArray(data) ? data : [])

      // Fetch player details for each entry
      const details = {}
      await Promise.all((Array.isArray(data) ? data : []).map(async entry => {
        try {
          const [bioRes, statsRes] = await Promise.all([
            fetch(`${API}/players/${entry.sleeper_id}`),
            fetch(`${API}/stats/player/${entry.sleeper_id}?season=${CURRENT_SEASON}`),
          ])
          const bio   = bioRes.ok   ? await bioRes.json()   : null
          const stats = statsRes.ok ? await statsRes.json() : null
          const player = bio?.player || bio
          const pos    = player?.position || 'WR'
          const weekly = stats?.weekly || []
          const games  = stats?.games  || 0
          const totals = stats?.totals || {}
          const pts    = calcFantasyPts(totals, pos)
          const ppg    = games > 0 ? (pts / games).toFixed(1) : null
          details[entry.sleeper_id] = {
            player,
            contract: bio?.contract || null,
            games,
            pts,
            ppg,
            weekly,
          }
        } catch { /* skip */ }
      }))
      setPlayers(details)
    } catch (e) {
      console.error('Watchlist load error:', e)
    }
    setLoading(false)
  }, [manager, headers])

  useEffect(() => { loadWatchlist() }, [loadWatchlist])

  async function removeFromWatchlist(sleeperId) {
    setRemoving(p => ({ ...p, [sleeperId]: true }))
    try {
      await fetch(`${API}/watchlist/${sleeperId}`, {
        method: 'DELETE',
        headers: headers(),
      })
      setEntries(prev => prev.filter(e => e.sleeper_id !== sleeperId))
    } catch { /* ignore */ }
    setRemoving(p => ({ ...p, [sleeperId]: false }))
  }

  if (!manager) return (
    <div className="wl-root">
      <div className="wl-empty">Sign in to view your watchlist.</div>
    </div>
  )

  return (
    <div className="wl-root">
      <div className="wl-header">
        <div>
          <h1 className="wl-title">My Watchlist</h1>
          <p className="wl-sub">Players you're monitoring. Click any name to open their card.</p>
        </div>
        <div className="wl-count-badge">{entries.length} player{entries.length !== 1 ? 's' : ''}</div>
      </div>

      {loading ? (
        <div className="wl-loading">
          <div className="wl-spinner" />
          <span>Loading watchlist…</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="wl-empty">
          <div className="wl-empty-icon">👁</div>
          <div className="wl-empty-title">Your watchlist is empty</div>
          <div className="wl-empty-sub">Open any player card and click "Add to Watchlist" to start tracking players.</div>
          <Link to="/players" className="wl-browse-btn">Browse Players →</Link>
        </div>
      ) : (
        <div className="wl-table-wrap">
          <table className="wl-table">
            <thead>
              <tr>
                <th className="wl-th-player">PLAYER</th>
                <th>STATUS</th>
                <th>AGE</th>
                {inSeason && <th>% OWN</th>}
                <th>FPTS</th>
                <th>PPG</th>
                <th>CONTRACT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const d        = players[entry.sleeper_id]
                const p        = d?.player || {}
                const contract = d?.contract || null
                const pos      = p.position || '—'
                const sid      = entry.sleeper_id

                return (
                  <tr key={sid} className="wl-row">
                    <td className="wl-td-player">
                      <div className="wl-player-wrap">
                        <img
                          src={headshotUrl(sid)}
                          alt={p.full_name}
                          className="wl-headshot"
                          onError={e => e.target.style.opacity = 0}
                        />
                        <div className="wl-player-info">
                          <PlayerLink playerId={sid} className="wl-pname">
                            {p.full_name || sid}
                          </PlayerLink>
                          <div className="wl-pmeta">
                            <span style={{ color: POS_COLOR[pos] }}>{pos}</span>
                            <span>{p.nfl_team || 'FA'}</span>
                            {p.injury_status && (
                              <span className="wl-inj">{p.injury_status}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {contract ? (
                        <span className="wl-owned-chip">
                          <Link to={`/team/${contract.teams?.abbrev}`} className="wl-team-link">
                            {contract.teams?.abbrev}
                          </Link>
                        </span>
                      ) : (
                        <span className="wl-fa-chip">FA</span>
                      )}
                    </td>
                    <td className="wl-td-stat">{p.age || '—'}</td>
                    {inSeason && <td className="wl-td-stat">—</td>}
                    <td className="wl-td-stat wl-pts">{d?.pts != null ? d.pts.toFixed(1) : '—'}</td>
                    <td className="wl-td-stat">{d?.ppg || '—'}</td>
                    <td className="wl-td-stat">
                      {contract ? `$${parseFloat(contract.salary||0).toFixed(2)} / ${contract.years}yr` : '—'}
                    </td>
                    <td>
                      <button
                        className="wl-remove-btn"
                        onClick={() => removeFromWatchlist(sid)}
                        disabled={removing[sid]}
                      >
                        {removing[sid] ? '…' : '✕ Remove'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}