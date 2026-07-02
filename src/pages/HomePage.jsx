import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TEAMS, LOGOS, TRANSACTIONS, SCOREBOARD_WK14, CAP, DIVISIONS } from '../data/league'
import { headshotUrl } from '../hooks/useSleeper'
import './HomePage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function TeamLogo({ abbrev, size = 32 }) {
  const url = LOGOS[abbrev]
  if (!url) return <span style={{ width: size, height: size, display: 'inline-block', background: 'var(--bg3)', borderRadius: 2, flexShrink: 0 }} />
  return <img src={url} alt={abbrev} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, borderRadius: 2 }} loading="lazy" />
}

function CapBar({ salary, compact }) {
  const pct = Math.min(100, (salary / CAP.hardCap) * 100)
  const luxPct = (CAP.luxuryLine / CAP.hardCap) * 100
  const isLux = salary > CAP.luxuryLine
  return (
    <div style={{ width: '100%' }}>
      <div style={{ position: 'relative', height: compact ? 3 : 4, background: 'var(--bg4)', borderRadius: 2 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: isLux ? 'var(--gold)' : 'var(--green)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: `${luxPct}%`, top: -2, bottom: -2, width: 1, background: 'var(--orange)', opacity: 0.7 }} />
      </div>
    </div>
  )
}

// ─── Countdown to draft ───────────────────────────────────────────────────────
function DraftCountdown() {
  // Draft is mid-July 2026 — approximate target
  const draftDate = new Date('2026-07-15T18:00:00')
  const [timeLeft, setTimeLeft] = useState({})

  useEffect(() => {
    function calc() {
      const diff = draftDate - new Date()
      if (diff <= 0) return setTimeLeft({ done: true })
      setTimeLeft({
        days:    Math.floor(diff / (1000*60*60*24)),
        hours:   Math.floor((diff % (1000*60*60*24)) / (1000*60*60)),
        minutes: Math.floor((diff % (1000*60*60)) / (1000*60)),
      })
    }
    calc()
    const t = setInterval(calc, 60000)
    return () => clearInterval(t)
  }, [])

  if (timeLeft.done) return <span className="hm-countdown-done">Draft Day!</span>

  return (
    <div className="hm-countdown">
      <span className="hm-countdown-label">2026 Draft</span>
      <div className="hm-countdown-units">
        <div className="hm-cu"><span className="hm-cu-val">{timeLeft.days}</span><span className="hm-cu-label">days</span></div>
        <div className="hm-cu-sep">:</div>
        <div className="hm-cu"><span className="hm-cu-val">{timeLeft.hours}</span><span className="hm-cu-label">hrs</span></div>
        <div className="hm-cu-sep">:</div>
        <div className="hm-cu"><span className="hm-cu-val">{timeLeft.minutes}</span><span className="hm-cu-label">min</span></div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [leaders,     setLeaders]     = useState([])
  const [topFAs,      setTopFAs]      = useState([])
  const [loadingLeaders, setLoadingLeaders] = useState(true)

  const sorted = [...TEAMS].sort((a, b) => b.wins - a.wins || a.losses - b.losses)

  // Fetch season leaders from backend
  useEffect(() => {
    fetch(`${API_BASE}/stats/season?season=2025`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setLeaders((data || []).slice(0, 10))
        setLoadingLeaders(false)
      })
      .catch(() => setLoadingLeaders(false))
  }, [])

  // Luxury tax teams
  const luxTeams = TEAMS.filter(t => t.salary > CAP.luxuryLine).length
  const underTeams = TEAMS.filter(t => t.salary <= CAP.luxuryLine).length
  const totalLux = TEAMS.filter(t => t.salary > CAP.luxuryLine)
    .reduce((a, t) => a + (t.salary - CAP.luxuryLine), 0)

  const posColor = { QB: '#e8822a', RB: '#3dba6e', WR: '#3a9fd4', TE: '#d4a843' }

  return (
    <div className="hm-root">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="hm-hero">
        <div className="hm-hero-inner">
          <div className="hm-hero-left">
            <img src={LOGOS.LEAGUE} alt="Sickos Only" className="hm-hero-logo" />
            <div className="hm-hero-text">
              <h1 className="hm-hero-title">SICKOS<em> ONLY</em></h1>
              <div className="hm-hero-meta">
                <span className="hm-hero-badge">OFFSEASON</span>
                <span className="hm-hero-season">2025 Season Complete · 2026 Draft Approaching</span>
              </div>
            </div>
          </div>
          <DraftCountdown />
        </div>
        <div className="hm-hero-bar" />
      </div>

      {/* ── MAIN GRID ────────────────────────────────────────────────────── */}
      <div className="hm-grid">

        {/* ── STANDINGS ────────────────────────────────────────────────── */}
        <section className="hm-card hm-standings">
          <div className="hm-card-header">
            <span className="hm-card-title">2025 Final Standings</span>
            <Link to="/standings" className="hm-card-link">Full Table →</Link>
          </div>
          <div className="hm-standings-list">
            {sorted.map((t, i) => {
              const isLux = t.salary > CAP.luxuryLine
              return (
                <Link to={`/team/${t.abbrev}`} key={t.abbrev} className="hm-st-row">
                  <span className={`hm-st-rank ${i===0?'rank-gold':i===1?'rank-silver':i===2?'rank-bronze':''}`}>{i+1}</span>
                  <TeamLogo abbrev={t.abbrev} size={28} />
                  <span className="hm-st-names">
                    <span className="hm-st-name">{t.name}</span>
                    <span className="hm-st-mgr">{t.manager}</span>
                  </span>
                  <span className="hm-st-record">{t.wins}-{t.losses}</span>
                  <span className={`hm-st-salary ${isLux ? 'hm-lux' : ''}`}>${t.salary}M</span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div className="hm-right-col">

          {/* Season Leaders */}
          <section className="hm-card hm-leaders">
            <div className="hm-card-header">
              <span className="hm-card-title">2025 Season Leaders</span>
              <Link to="/player-stats" className="hm-card-link">All Stats →</Link>
            </div>
            {loadingLeaders ? (
              <div className="hm-loading-sm">Loading…</div>
            ) : leaders.length === 0 ? (
              <div className="hm-loading-sm">Stats loading from backend</div>
            ) : (
              <div className="hm-leaders-list">
                {leaders.map((p, i) => (
                  <Link to={`/player/${p.sleeper_id}`} key={p.sleeper_id} className="hm-leader-row">
                    <span className="hm-leader-rank">{i+1}</span>
                    <img
                      src={headshotUrl(p.sleeper_id)}
                      alt={p.full_name}
                      className="hm-leader-shot"
                      onError={e => e.target.style.display='none'}
                    />
                    <span className="hm-leader-info">
                      <span className="hm-leader-name">{p.full_name}</span>
                      <span className="hm-leader-pos" style={{ color: posColor[p.position] }}>{p.position} · {p.nfl_team || 'FA'}</span>
                    </span>
                    <span className="hm-leader-pts">{p.fantasy_pts?.toFixed(1)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Cap Health */}
          <section className="hm-card hm-cap">
            <div className="hm-card-header">
              <span className="hm-card-title">Cap Health</span>
              <Link to="/salary-cap" className="hm-card-link">Full Cap →</Link>
            </div>
            <div className="hm-cap-summary">
              <div className="hm-cap-stat">
                <span className="hm-cap-val hm-lux">{luxTeams}</span>
                <span className="hm-cap-label">Over Luxury Line</span>
              </div>
              <div className="hm-cap-stat">
                <span className="hm-cap-val hm-green">{underTeams}</span>
                <span className="hm-cap-label">Under Line</span>
              </div>
              <div className="hm-cap-stat">
                <span className="hm-cap-val">${totalLux.toFixed(1)}M</span>
                <span className="hm-cap-label">Total Lux Tax</span>
              </div>
            </div>
            <div className="hm-cap-teams">
              {[...TEAMS].sort((a,b) => b.salary - a.salary).slice(0,6).map(t => (
                <Link to={`/team/${t.abbrev}`} key={t.abbrev} className="hm-cap-row">
                  <TeamLogo abbrev={t.abbrev} size={22} />
                  <span className="hm-cap-name">{t.name}</span>
                  <CapBar salary={t.salary} compact />
                  <span className={`hm-cap-num ${t.salary > CAP.luxuryLine ? 'hm-lux' : ''}`}>${t.salary}M</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* ── TRANSACTIONS ─────────────────────────────────────────────── */}
        <section className="hm-card hm-txns">
          <div className="hm-card-header">
            <span className="hm-card-title">Recent Activity</span>
            <Link to="/transactions" className="hm-card-link">Full Wire →</Link>
          </div>
          <div className="hm-txn-list">
            {TRANSACTIONS.map(txn => {
              const typeColor = { trade: 'var(--blue)', signing: 'var(--green)', release: 'var(--red)' }
              return (
                <div key={txn.id} className="hm-txn-row">
                  <span className="hm-txn-badge" style={{ borderColor: typeColor[txn.type], color: typeColor[txn.type] }}>
                    {txn.type}
                  </span>
                  <div className="hm-txn-body">
                    <div className="hm-txn-desc">{txn.desc}</div>
                    <div className="hm-txn-meta">
                      {txn.teams.map(a => (
                        <span key={a} className="hm-txn-team">
                          <TeamLogo abbrev={a} size={14} />
                          {a}
                        </span>
                      ))}
                      <span className="hm-txn-date">{txn.date}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── QUICK LINKS ──────────────────────────────────────────────── */}
        <section className="hm-card hm-quick">
          <div className="hm-card-header">
            <span className="hm-card-title">League Tools</span>
          </div>
          <div className="hm-quick-grid">
            {[
              { to: '/player-stats',  label: 'Player Stats',    icon: '📊', desc: '2025 season leaders' },
              { to: '/free-agents',   label: 'Free Agents',     icon: '📋', desc: 'Available players' },
              { to: '/salary-cap',    label: 'Salary Cap',      icon: '💰', desc: 'Cap table & luxury tax' },
              { to: '/draft',         label: 'Draft Central',   icon: '🏈', desc: '2026 draft prep' },
              { to: '/standings',     label: 'Standings',       icon: '🏆', desc: 'Final 2025 table' },
              { to: '/rules',         label: 'Rules',           icon: '📖', desc: 'Bylaws & scoring' },
            ].map(q => (
              <Link to={q.to} key={q.to} className="hm-quick-card">
                <span className="hm-quick-icon">{q.icon}</span>
                <div className="hm-quick-info">
                  <span className="hm-quick-label">{q.label}</span>
                  <span className="hm-quick-desc">{q.desc}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
