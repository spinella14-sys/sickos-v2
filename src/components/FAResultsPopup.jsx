import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const POLL_MS = 15000

// Results of an FA window, shown once to each manager who bid in it.
//
// Separate from the trade popup rather than sharing it: a manager can log in to
// both a processed trade and a closed window, and each needs dismissing on its
// own. Queueing them through one component would blur the two together.
//
// A manager sees their own outcomes and the winning bids league-wide. They
// never see another team's failed offers -- knowing what a rival tried and
// missed is information nobody has in a real league.
export default function FAResultsPopup() {
  const { manager } = useAuth()
  const team = manager?.team_abbrev
  const [msgs, setMsgs] = useState([])
  const [busy, setBusy] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!team) return

    const check = () => {
      fetch(`${API_BASE}/messages`, { headers: { 'x-team-abbrev': team } })
        .then(r => r.ok ? r.json() : [])
        .then(all => {
          const unread = (Array.isArray(all) ? all : [])
            .filter(m => m.message_type === 'fa_results')
            .filter(m => !m.is_read)
          setMsgs(unread)
        })
        .catch(() => {})
    }

    check()
    pollRef.current = setInterval(check, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [team])

  if (!team || !msgs.length) return null

  const msg = msgs[0]
  const payload = msg.payload || {}
  const mine = Array.isArray(payload.mine) ? payload.mine : []
  const league = Array.isArray(payload.league) ? payload.league : []

  const won = mine.filter(r => r.status === 'approved')

  // Fetching the message marks it read, which also clears the inbox badge.
  const dismiss = async () => {
    setBusy(true)
    try {
      await fetch(`${API_BASE}/messages/${msg.id}`, { headers: { 'x-team-abbrev': team } })
    } catch { /* dropping the popup matters more than the read receipt */ }
    setMsgs(prev => prev.filter(m => m.id !== msg.id))
    setBusy(false)
  }

  const accent = won.length ? '#3DBA6E' : '#F5A623'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }}>
      <div style={{
        background: '#14171c', borderRadius: 12, padding: 24,
        maxWidth: 520, width: '92%', maxHeight: '86vh', overflowY: 'auto',
        border: `1px solid ${accent}66`, color: '#E6EDF3',
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: accent }}>
          {payload.week ? `Week ${payload.week} ` : ''}Free Agent Results
        </div>
        <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>
          {won.length
            ? `You signed ${won.length} player${won.length > 1 ? 's' : ''}.`
            : 'No players awarded to you this window.'}
        </div>

        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8B949E',
          marginBottom: 8,
        }}>Your bids</div>

        {mine.length === 0 ? (
          <div style={{ fontSize: 13, color: '#8B949E' }}>You did not bid this window.</div>
        ) : mine.map((r, i) => {
          const ok = r.status === 'approved'
          return (
            <div key={i} style={{
              padding: '10px 12px', marginBottom: 8, borderRadius: 6,
              background: ok ? 'rgba(61,186,110,0.08)' : 'rgba(255,255,255,0.03)',
              borderLeft: `3px solid ${ok ? '#3DBA6E' : '#E84545'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontWeight: 700 }}>{r.player_name}</span>
                <span style={{
                  fontFamily: 'Barlow Condensed, sans-serif', fontSize: 12, fontWeight: 800,
                  letterSpacing: '0.06em', color: ok ? '#3DBA6E' : '#E84545',
                }}>{ok ? 'SIGNED' : 'NOT AWARDED'}</span>
              </div>
              <div style={{ fontSize: 12, color: '#8B949E', marginTop: 3 }}>
                {r.years}yr &middot; ${Number(r.salary).toFixed(2)}
              </div>
              {/* The specific reason, not a generic failure -- a manager should
                  know what to change before the next window. */}
              {!ok && r.reason && (
                <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>{r.reason}</div>
              )}
            </div>
          )
        })}

        {league.length > 0 && (
          <>
            <div style={{
              fontFamily: 'Barlow Condensed, sans-serif', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8B949E',
              margin: '18px 0 8px',
            }}>Signed around the league</div>
            {league.map((a, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', gap: 10,
                padding: '7px 12px', marginBottom: 5, borderRadius: 5,
                background: 'rgba(255,255,255,0.03)', fontSize: 13,
              }}>
                <span>{a.player_name} &rarr; {a.team_abbrev}</span>
                <span style={{ color: '#8B949E' }}>
                  {a.years}yr &middot; ${Number(a.salary).toFixed(2)}
                </span>
              </div>
            ))}
          </>
        )}

        <button
          onClick={dismiss}
          disabled={busy}
          style={{
            width: '100%', marginTop: 20, padding: '11px 0', borderRadius: 8,
            background: accent, border: 'none', color: '#000',
            fontWeight: 800, fontSize: 14, cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >Got it</button>
      </div>
    </div>
  )
}
