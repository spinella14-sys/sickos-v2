import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL

// Popup for a manager whose trade reached a decision point -- accepted,
// declined, countered, approved or denied. Mirrors AdminTradeAlertPopup, but
// for managers rather than the commissioner.
//
// The trigger is an UNREAD trade_notification message rather than a poll of
// trade statuses. Those notifications already exist for every decision point,
// so the popup and the inbox stay in agreement by construction: dismissing
// fetches the message, which marks it read server-side and clears the inbox
// badge at the same time. No separate dismissal state to drift.
//
// An accepted trade changes your roster, so this is actionable rather than
// merely informational -- it is the prompt to go set your lineup.
export default function TradeUpdatePopup() {
  const { manager } = useAuth()
  const team = manager?.team_abbrev
  const [msgs, setMsgs] = useState([])
  const [busy, setBusy] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!team) return

    const check = () => {
      // The team comes from the x-team-abbrev HEADER -- getTeam() in
      // routes/messages.js ignores the query param and returns [] without it.
      fetch(`${API_BASE}/messages`, { headers: { 'x-team-abbrev': team } })
        .then(r => r.ok ? r.json() : [])
        .then(all => {
          const unread = (Array.isArray(all) ? all : [])
            .filter(m => m.message_type === 'trade_notification')
            .filter(m => !m.is_read)
            // Do not pop up a manager's own action back at them.
            .filter(m => m.sender_team !== team)
          setMsgs(unread)
        })
        .catch(() => {})
    }

    check()
    pollRef.current = setInterval(check, 15000)
    return () => clearInterval(pollRef.current)
  }, [team])

  if (!team || !msgs.length) return null

  const msg = msgs[0]

  // Fetching the message marks it read for this team, which is also what
  // clears it from the inbox badge.
  const dismiss = async () => {
    setBusy(true)
    try {
      await fetch(`${API_BASE}/messages/${msg.id}`, {
        headers: { 'x-team-abbrev': team },
      })
    } catch { /* dropping the popup matters more than the read receipt */ }
    setMsgs(prev => prev.filter(m => m.id !== msg.id))
    setBusy(false)
  }

  const accepted = /accepted/i.test(msg.subject || '')
  const declined = /declin/i.test(msg.subject || '')
  const denied   = /denied/i.test(msg.subject || '')
  const accent   = accepted ? '#3DBA6E' : (declined || denied) ? '#E84545' : '#F5A623'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }}>
      <div style={{
        background: '#14171c', borderRadius: 12, padding: 24,
        maxWidth: 460, width: '92%', border: `1px solid ${accent}66`,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: accent }}>
          {msg.subject || 'Trade update'}
        </div>

        <div style={{ fontSize: 13, color: '#C8CCD0', marginBottom: 16, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {msg.body}
        </div>

        {accepted && (
          <div style={{
            fontSize: 12, color: '#8B949E', marginBottom: 16, padding: '8px 10px',
            background: 'rgba(61,186,110,0.08)', border: '1px solid rgba(61,186,110,0.3)', borderRadius: 6,
          }}>
            Your roster is changing -- worth checking your lineup once it executes.
          </div>
        )}

        {msgs.length > 1 && (
          <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 12 }}>
            +{msgs.length - 1} more trade update{msgs.length > 2 ? 's' : ''}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/trade" style={{
            flex: 1, padding: '10px 0', borderRadius: 8, textAlign: 'center',
            background: accent, color: '#000', fontWeight: 700, textDecoration: 'none',
          }}>
            View Trade
          </a>
          <button onClick={dismiss} disabled={busy} style={{
            padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent', color: '#8B949E', cursor: busy ? 'default' : 'pointer',
          }}>
            {busy ? '...' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  )
}
