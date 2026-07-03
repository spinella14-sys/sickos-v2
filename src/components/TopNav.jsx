import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LOGOS from '../assets/logos/index.js'
import { TEAMS, DIVISIONS } from '../data/league.js'
import { useAuth } from '../context/AuthContext'
import './TopNav.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const BACK_PAGES = ['/player/', '/team/']

export default function TopNav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [teamsOpen, setTeamsOpen] = useState(false)
  const { manager, isAdmin, signOut } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const showBack = BACK_PAGES.some(p => location.pathname.startsWith(p))
  const myAbbrev = manager?.team_abbrev || 'NH'

  useEffect(() => {
    if (!manager?.team_abbrev) return
    function fetchUnread() {
      fetch(`${API}/messages/unread-count`, {
        headers: { 'x-team-abbrev': manager.team_abbrev }
      }).then(r=>r.ok?r.json():null).then(d=>{ if(d) setUnreadCount(d.count||0) })
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 60000)
    return () => clearInterval(interval)
  }, [manager?.team_abbrev])

  return (
    <nav className="topnav">
      <div className="topnav-inner">

        {showBack && (
          <button className="topnav-back" onClick={() => navigate(-1)} title="Go back">
            ‹
          </button>
        )}

        <button className="topnav-brand" onClick={() => navigate('/')} title="Dashboard">
          <img
            src={LOGOS.LEAGUE}
            alt="Sickos Only"
            className="topnav-league-logo"
            style={{ width: 36, height: 36 }}
          />
        </button>

        <ul className="topnav-links">

          {/* Home dropdown */}
          <li className="tnl-dropdown-wrap tnl-home-wrap">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'tnl active' : 'tnl'}>Home ▾</NavLink>
            <div className="tnl-home-dropdown">
              <div className="tnl-home-section">
                <div className="tnl-home-section-label">My Team</div>
                <button className="tnl-home-item" onClick={() => navigate(`/team/${myAbbrev}`)}>My Roster</button>
                <button className="tnl-home-item" onClick={() => navigate(`/team/${myAbbrev}/cap`)}>My Cap Sheet</button>
                <button className="tnl-home-item" onClick={() => navigate('/watchlist')}>My Watchlist</button>
                <button className="tnl-home-item" onClick={() => navigate('/settings')}>Team Settings</button>
              </div>
              <div className="tnl-home-section">
                <div className="tnl-home-section-label">Actions</div>
                <button className="tnl-home-item tnl-inbox-item" onClick={() => navigate('/inbox')}>
                  Inbox
                  {unreadCount > 0 && <span className="tnl-inbox-badge">{unreadCount}</span>}
                </button>
                <button className="tnl-home-item" onClick={() => navigate('/free-agents')}>Submit FA Bid</button>
                <button className="tnl-home-item" onClick={() => navigate('/trade')}>Propose Trade</button>
                <button className="tnl-home-item" onClick={() => navigate('/trade-block')}>Trade Block</button>
              </div>
              <div className="tnl-home-section">
                <div className="tnl-home-section-label">Tools</div>
                <button className="tnl-home-item" onClick={() => navigate('/salary-cap')}>Cap Calculator</button>
                <button className="tnl-home-item" onClick={() => navigate('/player-stats')}>Player Rankings</button>
                <button className="tnl-home-item" onClick={() => navigate('/draft/board')}>Draft Board</button>
                <button className="tnl-home-item" onClick={() => navigate('/calendar')}>League Calendar</button>
              </div>
            </div>
          </li>

          {/* Scores dropdown — Scoreboard + Master Schedule */}
          <li className="tnl-dropdown-wrap">
            <NavLink
              to="/scoreboard"
              className={({ isActive }) =>
                (isActive || location.pathname === '/schedule') ? 'tnl active' : 'tnl'
              }
            >
              Scores ▾
            </NavLink>
            <div className="tnl-draft-dropdown">
              <button className="tnl-draft-item" onClick={() => navigate('/scoreboard')}>
                Scoreboard
              </button>
              <button className="tnl-draft-item" onClick={() => navigate('/schedule')}>
                Master Schedule
              </button>
            </div>
          </li>

          {/* Teams dropdown */}
          <li
            className="tnl-dropdown-wrap"
            onMouseEnter={() => setTeamsOpen(true)}
            onMouseLeave={() => setTeamsOpen(false)}
          >
            <NavLink to="/teams" className={({ isActive }) => isActive ? 'tnl active' : 'tnl'}>
              Teams ▾
            </NavLink>
            {teamsOpen && (
              <div className="tnl-dropdown">
                <div className="tnl-dropdown-header">
                  <NavLink to="/teams" className="tnl-dropdown-all" onClick={() => setTeamsOpen(false)}>
                    All Teams →
                  </NavLink>
                </div>
                <div className="tnl-dropdown-divisions">
                  {DIVISIONS.map(div => (
                    <div key={div.name} className="tnl-div-col">
                      <div className="tnl-div-label">{div.name}</div>
                      {div.teams.map(abbrev => {
                        const team = TEAMS.find(t => t.abbrev === abbrev)
                        if (!team) return null
                        return (
                          <button
                            key={abbrev}
                            className="tnl-team-row"
                            onClick={() => { navigate(`/team/${abbrev}`); setTeamsOpen(false) }}
                          >
                            <img src={LOGOS[abbrev]} alt={abbrev} className="tnl-team-logo" />
                            <span className="tnl-team-name">{team.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </li>

          <li>
            <NavLink to="/standings" className={({ isActive }) => isActive ? 'tnl active' : 'tnl'}>Standings</NavLink>
          </li>
          <li>
            <NavLink to="/players" className={({ isActive }) => isActive ? 'tnl active' : 'tnl'}>Players</NavLink>
          </li>
          <li>
            <NavLink to="/player-stats" className={({ isActive }) => isActive ? 'tnl active' : 'tnl'}>Player Stats</NavLink>
          </li>
          <li>
            <NavLink to="/free-agents" className={({ isActive }) => isActive ? 'tnl active' : 'tnl'}>Free Agents</NavLink>
          </li>
          <li>
            <NavLink to="/transactions" className={({ isActive }) => isActive ? 'tnl active' : 'tnl'}>Wire</NavLink>
          </li>
          <li>
            <NavLink to="/salary-cap" className={({ isActive }) => isActive ? 'tnl active' : 'tnl'}>Salary Cap</NavLink>
          </li>

          {/* Draft Central dropdown */}
          <li className="tnl-dropdown-wrap">
            <NavLink to="/draft" className={({ isActive }) => isActive ? 'tnl active' : 'tnl'}>Draft Central ▾</NavLink>
            <div className="tnl-draft-dropdown">
              <button className="tnl-draft-item" onClick={() => navigate(isAdmin ? '/admin/rfa' : '/draft/rfa')}>
                RFA Draft
              </button>
              <button className="tnl-draft-item" onClick={() => navigate('/draft/rookie')}>
                Rookie Draft
              </button>
              <button className="tnl-draft-item" onClick={() => navigate(isAdmin ? '/admin/ufa' : '/draft/ufa')}>
                UFA Draft
              </button>
            </div>
          </li>

          <li>
            <NavLink to="/rules" className={({ isActive }) => isActive ? 'tnl active' : 'tnl'}>Rules</NavLink>
          </li>

        </ul>

        <div className="topnav-right">
          {manager && (
            <div className="topnav-manager">
              <span className="topnav-manager-abbrev">{manager.team_abbrev}</span>
              <span className="topnav-manager-name">{manager.display_name}</span>
            </div>
          )}
          {isAdmin && (
            <div className="tnl-dropdown-wrap">
              <button className="topnav-admin-btn">Admin ▾</button>
              <div className="tnl-admin-dropdown">
                <div className="tnl-admin-section-label">Tools</div>
                <button className="tnl-admin-item" onClick={() => navigate('/admin')}>Admin Panel</button>
                <button className="tnl-admin-item" onClick={() => navigate('/admin/health')}>System Health</button>
                <button className="tnl-admin-item" onClick={() => navigate('/admin/roster')}>Roster Management</button>
                <button className="tnl-admin-item" onClick={() => navigate('/admin/bulk-edit')}>Bulk Contract Editor</button>
                <button className="tnl-admin-item" onClick={() => navigate('/admin/managers')}>Manager Accounts</button>
              </div>
            </div>
          )}
          <button className="topnav-signout-btn" onClick={signOut} title="Sign out">
            Sign Out
          </button>
        </div>

      </div>
    </nav>
  )
}
