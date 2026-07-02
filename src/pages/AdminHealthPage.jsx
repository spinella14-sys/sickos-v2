import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LOGOS } from '../data/league'
import './AdminHealthPage.css'

const API_BASE   = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const ADMIN_PW   = () => localStorage.getItem('adminPw') || ''
const ADMIN_HDRS = () => ({
  'Content-Type': 'application/json',
  'x-admin-password': ADMIN_PW(),
})

function StatusDot({ status }) {
  const map = { fresh:'green', ok:'yellow', stale:'red', none:'gray' }
  return <span className={`ah-dot ah-dot--${map[status] || 'gray'}`} />
}

function StatCard({ title, status, children }) {
  const map = { fresh:'green', ok:'yellow', stale:'red', none:'gray' }
  return (
    <div className={`ah-card ah-card--${map[status] || 'gray'}`}>
      <div className="ah-card-title">
        <StatusDot status={status} />
        {title}
      </div>
      <div className="ah-card-body">{children}</div>
    </div>
  )
}

function ActionBtn({ label, icon, onClick, loading, variant = 'default', confirm }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  const handle = async () => {
    if (confirm && !window.confirm(confirm)) return
    setBusy(true)
    setDone(null)
    try {
      const result = await onClick()
      setDone({ ok: true, msg: result })
    } catch (e) {
      setDone({ ok: false, msg: e.message })
    } finally {
      setBusy(false)
      setTimeout(() => setDone(null), 5000)
    }
  }

  return (
    <div className="ah-action-wrap">
      <button
        className={`ah-action-btn ah-action-btn--${variant}`}
        onClick={handle}
        disabled={busy || loading}
      >
        <span className="ah-action-icon">{busy ? '⏳' : icon}</span>
        {busy ? 'Running…' : label}
      </button>
      {done && (
        <span className={`ah-action-result ${done.ok ? 'ah-result--ok' : 'ah-result--err'}`}>
          {done.ok ? '✓' : '✗'} {done.msg}
        </span>
      )}
    </div>
  )
}

function ago(ts) {
  if (!ts) return 'Never'
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}

export default function AdminHealthPage() {
  const { isAdmin } = useAuth()
  const navigate    = useNavigate()

  const [health,    setHealth]    = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [overrideW, setOverrideW] = useState('')
  const [overrideS, setOverrideS] = useState('')

  const currentSeason = overrideS || health?.season || 2026
  const currentWeek   = overrideW || health?.week   || 1

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (overrideS) params.set('season', overrideS)
      if (overrideW) params.set('week',   overrideW)
      const r = await fetch(`${API_BASE}/system/health?${params}`, { headers: ADMIN_HDRS() })
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
      setHealth(await r.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [overrideS, overrideW])

  useEffect(() => {
    if (!isAdmin) { navigate('/admin'); return }
    fetchHealth()
  }, [isAdmin, fetchHealth])

  // Action helpers — each returns a short result string
  const scoreNow = async () => {
    const r = await fetch(`${API_BASE}/system/score-now`, {
      method:'POST', headers: ADMIN_HDRS(),
      body: JSON.stringify({ season: currentSeason, week: currentWeek }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    await fetchHealth()
    return `${d.players_synced} players synced, ${d.teams_scored} teams scored`
  }

  const lockNow = async () => {
    const r = await fetch(`${API_BASE}/system/lock-now`, {
      method:'POST', headers: ADMIN_HDRS(),
      body: JSON.stringify({ season: currentSeason, week: currentWeek }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    await fetchHealth()
    return d.locked === 0
      ? `No games started yet (${d.started_teams?.length || 0} NFL teams in progress)`
      : `${d.locked} players locked`
  }

  const projRefresh = async () => {
    const r = await fetch(`${API_BASE}/system/proj-refresh`, {
      method:'POST', headers: ADMIN_HDRS(),
      body: JSON.stringify({ season: currentSeason, week: currentWeek }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    await fetchHealth()
    return `${d.count} projections cached`
  }

  const markFinal = async () => {
    const r = await fetch(`${API_BASE}/system/mark-final`, {
      method:'POST', headers: ADMIN_HDRS(),
      body: JSON.stringify({ season: currentSeason, week: currentWeek }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    await fetchHealth()
    return `${d.marked_final} matchups marked final`
  }

  const unlockAll = async () => {
    const r = await fetch(`${API_BASE}/system/unlock-all`, {
      method:'POST', headers: ADMIN_HDRS(),
      body: JSON.stringify({ season: currentSeason, week: currentWeek }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    await fetchHealth()
    return `${d.unlocked} players unlocked`
  }

  const seedWeek = async () => {
    const r = await fetch(`${API_BASE}/lineup/seed`, {
      method:'POST', headers: ADMIN_HDRS(),
      body: JSON.stringify({ season: currentSeason, week: currentWeek }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    await fetchHealth()
    return `${d.rows_created} lineup rows seeded`
  }

  const nfl  = health?.nfl_state
  const pw   = health?.player_weeks
  const lu   = health?.lineups
  const proj = health?.projections
  const matchups = health?.matchups || []

  return (
    <div className="ah-root">
      {/* Header */}
      <div className="ah-header">
        <div className="ah-header-inner">
          <div>
            <h1 className="ah-title">System Health</h1>
            <p className="ah-sub">
              {nfl
                ? `${nfl.season} · Week ${nfl.display_week || nfl.week} · ${(nfl.season_type || '').toUpperCase()}`
                : 'Loading NFL state…'}
            </p>
          </div>
          <div className="ah-header-right">
            {/* Week override for testing */}
            <div className="ah-override">
              <label>Season</label>
              <input type="number" value={overrideS} placeholder={health?.season || 2026}
                onChange={e => setOverrideS(e.target.value)} className="ah-override-input" />
              <label>Week</label>
              <input type="number" value={overrideW} placeholder={health?.week || 1}
                onChange={e => setOverrideW(e.target.value)} className="ah-override-input" />
            </div>
            <button className="ah-refresh-btn" onClick={fetchHealth} disabled={loading}>
              {loading ? '⏳' : '↻'} {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        {error && <div className="ah-error">⚠ {error}</div>}
      </div>

      <div className="ah-body">

        {/* Status cards */}
        <div className="ah-cards">
          <StatCard title="NFL STATE" status={nfl ? 'fresh' : 'none'}>
            {nfl ? (
              <>
                <div className="ah-stat"><span>Season</span><strong>{nfl.season}</strong></div>
                <div className="ah-stat"><span>Week</span><strong>{nfl.display_week || nfl.week}</strong></div>
                <div className="ah-stat"><span>Type</span><strong>{nfl.season_type}</strong></div>
              </>
            ) : <span className="ah-na">Unavailable</span>}
          </StatCard>

          <StatCard title="PLAYER WEEKS" status={pw?.status || 'none'}>
            <div className="ah-stat"><span>This week</span><strong>{pw?.count_this_week ?? 0} rows</strong></div>
            <div className="ah-stat"><span>All time</span><strong>{(pw?.total_all_time ?? 0).toLocaleString()} rows</strong></div>
            <div className="ah-stat"><span>Last sync</span><strong>{ago(pw?.last_updated)}</strong></div>
          </StatCard>

          <StatCard title="LINEUP LOCKS" status={lu?.total > 0 ? (lu?.locked > 0 ? 'ok' : 'none') : 'none'}>
            <div className="ah-stat"><span>Locked</span><strong>{lu?.locked ?? 0}</strong></div>
            <div className="ah-stat"><span>Unlocked</span><strong>{lu?.unlocked ?? 0}</strong></div>
            <div className="ah-stat"><span>Total</span><strong>{lu?.total ?? 0}</strong></div>
          </StatCard>

          <StatCard title="PROJECTIONS" status={proj?.status || 'none'}>
            <div className="ah-stat"><span>Cached</span><strong>{proj?.count ?? 0} players</strong></div>
            <div className="ah-stat"><span>Age</span><strong>{proj?.age_minutes != null ? `${proj.age_minutes}m` : 'Never'}</strong></div>
            <div className="ah-stat"><span>Updated</span><strong>{ago(proj?.last_updated)}</strong></div>
          </StatCard>
        </div>

        <div className="ah-main">

          {/* Matchup scoreboard */}
          <div className="ah-section">
            <div className="ah-section-title">
              Week {currentWeek} Matchups
              <span className="ah-section-sub">({matchups.length} scheduled)</span>
            </div>
            {matchups.length === 0 ? (
              <div className="ah-empty">No matchups seeded for this week</div>
            ) : (
              <div className="ah-matchup-grid">
                {matchups.map(m => {
                  const home = parseFloat(m.home_score || 0)
                  const away = parseFloat(m.away_score || 0)
                  const homeWin = home > away
                  return (
                    <div key={m.id} className="ah-matchup-row">
                      <div className={`ah-matchup-team ${homeWin && m.status==='final' ? 'ah-team--win' : ''}`}>
                        <img src={LOGOS[m.home_team]} alt="" className="ah-matchup-logo"
                          onError={e => e.target.style.opacity = 0} />
                        <span>{m.home_team}</span>
                        <strong>{home.toFixed(2)}</strong>
                      </div>
                      <span className={`ah-matchup-status ah-ms--${m.status}`}>
                        {m.status === 'in_progress' ? '● LIVE' : m.status === 'final' ? 'FINAL' : 'UPCOMING'}
                      </span>
                      <div className={`ah-matchup-team ah-matchup-team--right ${!homeWin && m.status==='final' ? 'ah-team--win' : ''}`}>
                        <strong>{away.toFixed(2)}</strong>
                        <span>{m.away_team}</span>
                        <img src={LOGOS[m.away_team]} alt="" className="ah-matchup-logo"
                          onError={e => e.target.style.opacity = 0} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Manual controls */}
          <div className="ah-section">
            <div className="ah-section-title">
              Manual Controls
              <span className="ah-section-sub">S{currentSeason} W{currentWeek}</span>
            </div>

            <div className="ah-controls-grid">
              <div className="ah-control-group">
                <div className="ah-control-group-label">Scoring</div>
                <ActionBtn icon="▶" label="Simulate Scoring" variant="orange" onClick={scoreNow}
                  confirm={`Run live scoring sync for Season ${currentSeason} Week ${currentWeek}? This will fetch stats from Sleeper and update matchup scores.`} />
                <ActionBtn icon="✓" label="Mark Week Final" variant="green" onClick={markFinal}
                  confirm={`Mark all Week ${currentWeek} matchups as FINAL? This cannot be undone easily.`} />
              </div>

              <div className="ah-control-group">
                <div className="ah-control-group-label">Lineups</div>
                <ActionBtn icon="🔒" label="Lock Players Now" variant="default" onClick={lockNow} />
                <ActionBtn icon="🔓" label="Unlock All Players" variant="danger" onClick={unlockAll}
                  confirm="Emergency unlock — this will unlock ALL players for this week. Only use if there was a data error."  />
              </div>

              <div className="ah-control-group">
                <div className="ah-control-group-label">Data</div>
                <ActionBtn icon="↻" label="Refresh Projections" variant="default" onClick={projRefresh} />
                <ActionBtn icon="⟩" label="Seed Week Lineups" variant="default" onClick={seedWeek}
                  confirm={`Seed lineup rows for Season ${currentSeason} Week ${currentWeek}? Will error if already seeded.`} />
              </div>
            </div>
          </div>

          {/* Cron schedule reminder */}
          <div className="ah-section ah-section--dim">
            <div className="ah-section-title">Automatic Cron Schedule</div>
            <div className="ah-cron-table">
              {[
                { cron:'*/5 * * * 0,1,4', label:'Live Scoring',  desc:'Every 5 min · Sun / Mon / Thu game days' },
                { cron:'*/10 * * * 0,1,4', label:'Lineup Lock',   desc:'Every 10 min · Sun / Mon / Thu' },
                { cron:'0 * * * 2,3,4,5',  label:'Projections',   desc:'Top of every hour · Tue – Fri' },
                { cron:'0 2 * * 2',         label:'Mark Final',    desc:'2:00 AM every Tuesday' },
              ].map(r => (
                <div key={r.label} className="ah-cron-row">
                  <code className="ah-cron-expr">{r.cron}</code>
                  <span className="ah-cron-label">{r.label}</span>
                  <span className="ah-cron-desc">{r.desc}</span>
                  <span className="ah-cron-note">Active only when season_type = regular</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
