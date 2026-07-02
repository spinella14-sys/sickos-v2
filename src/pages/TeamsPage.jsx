import { Link } from 'react-router-dom'
import { TEAMS, DIVISIONS, LOGOS, CAP } from '../data/league'
import './TeamsPage.css'

function CapBar({ salary }) {
  const pct = Math.min(100, (salary / CAP.hardCap) * 100)
  const luxPct = (CAP.luxuryLine / CAP.hardCap) * 100
  const isLux = salary > CAP.luxuryLine
  return (
    <div className="tp-cap-bar-wrap">
      <div className="tp-cap-bar-track">
        <div className={`tp-cap-bar-fill ${isLux ? 'tp-cap--lux' : 'tp-cap--ok'}`} style={{ width: `${pct}%` }} />
        <div className="tp-cap-lux-line" style={{ left: `${luxPct}%` }} />
      </div>
      <span className={`tp-cap-val ${isLux ? 'tp-cap-over' : ''}`}>${salary}M</span>
    </div>
  )
}

export default function TeamsPage() {
  return (
    <div className="teams-root">
      <div className="teams-header">
        <h1 className="teams-title">Teams</h1>
        <p className="teams-sub">Sickos Only · 16 Teams · 4 Divisions</p>
      </div>

      <div className="teams-content">
        <div className="teams-divisions">
          {DIVISIONS.map(div => (
            <div key={div.name} className="div-section">
              <div className="div-label">{div.name} DIVISION</div>
              <div className="div-teams">
                {div.teams.map(abbrev => {
                  const team = TEAMS.find(t => t.abbrev === abbrev)
                  if (!team) return null
                  const record = `${team.wins}-${team.losses}`
                  const pct = (team.wins / (team.wins + team.losses)).toFixed(3).replace(/^0/, '')
                  return (
                    <Link to={`/team/${abbrev}`} key={abbrev} className="div-team-card">
                      <img src={LOGOS[abbrev]} alt={team.name} className="div-team-logo" />
                      <div className="div-team-info">
                        <div className="div-team-name">{team.name}</div>
                        <div className="div-team-mgr">{team.manager}</div>
                        <CapBar salary={team.salary} />
                      </div>
                      <div className="div-team-record">
                        <span className="div-record-wl">{record}</span>
                        <span className="div-record-pct">{pct}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
