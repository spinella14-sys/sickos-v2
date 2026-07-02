import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TEAMS, LOGOS } from '../data/league'
import './DraftCentralPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function StatusBadge({ status, label }) {
  const map = {
    active:      { color: '#3dba6e', bg: 'rgba(61,186,110,0.12)',  dot: true  },
    wave_open:   { color: '#3dba6e', bg: 'rgba(61,186,110,0.12)',  dot: true  },
    pre_draft:   { color: '#8b949e', bg: 'rgba(139,148,158,0.12)', dot: false },
    pre_rfa:     { color: '#8b949e', bg: 'rgba(139,148,158,0.12)', dot: false },
    pre_ufa:     { color: '#8b949e', bg: 'rgba(139,148,158,0.12)', dot: false },
    paused:      { color: '#d4a843', bg: 'rgba(212,168,67,0.12)',  dot: false },
    completed:   { color: '#3a9fd4', bg: 'rgba(58,159,212,0.12)', dot: false },
  }
  const cfg = map[status] || map.pre_draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
      textTransform: 'uppercase', padding: '3px 8px',
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44`,
    }}>
      {cfg.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, animation: 'dc-pulse 1.5s ease-in-out infinite' }}/>}
      {label}
    </span>
  )
}

function DraftCard({ title, subtitle, status, statusLabel, stats, cta, onCta, disabled, accent }) {
  return (
    <div className="dc-card" style={{ '--dc-accent': accent || 'var(--orange)' }}>
      <div className="dc-card-header">
        <div>
          <div className="dc-card-title">{title}</div>
          <div className="dc-card-sub">{subtitle}</div>
        </div>
        <StatusBadge status={status} label={statusLabel}/>
      </div>
      <div className="dc-card-stats">
        {stats.map((s, i) => (
          <div key={i} className="dc-stat">
            <div className="dc-stat-val" style={{ color: s.color || 'var(--orange)' }}>{s.val}</div>
            <div className="dc-stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <button className="dc-cta" onClick={onCta} disabled={disabled}>
        {cta}
      </button>
    </div>
  )
}

export default function DraftCentralPage() {
  const navigate = useNavigate()
  const { manager, isAdmin } = useAuth()

  const [rookieState, setRookieState] = useState(null)
  const [rfaState,    setRfaState]    = useState(null)
  const [ufaState,    setUfaState]    = useState(null)
  const [picks,       setPicks]       = useState([])
  const [poolSize,    setPoolSize]    = useState(0)
  const [boardSet,    setBoardSet]    = useState(false)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const myTeam = manager?.team_abbrev
    Promise.all([
      fetch(`${API}/draft/state`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/draft/picks`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/draft/rookies`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/rfa/state`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/ufa/state`).then(r => r.ok ? r.json() : null).catch(() => null),
      myTeam
        ? fetch(`${API}/draft/bigboard/${myTeam}`).then(r => r.ok ? r.json() : []).catch(() => [])
        : Promise.resolve([]),
    ]).then(([rookieStateRes, picksRes, rookiesRes, rfaStateRes, ufaStateRes, boardRes]) => {
      setRookieState(rookieStateRes?.state || null)
      setPicks(Array.isArray(picksRes) ? picksRes : [])
      setPoolSize(Array.isArray(rookiesRes) ? rookiesRes.length : 0)
      setRfaState(rfaStateRes)
      setUfaState(ufaStateRes)
      setBoardSet(Array.isArray(boardRes) && boardRes.length > 0)
      setLoading(false)
    })
  }, [manager?.team_abbrev])

  const completedPicks = picks.filter(p => p.is_used || p.status === 'completed').length
  const totalPicks     = picks.length || 48
  const currentPick    = rookieState?.current_pick || 1
  const rookieStatus   = rookieState?.status || 'pre_draft'
  const rfaStatus      = rfaState?.status || 'pre_rfa'
  const ufaStatus      = ufaState?.status || 'pre_ufa'

  const rfaStatusLabel = {
    pre_rfa: 'Pre-RFA', wave_open: `Wave ${rfaState?.current_wave} Open`,
    paused: 'Paused', completed: 'Complete',
  }[rfaStatus] || 'Pre-RFA'

  const ufaStatusLabel = {
    pre_ufa: 'Pre-UFA', wave_open: `Wave ${ufaState?.current_wave} Open`,
    paused: 'Paused', completed: 'Complete',
  }[ufaStatus] || 'Pre-UFA'

  const rookieStatusLabel = {
    pre_draft: 'Not Started', active: `Pick ${currentPick}`, completed: 'Complete',
  }[rookieStatus] || 'Not Started'

  const myPicks = picks.filter(p => p.current_owner_abbrev === manager?.team_abbrev || p.current_team === manager?.team_abbrev)
  const myUsedPicks = myPicks.filter(p => p.is_used || p.status === 'completed').length

  return (
    <div className="dc-root">
      <div className="dc-header">
        <div className="dc-header-inner">
          <div>
            <h1 className="dc-title">Draft Central</h1>
            <p className="dc-sub">2026 offseason draft hub — Rookie Draft · RFA · UFA</p>
          </div>
          <button className="dc-board-btn" onClick={() => navigate('/draft/board')}>
            {boardSet ? '✓ My Big Board' : '+ Set Up Big Board'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="dc-loading"><div className="dc-spinner"/><span>Loading draft status…</span></div>
      ) : (
        <div className="dc-content">

          {/* Phase indicator */}
          <div className="dc-phase-bar">
            {[
              { label: 'RFA Draft',    status: rfaStatus,    done: rfaStatus === 'completed'    },
              { label: 'Rookie Draft', status: rookieStatus, done: rookieStatus === 'completed'  },
              { label: 'UFA Draft',    status: ufaStatus,    done: ufaStatus === 'completed'     },
            ].map((phase, i) => {
              const isActive = phase.status === 'active' || phase.status === 'wave_open'
              return (
                <div key={i} className={`dc-phase ${isActive ? 'dc-phase--active' : ''} ${phase.done ? 'dc-phase--done' : ''}`}>
                  <div className="dc-phase-dot"/>
                  <div className="dc-phase-label">{phase.label}</div>
                  <div className="dc-phase-status">{isActive ? 'IN PROGRESS' : phase.done ? 'COMPLETE' : 'UPCOMING'}</div>
                </div>
              )
            })}
          </div>

          {/* Three draft cards */}
          <div className="dc-cards">

            <DraftCard
              title="Rookie Draft"
              subtitle="3 rounds · 48 picks · Worst-to-best by standings"
              status={rookieStatus}
              statusLabel={rookieStatusLabel}
              accent="#e8822a"
              stats={[
                { val: poolSize,                          label: 'Prospects Available', color: 'var(--orange)'  },
                { val: `${completedPicks}/${totalPicks}`, label: 'Picks Made',          color: 'var(--text-secondary)' },
                { val: myPicks.length,                    label: 'My Picks',            color: '#3a9fd4'        },
                { val: boardSet ? '✓ Set' : '—',          label: 'My Big Board',        color: boardSet ? '#3dba6e' : 'var(--text-muted)' },
              ]}
              cta={rookieStatus === 'active' ? 'Enter Draft Room →' : rookieStatus === 'completed' ? 'View Results →' : 'Browse Prospects →'}
              onCta={() => navigate('/draft/rookie')}
            />

            <DraftCard
              title="RFA Draft"
              subtitle="5 waves · Incumbent match window · Sealed bids"
              status={rfaStatus}
              statusLabel={rfaStatusLabel}
              accent="#3a9fd4"
              stats={[
                { val: rfaState?.current_wave || 1,       label: 'Current Wave',        color: '#3a9fd4'  },
                { val: rfaState?.status === 'wave_open' ? 'Open' : 'Closed', label: 'Wave Status', color: rfaState?.status === 'wave_open' ? '#3dba6e' : 'var(--text-muted)' },
              ]}
              cta={rfaStatus === 'wave_open' ? 'Submit RFA Bids →' : 'View RFA Pool →'}
              onCta={() => navigate(isAdmin ? '/admin/rfa' : '/draft/rfa')}
            />

            <DraftCard
              title="UFA Draft"
              subtitle="9 waves · 3 tiers · $18 / $9.60 / $2.40 minimums"
              status={ufaStatus}
              statusLabel={ufaStatusLabel}
              accent="#d4a843"
              stats={[
                { val: `Tier ${ufaState?.current_tier || 1}`,    label: 'Current Tier',  color: '#d4a843'  },
                { val: `Wave ${ufaState?.current_wave || 1}`,    label: 'Current Wave',  color: 'var(--text-secondary)' },
                { val: ufaState?.status === 'wave_open' ? 'Open' : 'Closed', label: 'Wave Status', color: ufaState?.status === 'wave_open' ? '#3dba6e' : 'var(--text-muted)' },
              ]}
              cta={ufaStatus === 'wave_open' ? 'Submit UFA Bids →' : 'View UFA Pool →'}
              onCta={() => navigate(isAdmin ? '/admin/ufa' : '/draft/ufa')}
            />
          </div>

          {/* My picks summary */}
          {myPicks.length > 0 && (
            <div className="dc-my-picks">
              <div className="dc-section-label">MY DRAFT PICKS</div>
              <div className="dc-picks-grid">
                {[1,2,3].map(round => {
                  const roundPicks = myPicks.filter(p => p.round === round)
                  if (!roundPicks.length) return null
                  return (
                    <div key={round} className="dc-round-col">
                      <div className="dc-round-label">Round {round}</div>
                      {roundPicks.map(pick => {
                        const overall = pick.overall_pick || pick.pick_number
                        const origTeam = pick.original_team || pick.original_team_abbrev
                        const isTraded = origTeam && origTeam !== (pick.current_team || pick.current_owner_abbrev)
                        const isUsed   = pick.is_used || pick.status === 'completed'
                        return (
                          <div key={pick.id} className={`dc-pick-chip ${isUsed ? 'dc-pick-chip--used' : ''}`}>
                            <span className="dc-pick-num">#{overall}</span>
                            {isTraded && <span className="dc-pick-via">via {origTeam}</span>}
                            {isUsed && <span className="dc-pick-player">{pick.player_name || pick.used_on_player}</span>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
              <button className="dc-board-link" onClick={() => navigate('/draft/board')}>
                {boardSet ? '→ Edit My Big Board' : '→ Set Up My Big Board for Autodraft'}
              </button>
            </div>
          )}

          {/* Commissioner quick actions */}
          {isAdmin && (
            <div className="dc-admin-panel">
              <div className="dc-section-label">COMMISSIONER TOOLS</div>
              <div className="dc-admin-btns">
                <button className="dc-admin-btn" onClick={() => navigate('/admin/rfa')}>Manage RFA</button>
                <button className="dc-admin-btn" onClick={() => navigate('/admin/ufa')}>Manage UFA</button>
                <button className="dc-admin-btn" onClick={() => navigate('/admin/health')}>System Health</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
