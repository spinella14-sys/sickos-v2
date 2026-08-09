import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const CURRENT_SEASON = new Date().getFullYear()

function formatCountdown(deadline) {
  const diff = new Date(deadline) - new Date()
  if (diff <= 0) return 'Deadline passed — processing shortly'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${mins}m remaining`
}

export default function RosterViolationPopup() {
  const { manager } = useAuth()
  const abbrev = manager?.team_abbrev
  const [violations, setViolations] = useState([])
  const [dismissed, setDismissed]   = useState(false)
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!abbrev) return
    fetch(`${API_BASE}/teams/${abbrev}/violations?season=${CURRENT_SEASON}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setViolations(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [abbrev])

  useEffect(() => {
    const interval = setInterval(() => forceTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  if (dismissed || !violations.length) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }}>
      <div style={{
        background: '#14171c', borderRadius: 12, padding: 24,
        maxWidth: 480, width: '92%', border: '1px solid rgba(217,79,79,0.5)',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8, textAlign: 'center' }}>🚨</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>
          Roster Compliance Issue{violations.length > 1 ? 's' : ''}
        </div>
        {violations.map((v, i) => (
          <div key={i} style={{
            marginBottom: 16, paddingBottom: 16,
            borderBottom: i < violations.length - 1 ? '1px solid #2a2e35' : 'none',
          }}>
            <div style={{ fontSize: 13, color: '#e0e0e0', marginBottom: 8, lineHeight: 1.5 }}>{v.reason}</div>
            <div style={{ fontSize: 12, color: '#3dba6e', marginBottom: 8, lineHeight: 1.5 }}>✓ {v.suggestion}</div>
            <div style={{ fontSize: 12, color: '#f0b429', marginBottom: 6, fontWeight: 700 }}>⏱ {formatCountdown(v.deadline)}</div>
            <div style={{ fontSize: 11, color: '#d94f4f', lineHeight: 1.5 }}>⚠ If not resolved: {v.penalty}</div>
          </div>
        ))}
        <button onClick={() => setDismissed(true)} style={{
          width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
          background: 'var(--draft-amber, #f0b429)', color: '#000', fontWeight: 700, cursor: 'pointer',
        }}>
          Got it
        </button>
      </div>
    </div>
  )
}
