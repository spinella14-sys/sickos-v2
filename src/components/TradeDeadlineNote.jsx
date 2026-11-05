import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Small informational line showing when the trade deadline falls. Deliberately
// understated -- a reference point, not the draft-room clock.
//
// Both the date AND the time come from the calendar row. calendar_events has
// an event_time column, and transactionGate.isPastTradeDeadline() reads it to
// decide when to actually block trading -- so displaying a hardcoded hour here
// would drift from the rule being enforced the moment the deadline moved.
const FALLBACK_HOUR_ET = 23

// Returns the UTC instant of 11pm ET on the given YYYY-MM-DD. The ET offset is
// derived from the date itself rather than assumed -- early November can fall
// on either side of the DST change depending on the year.
function deadlineInstant(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hStr, mStr] = (timeStr || '').split(':')
  const hour   = timeStr ? parseInt(hStr) : FALLBACK_HOUR_ET
  const minute = timeStr ? (parseInt(mStr) || 0) : 0

  // Read the ET offset off the date itself. The previous version round-tripped
  // through new Date(localeString), which parses in the BROWSER's timezone --
  // on an Eastern machine the drift came out 0 and the deadline resolved to
  // 11pm UTC, i.e. 6pm ET, five hours early. formatToParts avoids the parse.
  const guess = Date.UTC(y, m - 1, d, hour, minute)
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(guess)).reduce((acc, part) => {
    acc[part.type] = part.value
    return acc
  }, {})

  const etAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return new Date(guess + (guess - etAsUTC))
}

export default function TradeDeadlineNote() {
  const [deadline, setDeadline] = useState(null)   // { date, time }
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    fetch(`${API_BASE}/calendar`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const rows = Array.isArray(d) ? d : (d?.events || [])
        const row = rows.find(e => e.event_type === 'deadline' && /trade/i.test(e.title || ''))
        if (row?.event_date) setDeadline({ date: row.event_date, time: row.event_time })
      })
      .catch(() => {})
  }, [])

  // Once a minute is plenty for something measured in days.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  if (!deadline) return null

  const instant = deadlineInstant(deadline.date, deadline.time)
  const msLeft  = instant.getTime() - now
  const passed  = msLeft <= 0

  const dateLabel = instant.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  })

  let remaining = null
  if (!passed) {
    const days  = Math.floor(msLeft / 86400000)
    const hours = Math.floor((msLeft % 86400000) / 3600000)
    const mins  = Math.floor((msLeft % 3600000) / 60000)
    remaining = days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`
  }

  return (
    <div style={{
      fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color: passed ? 'var(--red, #d94f4f)' : 'var(--text-muted, #8B949E)',
      display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
    }}>
      {passed ? (
        <>Trade deadline passed {dateLabel}</>
      ) : (
        <>
          Trade deadline {dateLabel} {instant.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'America/New_York' })} ET
          <span style={{ color: 'var(--draft-amber, #F5A623)' }}>{remaining} left</span>
        </>
      )}
    </div>
  )
}
