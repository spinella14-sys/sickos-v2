import { useState, useEffect } from 'react'
import { TEAMS } from '../data/league'
import { supabase } from '../lib/supabase'
import './AdminManagersPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const ADMIN_PW = 'brethart'

export default function AdminManagersPage() {
  const [managers,  setManagers]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null) // null | 'create' | manager object
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  useEffect(() => { loadManagers() }, [])

  async function loadManagers() {
    setLoading(true)
    const r = await fetch(`${API_BASE}/admin/managers`, {
      headers: { 'x-admin-password': ADMIN_PW }
    })
    const data = await r.json()
    setManagers(data || [])
    setLoading(false)
  }

  function flash(msg, isErr=false) {
    if (isErr) setError(msg)
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  return (
    <div className="amgr-root">
      <div className="amgr-header">
        <div>
          <h1 className="amgr-title">Manager Accounts</h1>
          <p className="amgr-sub">Create and manage league member access</p>
        </div>
        <button className="amgr-create-btn" onClick={() => setModal('create')}>
          + Add Manager
        </button>
      </div>

      {success && <div className="amgr-success">{success}</div>}
      {error   && <div className="amgr-error">{error}</div>}

      {loading ? <div className="amgr-loading">Loading…</div> : (
        <table className="amgr-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {managers.map(m => (
              <tr key={m.id} className={!m.is_active ? 'amgr-inactive' : ''}>
                <td>
                  <span className="amgr-abbrev">{m.team_abbrev}</span>
                </td>
                <td className="amgr-name">{m.display_name}</td>
                <td className="amgr-email">{m.email}</td>
                <td>
                  {m.is_admin
                    ? <span className="amgr-badge amgr-badge--admin">Admin</span>
                    : <span className="amgr-badge amgr-badge--member">Member</span>}
                </td>
                <td>
                  {m.is_active
                    ? <span className="amgr-status amgr-status--active">Active</span>
                    : <span className="amgr-status amgr-status--inactive">Inactive</span>}
                </td>
                <td className="amgr-actions">
                  <button className="amgr-btn" onClick={() => setModal(m)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal && (
        <ManagerModal
          manager={modal === 'create' ? null : modal}
          onClose={() => { setModal(null); setError('') }}
          onSave={async () => { await loadManagers(); setModal(null); flash('Saved successfully') }}
          onError={msg => flash(msg, true)}
        />
      )}
    </div>
  )
}

function ManagerModal({ manager, onClose, onSave, onError }) {
  const isNew = !manager

  const [email,       setEmail]       = useState(manager?.email || '')
  const [password,    setPassword]    = useState('')
  const [displayName, setDisplayName] = useState(manager?.display_name || '')
  const [teamAbbrev,  setTeamAbbrev]  = useState(manager?.team_abbrev || '')
  const [isAdmin,     setIsAdmin]     = useState(manager?.is_admin || false)
  const [isActive,    setIsActive]    = useState(manager?.is_active !== false)
  const [saving,      setSaving]      = useState(false)
  const [localError,  setLocalError]  = useState('')

  async function handleSave() {
    if (!email || !displayName || !teamAbbrev) {
      setLocalError('Email, name, and team are required.'); return
    }
    if (isNew && !password) {
      setLocalError('Password is required for new accounts.'); return
    }
    if (password && password.length < 8) {
      setLocalError('Password must be at least 8 characters.'); return
    }

    setSaving(true); setLocalError('')

    const r = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/managers${isNew ? '' : `/${manager.id}`}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type':'application/json', 'x-admin-password': 'brethart' },
      body: JSON.stringify({
        email, password: password || undefined,
        display_name: displayName, team_abbrev: teamAbbrev,
        is_admin: isAdmin, is_active: isActive,
      }),
    })
    const data = await r.json()
    setSaving(false)

    if (r.ok) onSave()
    else { setLocalError(data.error || 'Save failed'); onError(data.error) }
  }

  return (
    <div className="amgr-modal-backdrop" onClick={onClose}>
      <div className="amgr-modal" onClick={e=>e.stopPropagation()}>
        <div className="amgr-modal-header">
          <span className="amgr-modal-title">{isNew ? 'Add Manager' : `Edit — ${manager.display_name}`}</span>
          <button className="amgr-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="amgr-modal-body">
          <div className="amgr-mfield">
            <label className="amgr-mlabel">Team *</label>
            <select className="amgr-mselect" value={teamAbbrev} onChange={e=>setTeamAbbrev(e.target.value)}>
              <option value="">Select team…</option>
              {TEAMS.map(t=><option key={t.abbrev} value={t.abbrev}>{t.abbrev} — {t.name} ({t.manager})</option>)}
            </select>
          </div>
          <div className="amgr-mfield">
            <label className="amgr-mlabel">Display Name *</label>
            <input className="amgr-minput" value={displayName} onChange={e=>setDisplayName(e.target.value)}
              placeholder="e.g. Adam Spinella"/>
          </div>
          <div className="amgr-mfield">
            <label className="amgr-mlabel">Email *</label>
            <input className="amgr-minput" type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="manager@email.com"/>
          </div>
          <div className="amgr-mfield">
            <label className="amgr-mlabel">{isNew ? 'Password *' : 'New Password'} {!isNew && <span className="amgr-hint-inline">(leave blank to keep current)</span>}</label>
            <input className="amgr-minput" type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder={isNew ? 'Min 8 characters' : 'Enter to change password…'}/>
          </div>
          <div className="amgr-mrow">
            <label className="amgr-mcheck">
              <input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)}/>
              <span>Admin access (can use all admin tools)</span>
            </label>
            <label className="amgr-mcheck">
              <input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)}/>
              <span>Active (can log in)</span>
            </label>
          </div>

          {localError && <div className="amgr-modal-error">{localError}</div>}
        </div>

        <div className="amgr-modal-footer">
          <button className="amgr-cancel" onClick={onClose}>Cancel</button>
          <button className="amgr-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create Account' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
