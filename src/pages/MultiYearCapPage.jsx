import { useNavigate } from 'react-router-dom'
import { TEAMS, LOGOS, DIVISIONS } from '../data/league'
import './MultiYearCapPage.css'

export default function MultiYearCapPage() {
  const navigate = useNavigate()

  return (
    <div className="mycp-root">
      <div className="mycp-header">
        <h1 className="mycp-title">Multi-Year Cap View</h1>
        <p className="mycp-sub">Select a team to view their full multi-year salary breakdown</p>
      </div>

      <div className="mycp-nav-tabs">
        <button className="mycp-nav-tab" onClick={() => navigate('/salary-cap')}>League Overview</button>
        <button className="mycp-nav-tab mycp-nav-tab--active">Multi-Year View</button>
        <button className="mycp-nav-tab" onClick={() => navigate('/salary-cap/payouts')}>Payout Calculator</button>
      </div>

      <div className="mycp-divisions">
        {DIVISIONS.map(div => (
          <div key={div.name} className="mycp-division">
            <div className="mycp-div-label">{div.name}</div>
            <div className="mycp-team-grid">
              {div.teams.map(abbrev => {
                const team = TEAMS.find(t => t.abbrev === abbrev)
                if (!team) return null
                return (
                  <button
                    key={abbrev}
                    className="mycp-team-card"
                    onClick={() => navigate(`/team/${abbrev}/cap`)}
                  >
                    {LOGOS[abbrev] && (
                      <img src={LOGOS[abbrev]} alt={abbrev} className="mycp-team-logo"/>
                    )}
                    <div className="mycp-team-info">
                      <div className="mycp-team-name">{team.name}</div>
                      <div className="mycp-team-mgr">{team.manager}</div>
                    </div>
                    <span className="mycp-arrow">→</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
