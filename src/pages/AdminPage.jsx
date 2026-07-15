import { useState } from 'react'
import { adminSyncScores, adminSyncPlayers, fetchHealth, fetchBids, processBid } from '../utils/api'
import './SimplePages.css'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed,   setAuthed]   = useState(false)
  const [log,      setLog]      = useState([])
  const [loading,  setLoading]  = useState(false)
  const [bids,     setBids]     = useState([])
  const [bidsLoading, setBidsLoading] = useState(false)

  function addLog(msg, type = 'info') {
    setLog(l => [...l, { msg, type, ts: new Date().toLocaleTimeString() }])
  }

  async function handleAuth(e) {
    e.preventDefault()
    if (password === 'Sickos26-Vault!Q7') { setAuthed(true); addLog('Authenticated as commissioner', 'success'); setBidsLoading(true); fetchBids({status:'pending'}).then(data => { setBids(data || []); setBidsLoading(false) }) }
    else addLog('Wrong password', 'error')
  }

  return (
    <div className="sp-root">
      <div className="sp-header">
        <h1 className="sp-title">Admin Panel</h1>
        <p className="sp-sub">Commissioner tools · Sickos Only</p>
      </div>
      <div className="sp-content">
        {!authed ? (
          <form onSubmit={handleAuth} style={{ maxWidth: 360 }}>
            <div style={{ marginBottom: 16, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Commissioner Password</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password…"
                style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border-bright)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 14, padding: '10px 14px', outline: 'none' }} />
              <button type="submit" style={{ background: 'var(--orange)', border: 'none', color: '#000', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13, padding: '10px 20px', cursor: 'pointer' }}>
                Login
              </button>
            </div>
          </form>
        ) : (
          <div className="admin-grid">
            {[
              { label: 'Check API Health',     desc: 'Verify backend + NFL state',           icon: '🟢', action: async () => { const r = await fetchHealth(); r ? addLog(`API healthy — NFL Week ${r.nfl?.week}`, 'success') : addLog('Backend not reachable', 'error') } },
              { label: 'Sync Player Universe', desc: 'Pull all NFL players from Sleeper',    icon: '👤', action: async () => { setLoading(true); const r = await adminSyncPlayers(password); r ? addLog(r.message, 'success') : addLog('Sync failed', 'error'); setLoading(false) } },
              { label: 'Sync Scores',          desc: 'Pull current week stats',              icon: '📊', action: async () => { setLoading(true); const r = await adminSyncScores(null, password); r ? addLog(r.message, 'success') : addLog('Sync failed', 'error'); setLoading(false) } },
              { label: 'Roster Management',    desc: 'Sign, release & move players',         icon: '📋', action: () => window.location.href='/admin/roster' },
              { label: 'Sign Player',          desc: 'Add player to a roster',               icon: '✍️', action: () => window.location.href='/admin/roster' },
              { label: 'Release Player',       desc: 'Cut a player from a roster',           icon: '❌', action: () => window.location.href='/admin/roster' },
            ].map(a => (
              <div key={a.label} className="admin-card">
                <span className="admin-icon">{a.icon}</span>
                <div className="admin-label">{a.label}</div>
                <div className="admin-desc">{a.desc}</div>
                <button className="admin-btn" onClick={a.action} disabled={loading}>
                  {loading ? 'Working…' : 'Run'}
                </button>
              </div>
            ))}
          </div>
        )}
        {log.length > 0 && (
          <div style={{ marginTop: 24, background: 'var(--bg1)', border: '1px solid var(--border)', padding: '16px 20px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Activity Log</div>
            {[...log].reverse().map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '4px 0', borderBottom: '1px solid var(--border)', color: l.type === 'success' ? 'var(--green)' : l.type === 'error' ? 'var(--red)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)', minWidth: 70 }}>{l.ts}</span>
                <span>{l.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
