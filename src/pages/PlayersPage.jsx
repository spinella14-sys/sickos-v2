import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers, headshotUrl } from '../hooks/useSleeper'
import './PlayersPage.css'

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF']

export default function PlayersPage() {
  const { players, loading } = usePlayers()
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState('All')
  const [nflTeam, setNflTeam] = useState('All')

  const filtered = useMemo(() => {
    if (!players) return []
    return Object.entries(players)
      .filter(([, p]) => {
        if (!p.active && !p.team) return false
        if (pos !== 'All' && p.position !== pos) return false
        if (nflTeam === 'FA') { if (p.team) return false }
        else if (nflTeam !== 'All') { if (p.team !== nflTeam) return false }
        if (search) {
          const q = search.toLowerCase()
          return (
            p.full_name?.toLowerCase().includes(q) ||
            p.first_name?.toLowerCase().includes(q) ||
            p.last_name?.toLowerCase().includes(q) ||
            p.team?.toLowerCase().includes(q)
          )
        }
        return true
      })
      .map(([id, p]) => ({ id, ...p }))
      .filter(p => ['QB','RB','WR','TE','K'].includes(p.position))
      .sort((a, b) => {
        // Sort by team first, then by position priority
        const posOrder = { QB:0, RB:1, WR:2, TE:3, K:4 }
        if (a.team && !b.team) return -1
        if (!a.team && b.team) return 1
        return (posOrder[a.position] || 9) - (posOrder[b.position] || 9) ||
          (a.last_name || '').localeCompare(b.last_name || '')
      })
      .slice(0, 200) // cap for performance
  }, [players, search, pos, nflTeam])

  // NFL teams for filter (including FA)  
  const nflTeams = useMemo(() => {
    if (!players) return []
    const teams = new Set(Object.values(players).map(p => p.team).filter(Boolean))
    return ['All', 'FA', ...Array.from(teams).sort()]
  }, [players])

  const posColor = { QB: '#e8822a', RB: '#3dba6e', WR: '#3a9fd4', TE: '#d4a843', K: '#8a9bb0' }

  return (
    <div className="players-root">
      {/* Header */}
      <div className="players-header">
        <div className="players-header-inner">
          <div>
            <h1 className="players-title">Player Database</h1>
            <p className="players-sub">Full NFL universe · Powered by Sleeper</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="players-filters">
        <div className="players-filters-inner">
          <input
            className="players-search"
            placeholder="Search players…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="players-pos-tabs">
            {POSITIONS.map(p => (
              <button
                key={p}
                className={`pos-tab ${pos === p ? 'pos-tab--active' : ''}`}
                onClick={() => setPos(p)}
                style={pos === p && posColor[p] ? { borderColor: posColor[p], color: posColor[p] } : {}}
              >
                {p}
              </button>
            ))}
          </div>
          <select
            className="players-team-select"
            value={nflTeam}
            onChange={e => setNflTeam(e.target.value)}
          >
            {nflTeams.map(t => <option key={t} value={t}>{t === 'All' ? 'All NFL Teams' : t === 'FA' ? 'Free Agents Only' : t}</option>)}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="players-content">
        {loading ? (
          <div className="players-loading">
            <div className="loading-spinner" />
            <span>Loading player universe from Sleeper…</span>
          </div>
        ) : (
          <>
            <div className="players-count">{filtered.length} players</div>
            <div className="players-grid">
              {filtered.map(p => (
                <Link to={`/player/${p.id}`} key={p.id} className="player-card">
                  <div className="player-card-img-wrap">
                    <img
                      src={headshotUrl(p.id)}
                      alt={p.full_name}
                      className="player-card-img"
                      loading="lazy"
                      onError={e => {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name||'P')}&background=1c2a3d&color=8a9bb0&size=120`
                      }}
                    />
                    <span
                      className="player-card-pos"
                      style={{ background: posColor[p.position] || 'var(--bg4)' }}
                    >
                      {p.position}
                    </span>
                  </div>
                  <div className="player-card-info">
                    <div className="player-card-name">{p.full_name}</div>
                    <div className="player-card-team">{p.team || 'FA'} · #{p.number || '—'}</div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
