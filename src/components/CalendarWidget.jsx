import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './CalendarWidget.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const TYPE_META = {
  draft:          { icon:'🏈', color:'#e8822a' },
  signing_window: { icon:'✍',  color:'#3a9fd4' },
  deadline:       { icon:'⏰',  color:'#d94f4f' },
  waiver:         { icon:'📋',  color:'#3dba6e' },
  matchup:        { icon:'⚔',  color:'#d4a843' },
  league:         { icon:'📢',  color:'#9b8fd4' },
  personal:       { icon:'🔖',  color:'#a855f7' },
  reminder:       { icon:'🔔',  color:'#a855f7' },
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [y,m,d] = dateStr.split('-').map(Number)
  const evt = new Date(y, m-1, d)
  const diff = Math.round((evt - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff < 7)  return `${diff}d`
  if (diff < 30) return `${Math.round(diff/7)}w`
  return `${Math.round(diff/30)}mo`
}

export default function CalendarWidget({ colors }) {
  const { manager } = useAuth()
  const navigate    = useNavigate()
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!manager?.team_abbrev) return
    fetch(`${API}/calendar/upcoming?limit=5`, {
      headers: { 'x-team-abbrev': manager.team_abbrev }
    }).then(r=>r.ok?r.json():[])
      .then(d => { setEvents(Array.isArray(d)?d:[]); setLoading(false) })
      .catch(()=>setLoading(false))
  }, [manager?.team_abbrev])

  const hasToday = events.some(e => {
    const today = new Date().toISOString().split('T')[0]
    return e.event_date === today
  })

  return (
    <div className={`calw-root ${hasToday?'calw-root--today':''}`}
      style={{
        '--calw-primary': colors?.primary || 'var(--orange)',
        '--calw-dim':     colors?.dim     || 'rgba(232,130,42,0.12)',
        '--calw-border':  colors?.border  || 'rgba(232,130,42,0.3)',
      }}>
      <div className="calw-header">
        <div className="calw-header-left">
          {hasToday && <span className="calw-today-dot"/>}
          <span className="calw-title">
            {hasToday ? 'Today on Calendar' : 'Upcoming Events'}
          </span>
        </div>
        <div className="calw-header-actions">
          <button className="calw-action-btn" onClick={()=>navigate('/calendar?add=1')}>
            + Add
          </button>
          <Link to="/calendar" className="calw-action-btn calw-action-btn--view">
            Calendar →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="calw-loading">Loading…</div>
      ) : events.length === 0 ? (
        <div className="calw-empty">
          <span>No upcoming events</span>
          <Link to="/calendar" className="calw-empty-link">View Calendar →</Link>
        </div>
      ) : (
        <div className="calw-list">
          {events.map(e => {
            const [,mm,dd] = e.event_date.split('-')
            const tm     = TYPE_META[e.event_type] || { icon:'📅', color:'#888' }
            const color  = e.color || tm.color
            const until  = daysUntil(e.event_date)
            const isToday = until === 'Today'

            return (
              <Link key={e.id} to="/calendar" className={`calw-row ${isToday?'calw-row--today':''}`}>
                {/* Date block */}
                <div className="calw-date-block" style={{background:`${color}18`, borderColor:color}}>
                  <div className="calw-date-mon" style={{color}}>{MONTHS_SHORT[parseInt(mm)-1]}</div>
                  <div className="calw-date-day" style={{color}}>{parseInt(dd)}</div>
                </div>
                {/* Content */}
                <div className="calw-content">
                  <div className="calw-evt-title">{e.title}</div>
                  <div className="calw-evt-meta">
                    <span style={{color}}>{tm.icon} {e.event_type.replace(/_/g,' ')}</span>
                    {!e.is_league_wide && <span className="calw-personal-tag">private</span>}
                  </div>
                </div>
                {/* Until */}
                <div className={`calw-until ${isToday?'calw-until--today':''}`}
                  style={isToday ? {color:'#000', background:color} : {color}}>
                  {until}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
