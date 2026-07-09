import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LOGOS } from '../data/league'
import './SalaryCapPage.css'

const API     = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const HARD_CAP  = 138
const TAX_LINE  = 120
const BUY_IN    = TAX_LINE * 0.5   // $60 for 2026
const CURRENT_SEASON = 2026

// ── Tax / payout helpers ──────────────────────────────────────────────────
function taxAmount(capUsed)   { return Math.max(0, capUsed - TAX_LINE) }
function taxPayment(capUsed)  { return taxAmount(capUsed) * 3 }
function endOfSeason(capUsed) {
  const tax = taxPayment(capUsed)
  const base = capUsed - BUY_IN
  return Math.max(0, base + tax)
}

// ── Sortable column header ─────────────────────────────────────────────────
function SortTh({ label, k, sortKey, sortDir, onSort, style={}, className='' }) {
  const active = sortKey === k
  return (
    <th
      className={`scp-th scp-th--sortable ${active ? 'scp-th--active' : ''} ${className}`}
      style={style}
      onClick={() => onSort(k)}
    >
      {label}
      <span className="scp-sort-icon">{active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}</span>
    </th>
  )
}

// ── Cap usage bar ──────────────────────────────────────────────────────────
function CapBar({ capUsed }) {
  const pct    = Math.min(100, (capUsed / HARD_CAP) * 100)
  const ltlPct = (TAX_LINE / HARD_CAP) * 100
  const overTax = capUsed > TAX_LINE
  const overCap = capUsed > HARD_CAP
  const color   = overCap ? 'var(--red,#d94f4f)' : overTax ? 'var(--gold,#f0b429)' : 'var(--green,#3dba6e)'
  return (
    <div className="scp-bar-wrap">
      <div className="scp-bar-track">
        <div className="scp-bar-fill" style={{ width: `${pct.toFixed(1)}%`, background: color }}/>
        <div className="scp-bar-ltl"  style={{ left: `${ltlPct.toFixed(1)}%` }} title="Luxury Tax Line"/>
      </div>
      <span className="scp-bar-pct">{pct.toFixed(1)}%</span>
    </div>
  )
}

export default function SalaryCapPage() {
  const navigate = useNavigate()

  const [teams,     setTeams]     = useState([])
  const [sbBal,     setSbBal]     = useState({})
  const [loading,   setLoading]   = useState(true)
  const [sortKey,   setSortKey]   = useState('cap_used')
  const [sortDir,   setSortDir]   = useState('desc')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API}/teams`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/bids/sb-balances?season=${CURRENT_SEASON}`).then(r => r.ok ? r.json() : {}),
    ]).then(([teamsData, sbData]) => {
      setTeams(Array.isArray(teamsData) ? teamsData : [])
      setSbBal(sbData || {})
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // Enrich teams with computed columns
  const enriched = useMemo(() => teams.map(t => {
    const capUsed   = parseFloat(t.cap_used || 0)
    const sbBalance = parseFloat(sbBal[t.abbrev] || 0)
    const tax       = taxAmount(capUsed)
    const taxPay    = taxPayment(capUsed)
    const eos       = endOfSeason(capUsed)
    const maxSpace  = parseFloat(t.max_cap_space || 0)
    return { ...t, cap_used: capUsed, sb_balance: sbBalance, tax_amount: tax, tax_payment: taxPay, eos_payment: eos, max_cap_space: maxSpace }
  }), [teams, sbBal])

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [enriched, sortKey, sortDir])

  // League-wide summary
  const leagueAvg    = enriched.length ? enriched.reduce((s, t) => s + t.cap_used, 0) / enriched.length : 0
  const totalLuxTax  = enriched.reduce((s, t) => s + t.tax_payment, 0)
  const overTaxCount = enriched.filter(t => t.cap_used > TAX_LINE).length

  return (
    <div className="scp-root">

      {/* ── Header ── */}
      <div className="scp-header">
        <div>
          <h1 className="scp-title">Salary Cap</h1>
          <p className="scp-sub">{CURRENT_SEASON} Season · All figures in millions</p>
        </div>
        <div className="scp-league-stats">
          <div className="scp-stat">
            <div className="scp-stat-label">Hard Cap</div>
            <div className="scp-stat-val">${HARD_CAP}M</div>
          </div>
          <div className="scp-stat">
            <div className="scp-stat-label">Luxury Line</div>
            <div className="scp-stat-val" style={{color:'var(--gold,#f0b429)'}}>${TAX_LINE}M</div>
          </div>
          <div className="scp-stat">
            <div className="scp-stat-label">League Avg</div>
            <div className="scp-stat-val">${leagueAvg.toFixed(2)}M</div>
          </div>
          <div className="scp-stat">
            <div className="scp-stat-label">Total Lux Tax</div>
            <div className="scp-stat-val" style={{color: totalLuxTax > 0 ? 'var(--red,#d94f4f)' : 'var(--text-muted)'}}>
              ${totalLuxTax.toFixed(2)}M
            </div>
          </div>
        </div>
      </div>

      {/* ── League constants bar ── */}
      <div className="scp-constants">
        <span>QB Max: <strong>$26.67M</strong></span>
        <span>Non-QB Max: <strong>$21.82M</strong></span>
        <span>Min Salary: <strong>$2.40M</strong></span>
        <span>Buy-In: <strong>${BUY_IN.toFixed(2)}M</strong></span>
        <span style={{color: overTaxCount > 0 ? 'var(--gold)' : 'var(--text-muted)'}}>
          Luxury Tax: <strong>{overTaxCount} team{overTaxCount !== 1 ? 's' : ''} over line</strong>
        </span>
      </div>

      {/* ── Nav tabs ── */}
      <div className="scp-nav-tabs">
        <button className="scp-nav-tab scp-nav-tab--active">League Overview</button>
        <button className="scp-nav-tab" onClick={() => navigate('/salary-cap/multi-year')}>Multi-Year View</button>
        <button className="scp-nav-tab" onClick={() => navigate('/salary-cap/payouts')}>Payout Calculator</button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="scp-loading">Loading cap data…</div>
      ) : (
        <div className="scp-table-wrap">
          <table className="scp-table">
            <thead>
              <tr>
                <th className="scp-th scp-th--rank">#</th>
                <th className="scp-th scp-th--team">Team</th>
                <SortTh label="Salary"     k="cap_used"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort}/>
                <th className="scp-th">Cap Usage</th>
                <SortTh label="Space"      k="cap_space"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort}/>
                <SortTh label="SB Budget"  k="sb_balance"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort}/>
                <SortTh label="Tax Amt"    k="tax_amount"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort}/>
                <SortTh label="Tax Pmt"    k="tax_payment"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort}/>
                <SortTh label="EOS Pmt"    k="eos_payment"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} style={{color:'var(--text-muted)'}}/>
                <SortTh label="Max Space"  k="max_cap_space"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort}/>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => {
                const overTax = t.cap_used > TAX_LINE
                const overCap = t.cap_used > HARD_CAP
                return (
                  <tr key={t.abbrev} className={`scp-row ${overTax ? 'scp-row--tax' : ''} ${overCap ? 'scp-row--over' : ''}`}>
                    <td className="scp-td scp-td--rank">{i + 1}</td>
                    <td className="scp-td scp-td--team">
                      <Link to={`/team/${t.abbrev}`} className="scp-team-link">
                        {LOGOS[t.abbrev] && <img src={LOGOS[t.abbrev]} alt={t.abbrev} className="scp-logo"/>}
                        <div>
                          <div className="scp-team-name">{t.name || t.abbrev}</div>
                          <div className="scp-team-mgr">{t.manager}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="scp-td scp-td--num">
                      <span style={{color: overCap ? 'var(--red)' : overTax ? 'var(--gold)' : 'var(--text-primary)', fontWeight:700}}>
                        ${t.cap_used.toFixed(2)}
                      </span>
                    </td>
                    <td className="scp-td scp-td--bar">
                      <CapBar capUsed={t.cap_used}/>
                    </td>
                    <td className="scp-td scp-td--num" style={{color:'var(--green,#3dba6e)'}}>
                      ${parseFloat(t.cap_space || 0).toFixed(2)}
                    </td>
                    <td className="scp-td scp-td--num">
                      ${t.sb_balance.toFixed(2)}
                    </td>
                    <td className="scp-td scp-td--num" style={{color: t.tax_amount > 0 ? 'var(--gold,#f0b429)' : 'var(--text-muted)'}}>
                      {t.tax_amount > 0 ? `$${t.tax_amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="scp-td scp-td--num" style={{color: t.tax_payment > 0 ? 'var(--red,#d94f4f)' : 'var(--text-muted)'}}>
                      {t.tax_payment > 0 ? `$${t.tax_payment.toFixed(2)}` : '—'}
                    </td>
                    <td className="scp-td scp-td--num" style={{color:'var(--text-muted)'}}>
                      ${t.eos_payment.toFixed(2)}
                    </td>
                    <td className="scp-td scp-td--num" style={{color:'var(--blue,#3a9fd4)', fontWeight:600}}>
                      ${t.max_cap_space.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="scp-footnote">
        EOS Pmt = (Salary − Buy-In ${BUY_IN}) + Tax Penalties. Floor at $0. · Max Space = space available if all non-guaranteed contracts released.
      </div>
    </div>
  )
}
