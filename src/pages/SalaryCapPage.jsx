import { Link } from 'react-router-dom'
import { TEAMS, LOGOS, CAP, DIVISIONS } from '../data/league'
import './SalaryCapPage.css'

function CapMeter({ salary }) {
  const pct = Math.min(100, (salary / CAP.hardCap) * 100)
  const luxPct = (CAP.luxuryLine / CAP.hardCap) * 100
  const isLux = salary > CAP.luxuryLine
  const isNear = salary > CAP.hardCap * 0.95
  return (
    <div className="sc-meter">
      <div className="sc-meter-track">
        <div
          className={`sc-meter-fill ${isNear ? 'sc-m-red' : isLux ? 'sc-m-gold' : 'sc-m-ok'}`}
          style={{ width: `${pct}%` }}
        />
        <div className="sc-m-lux-line" style={{ left: `${luxPct}%` }} title="Luxury Tax Line" />
      </div>
    </div>
  )
}

export default function SalaryCapPage() {
  const sorted = [...TEAMS].sort((a, b) => b.salary - a.salary)
  const luxTeams = TEAMS.filter(t => t.salary > CAP.luxuryLine)
  const totalLux = luxTeams.reduce((acc, t) => acc + (t.salary - CAP.luxuryLine), 0)
  const avgSalary = TEAMS.reduce((a, t) => a + t.salary, 0) / TEAMS.length

  return (
    <div className="sc-root">
      <div className="sc-header">
        <div className="sc-header-inner">
          <div>
            <h1 className="sc-title">Salary Cap</h1>
            <p className="sc-sub">2025 Season · All figures in millions</p>
          </div>
          <div className="sc-summary">
            <div className="sc-sum-item">
              <span className="sc-sum-label">Hard Cap</span>
              <span className="sc-sum-val">${CAP.hardCap}M</span>
            </div>
            <div className="sc-sum-item">
              <span className="sc-sum-label">Luxury Line</span>
              <span className="sc-sum-val sc-gold">${CAP.luxuryLine}M</span>
            </div>
            <div className="sc-sum-item">
              <span className="sc-sum-label">League Avg</span>
              <span className="sc-sum-val">${avgSalary.toFixed(2)}M</span>
            </div>
            <div className="sc-sum-item">
              <span className="sc-sum-label">Total Lux Tax</span>
              <span className="sc-sum-val sc-red">${totalLux.toFixed(2)}M</span>
            </div>
          </div>
        </div>
      </div>

      <div className="sc-content">
        {/* Cap rules callout */}
        <div className="sc-rules-bar">
          <span>QB Max: <strong>${CAP.qbMax}M</strong></span>
          <span>Non-QB Max: <strong>${CAP.nonQbMax}M</strong></span>
          <span>Min Salary: <strong>${CAP.minSalary}M</strong></span>
          <span>Luxury Tax: <strong>{luxTeams.length} teams over line</strong></span>
        </div>

        {/* Full salary table */}
        <div className="sc-table">
          <div className="sc-table-header">
            <span className="sc-col sc-col-rank">#</span>
            <span className="sc-col sc-col-team">Team</span>
            <span className="sc-col sc-col-salary">Salary</span>
            <span className="sc-col sc-col-meter">Cap Usage</span>
            <span className="sc-col sc-col-space">Space</span>
            <span className="sc-col sc-col-lux">Lux Tax</span>
            <span className="sc-col sc-col-status">Status</span>
          </div>

          {sorted.map((t, i) => {
            const space = CAP.hardCap - t.salary
            const luxAmount = t.salary > CAP.luxuryLine ? t.salary - CAP.luxuryLine : 0
            const isLux = t.salary > CAP.luxuryLine
            const isOver = t.salary > CAP.hardCap
            return (
              <Link to={`/team/${t.abbrev}`} key={t.abbrev} className="sc-row">
                <span className="sc-col sc-col-rank sc-rank-num">{i + 1}</span>
                <span className="sc-col sc-col-team">
                  <img src={LOGOS[t.abbrev]} alt={t.abbrev} className="sc-team-logo" />
                  <span className="sc-team-info">
                    <span className="sc-team-name">{t.name}</span>
                    <span className="sc-team-mgr">{t.manager}</span>
                  </span>
                </span>
                <span className="sc-col sc-col-salary">
                  <span className={`sc-salary-val ${isOver ? 'sc-red' : isLux ? 'sc-gold' : ''}`}>
                    ${t.salary}M
                  </span>
                </span>
                <span className="sc-col sc-col-meter">
                  <CapMeter salary={t.salary} />
                  <span className="sc-pct">{((t.salary / CAP.hardCap) * 100).toFixed(1)}%</span>
                </span>
                <span className="sc-col sc-col-space">
                  <span className={space < 5 ? 'sc-red' : space < 15 ? 'sc-gold' : 'sc-green'}>
                    {isOver ? '—' : `$${space.toFixed(2)}M`}
                  </span>
                </span>
                <span className="sc-col sc-col-lux">
                  {luxAmount > 0
                    ? <span className="sc-gold">${luxAmount.toFixed(2)}M</span>
                    : <span className="sc-muted">—</span>
                  }
                </span>
                <span className="sc-col sc-col-status">
                  {isOver ? (
                    <span className="sc-badge sc-badge-over">OVER CAP</span>
                  ) : isLux ? (
                    <span className="sc-badge sc-badge-lux">LUXURY TAX</span>
                  ) : (
                    <span className="sc-badge sc-badge-ok">UNDER LINE</span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
