import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './CalendarPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const TYPE_META = {
  draft:          { label:'Draft',          color:'#e8822a', icon:'🏈' },
  signing_window: { label:'Signing Window', color:'#3a9fd4', icon:'✍' },
  deadline:       { label:'Deadline',       color:'#d94f4f', icon:'⏰' },
  waiver:         { label:'Waivers',        color:'#3dba6e', icon:'📋' },
  matchup:        { label:'Matchup',        color:'#d4a843', icon:'⚔' },
  league:         { label:'League',         color:'#9b8fd4', icon:'📢' },
  personal:       { label:'Personal',       color:'#a855f7', icon:'🔖' },
  reminder:       { label:'Reminder',       color:'#a855f7', icon:'🔔' },
}

const EVENT_TYPES = Object.entries(TYPE_META)
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

function typeMeta(type) { return TYPE_META[type] || { label:type, color:'#888', icon:'📅' } }

function formatDate(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number)
  return new Date(y, m-1, d).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' })
}

// ─── Event Modal (add / edit / view) ─────────────────────────────────────────
function EventModal({ event, defaultDate, isAdmin, manager, onClose, onSave, onDelete }) {
  const isNew = !event

  const [title,       setTitle]       = useState(event?.title || '')
  const [description, setDescription] = useState(event?.description || '')
  const [date,        setDate]        = useState(event?.event_date || defaultDate || '')
  const [time,        setTime]        = useState(event?.event_time?.slice(0,5) || '')
  const [type,        setType]        = useState(event?.event_type || 'personal')
  const [leagueWide,  setLeagueWide]  = useState(event?.is_league_wide || false)
  const [relatedUrl,  setRelatedUrl]  = useState(event?.related_url || '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const canEdit = isNew || isAdmin || event?.team_abbrev === manager?.team_abbrev
  const viewing = !canEdit

  async function handleSave() {
    if (!title.trim() || !date) { setError('Title and date are required'); return }
    setSaving(true); setError('')
    const body = { title, description, event_date: date, event_time: time || null,
      event_type: type, is_league_wide: leagueWide, related_url: relatedUrl || null }
    const url    = isNew ? `${API}/calendar` : `${API}/calendar/${event.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const r = await fetch(url, {
      method,
      headers: {
        'Content-Type':'application/json',
        'x-team-abbrev': manager.team_abbrev,
        ...(isAdmin ? {'x-admin-password':'brethart'} : {}),
      },
      body: JSON.stringify(body),
    })
    const data = await r.json()
    setSaving(false)
    if (r.ok) { onSave(data); onClose() }
    else setError(data.error || 'Save failed')
  }

  async function handleDelete() {
    if (!window.confirm('Delete this event?')) return
    await fetch(`${API}/calendar/${event.id}`, {
      method:'DELETE',
      headers: {
        'x-team-abbrev': manager.team_abbrev,
        ...(isAdmin ? {'x-admin-password':'brethart'} : {}),
      },
    })
    onDelete(event.id); onClose()
  }

  const tm = typeMeta(type)

  return (
    <div className="cal-modal-backdrop" onClick={onClose}>
      <div className="cal-modal" onClick={e=>e.stopPropagation()}>
        <div className="cal-modal-header" style={{borderTopColor: event?.color || tm.color}}>
          <div className="cal-modal-title-row">
            <span className="cal-modal-icon">{tm.icon}</span>
            {viewing
              ? <span className="cal-modal-title">{event.title}</span>
              : <input className="cal-modal-title-input" value={title} onChange={e=>setTitle(e.target.value)}
                  placeholder="Event title…" autoFocus/>
            }
          </div>
          <button className="cal-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cal-modal-body">
          {viewing ? (
            <>
              <div className="cal-view-date">📅 {formatDate(event.event_date)}{event.event_time ? ` · ${event.event_time.slice(0,5)}` : ''}</div>
              {event.description && <div className="cal-view-desc">{event.description}</div>}
              {event.is_league_wide
                ? <div className="cal-view-badge cal-view-badge--league">League Event</div>
                : <div className="cal-view-badge cal-view-badge--personal">Personal Reminder</div>}
              {event.related_url && (
                <Link to={event.related_url} className="cal-view-link" onClick={onClose}>
                  {event.related_url} →
                </Link>
              )}
            </>
          ) : (
            <>
              <div className="cal-form-row">
                <div className="cal-form-field">
                  <label className="cal-form-label">Date *</label>
                  <input className="cal-form-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
                </div>
                <div className="cal-form-field">
                  <label className="cal-form-label">Time (optional)</label>
                  <input className="cal-form-input" type="time" value={time} onChange={e=>setTime(e.target.value)}/>
                </div>
              </div>
              <div className="cal-form-field">
                <label className="cal-form-label">Type</label>
                <div className="cal-type-picker">
                  {EVENT_TYPES.filter(([k]) => isAdmin || ['personal','reminder'].includes(k)).map(([k,v])=>(
                    <button key={k}
                      className={`cal-type-btn ${type===k?'cal-type-btn--active':''}`}
                      style={{ '--tb-color': v.color }}
                      onClick={()=>setType(k)}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cal-form-field">
                <label className="cal-form-label">Description (optional)</label>
                <textarea className="cal-form-textarea" rows={3} value={description}
                  onChange={e=>setDescription(e.target.value)} placeholder="Add details…"/>
              </div>
              <div className="cal-form-field">
                <label className="cal-form-label">Link (optional)</label>
                <input className="cal-form-input" value={relatedUrl} onChange={e=>setRelatedUrl(e.target.value)}
                  placeholder="/trade, /free-agents, etc."/>
              </div>
              {isAdmin && (
                <label className="cal-form-check">
                  <input type="checkbox" checked={leagueWide} onChange={e=>setLeagueWide(e.target.checked)}/>
                  <span>League-wide event (visible to all managers)</span>
                </label>
              )}
              {error && <div className="cal-form-error">{error}</div>}
            </>
          )}
        </div>

        <div className="cal-modal-footer">
          {!isNew && canEdit && (
            <button className="cal-delete-btn" onClick={handleDelete}>Delete</button>
          )}
          <div style={{flex:1}}/>
          <button className="cal-cancel-btn" onClick={onClose}>
            {viewing ? 'Close' : 'Cancel'}
          </button>
          {!viewing && (
            <button className="cal-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Add Event' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Calendar Page ────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { manager, isAdmin } = useAuth()
  const today = new Date()

  const [year,     setYear]     = useState(today.getFullYear())
  const [month,    setMonth]    = useState(today.getMonth()) // 0-indexed
  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null) // null | 'new' | event obj
  const [clickedDay, setClickedDay] = useState(null) // date string 'YYYY-MM-DD'
  const [defaultDate, setDefaultDate] = useState('')

  const hdrs = useCallback(() => ({
    'x-team-abbrev': manager?.team_abbrev || '',
    ...(isAdmin ? {'x-admin-password':'brethart'} : {}),
  }), [manager?.team_abbrev, isAdmin])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    // Load current month + 1 month ahead for widget
    const r = await fetch(`${API}/calendar?month=${month+1}&year=${year}`, { headers: hdrs() })
    const data = await r.json()
    setEvents(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [month, year, hdrs])

  useEffect(() => { loadEvents() }, [loadEvents])

  // Build calendar grid
  const { days, prevDays, nextDays } = useMemo(() => {
    const firstDay  = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month+1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const prev = Array.from({length: firstDay}, (_,i) => ({
      date: prevMonthDays - firstDay + i + 1,
      month: month - 1, year: month === 0 ? year-1 : year,
      isCurrentMonth: false,
    }))
    const curr = Array.from({length: daysInMonth}, (_,i) => ({
      date: i+1, month, year, isCurrentMonth: true,
    }))
    const remaining = 42 - prev.length - curr.length
    const next = Array.from({length: remaining}, (_,i) => ({
      date: i+1, month: month+1, year: month === 11 ? year+1 : year,
      isCurrentMonth: false,
    }))
    return { days: curr, prevDays: prev, nextDays: next }
  }, [month, year])

  const allDays = [...prevDays, ...days, ...nextDays]

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(e => {
      if (!map[e.event_date]) map[e.event_date] = []
      map[e.event_date].push(e)
    })
    return map
  }, [events])

  function dateStr(d) {
    const m = String(d.month + 1).padStart(2,'0')
    const day = String(d.date).padStart(2,'0')
    const y = d.year
    return `${y}-${m}-${day}`
  }

  function isToday(d) {
    return d.date === today.getDate() && d.month === today.getMonth() && d.year === today.getFullYear()
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y=>y-1) }
    else setMonth(m=>m-1)
    setClickedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y=>y+1) }
    else setMonth(m=>m+1)
    setClickedDay(null)
  }

  function handleDayClick(d) {
    const ds = dateStr(d)
    setClickedDay(prev => prev === ds ? null : ds)
  }

  const clickedEvents = clickedDay ? (eventsByDate[clickedDay] || []) : []

  // Upcoming events (next 30 days from today)
  const upcoming = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0]
    return events
      .filter(e => e.event_date >= todayStr)
      .sort((a,b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 8)
  }, [events])

  function handleSaved(evt) {
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === evt.id)
      return idx >= 0 ? prev.map(e => e.id === evt.id ? evt : e) : [...prev, evt]
    })
  }
  function handleDeleted(id) {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="cal-root">
      {/* Header */}
      <div className="cal-header">
        <div className="cal-header-left">
          <h1 className="cal-title">League Calendar</h1>
          <p className="cal-sub">League events and personal reminders</p>
        </div>
        <div className="cal-header-actions">
          {isAdmin && (
            <button className="cal-add-btn cal-add-btn--league"
              onClick={()=>{ setDefaultDate(''); setModal('new-league') }}>
              📢 Add League Event
            </button>
          )}
          <button className="cal-add-btn cal-add-btn--personal"
            onClick={()=>{ setDefaultDate(''); setModal('new-personal') }}>
            🔖 Add Reminder
          </button>
        </div>
      </div>

      <div className="cal-body">
        {/* Calendar grid */}
        <div className="cal-main">
          {/* Month nav */}
          <div className="cal-month-nav">
            <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
            <div className="cal-month-label">{MONTHS[month]} {year}</div>
            <button className="cal-nav-btn" onClick={nextMonth}>›</button>
            <button className="cal-today-btn" onClick={()=>{ setMonth(today.getMonth()); setYear(today.getFullYear()) }}>
              Today
            </button>
          </div>

          {/* Day headers */}
          <div className="cal-grid-header">
            {DAYS.map(d => <div key={d} className="cal-grid-day-label">{d}</div>)}
          </div>

          {/* Calendar cells */}
          <div className="cal-grid">
            {allDays.map((d, i) => {
              const ds     = dateStr(d)
              const dayEvts = eventsByDate[ds] || []
              const isThisDay = isToday(d)
              const isSelected = clickedDay === ds

              return (
                <div key={i}
                  className={`cal-cell ${!d.isCurrentMonth?'cal-cell--other':''} ${isThisDay?'cal-cell--today':''} ${isSelected?'cal-cell--selected':''} ${dayEvts.length?'cal-cell--has-events':''}`}
                  onClick={()=>handleDayClick(d)}>
                  <div className="cal-cell-date">{d.date}</div>
                  <div className="cal-cell-dots">
                    {dayEvts.slice(0,3).map((e,j) => (
                      <span key={j} className="cal-event-dot" style={{background: e.color || typeMeta(e.event_type).color}}/>
                    ))}
                    {dayEvts.length > 3 && <span className="cal-event-more">+{dayEvts.length-3}</span>}
                  </div>
                  {/* Show event pills in larger cells */}
                  {dayEvts.slice(0,2).map((e,j) => (
                    <div key={j} className="cal-event-pill"
                      style={{background:`${e.color||typeMeta(e.event_type).color}22`, borderLeft:`2px solid ${e.color||typeMeta(e.event_type).color}`}}
                      onClick={ev=>{ev.stopPropagation();setModal(e)}}>
                      <span>{typeMeta(e.event_type).icon}</span>
                      <span className="cal-pill-title">{e.title}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Quick add bar when day is selected */}
          {clickedDay && (
            <div className="cal-day-bar">
              <div className="cal-day-bar-date">{formatDate(clickedDay)}</div>
              <div className="cal-day-bar-events">
                {clickedEvents.length === 0
                  ? <span className="cal-day-bar-empty">No events</span>
                  : clickedEvents.map(e=>(
                    <button key={e.id} className="cal-day-bar-event" onClick={()=>setModal(e)}
                      style={{borderColor:e.color||typeMeta(e.event_type).color,color:e.color||typeMeta(e.event_type).color}}>
                      {typeMeta(e.event_type).icon} {e.title}
                    </button>
                  ))
                }
              </div>
              <button className="cal-day-add" onClick={()=>{setDefaultDate(clickedDay);setModal('new-personal')}}>
                + Add
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="cal-sidebar">
          {/* Legend */}
          <div className="cal-legend">
            <div className="cal-legend-title">Event Types</div>
            {EVENT_TYPES.map(([k,v]) => (
              <div key={k} className="cal-legend-item">
                <span className="cal-legend-dot" style={{background:v.color}}/>
                <span>{v.icon} {v.label}</span>
              </div>
            ))}
          </div>

          {/* Upcoming */}
          <div className="cal-upcoming">
            <div className="cal-upcoming-title">Upcoming</div>
            {loading ? (
              <div className="cal-upcoming-empty">Loading…</div>
            ) : upcoming.length === 0 ? (
              <div className="cal-upcoming-empty">No upcoming events</div>
            ) : (
              upcoming.map(e => {
                const tm = typeMeta(e.event_type)
                const [,mm,dd] = e.event_date.split('-')
                return (
                  <button key={e.id} className="cal-upcoming-row" onClick={()=>setModal(e)}>
                    <div className="cal-upcoming-date-block" style={{background:`${e.color||tm.color}22`,borderColor:e.color||tm.color}}>
                      <div className="cal-upcoming-month">{MONTHS[parseInt(mm)-1].slice(0,3).toUpperCase()}</div>
                      <div className="cal-upcoming-day">{parseInt(dd)}</div>
                    </div>
                    <div className="cal-upcoming-info">
                      <div className="cal-upcoming-evt-title">{e.title}</div>
                      <div className="cal-upcoming-type" style={{color:e.color||tm.color}}>{tm.icon} {tm.label}</div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {(modal === 'new-league' || modal === 'new-personal') && (
        <EventModal
          event={null}
          defaultDate={defaultDate}
          isAdmin={isAdmin}
          manager={manager}
          onClose={()=>setModal(null)}
          onSave={handleSaved}
          onDelete={handleDeleted}
          // Pre-set league-wide based on which button they clicked
          initialLeagueWide={modal === 'new-league'}
        />
      )}
      {modal && typeof modal === 'object' && (
        <EventModal
          event={modal}
          defaultDate={''}
          isAdmin={isAdmin}
          manager={manager}
          onClose={()=>setModal(null)}
          onSave={handleSaved}
          onDelete={handleDeleted}
        />
      )}
    </div>
  )
}
