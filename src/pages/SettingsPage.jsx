import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { TEAMS } from '../data/league'
import LOGOS from '../assets/logos/index.js'
import { createClient } from '@supabase/supabase-js'
import './SettingsPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function SettingsPage() {
  const { manager } = useAuth()
  const abbrev = manager?.team_abbrev
  const team   = TEAMS.find(t => t.abbrev === abbrev)

  // ── Team name ──────────────────────────────────────────────────────────────
  const [teamName,     setTeamName]     = useState(team?.name || '')
  const [nameSaving,   setNameSaving]   = useState(false)
  const [nameMsg,      setNameMsg]      = useState(null)

  async function saveName() {
    if (!teamName.trim()) return
    setNameSaving(true); setNameMsg(null)
    const r = await fetch(`${API}/teams/${abbrev}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-team-abbrev': abbrev },
      body: JSON.stringify({ name: teamName.trim() }),
    })
    const d = await r.json()
    setNameSaving(false)
    setNameMsg(r.ok ? { type: 'ok', text: 'Team name updated! Reload to see it everywhere.' } : { type: 'err', text: d.error || 'Failed to update name' })
  }

  // ── Logo upload ────────────────────────────────────────────────────────────
  const fileRef              = useRef()
  const [logoPreview,  setLogoPreview]  = useState(null)
  const [logoUploading,setLogoUploading]= useState(false)
  const [logoMsg,      setLogoMsg]      = useState(null)

  function onFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setLogoMsg({ type:'err', text:'Please select an image file' }); return }
    if (file.size > 2 * 1024 * 1024)    { setLogoMsg({ type:'err', text:'Image must be under 2MB' }); return }
    setLogoPreview(URL.createObjectURL(file))
    setLogoMsg(null)
  }

  async function uploadLogo() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setLogoUploading(true); setLogoMsg(null)

    const ext  = file.name.split('.').pop()
    const path = `${abbrev}/${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (upErr) { setLogoMsg({ type:'err', text: upErr.message }); setLogoUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)

    const r = await fetch(`${API}/teams/${abbrev}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-team-abbrev': abbrev },
      body: JSON.stringify({ logo_url: publicUrl }),
    })
    const d = await r.json()
    setLogoUploading(false)
    setLogoMsg(r.ok
      ? { type:'ok', text:'Logo updated! Reload to see it everywhere.' }
      : { type:'err', text: d.error || 'Failed to save logo URL' })
  }

  // ── Password change ────────────────────────────────────────────────────────
  const [currPw,    setCurrPw]    = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving,  setPwSaving]  = useState(false)
  const [pwMsg,     setPwMsg]     = useState(null)

  async function changePassword() {
    if (!newPw || !confirmPw) { setPwMsg({ type:'err', text:'Fill in all fields' }); return }
    if (newPw !== confirmPw)  { setPwMsg({ type:'err', text:'New passwords do not match' }); return }
    if (newPw.length < 8)     { setPwMsg({ type:'err', text:'Password must be at least 8 characters' }); return }

    setPwSaving(true); setPwMsg(null)

    // Re-authenticate with current password first
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email:    manager?.email,
      password: currPw,
    })
    if (signInErr) {
      setPwMsg({ type:'err', text:'Current password is incorrect' })
      setPwSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwSaving(false)
    if (error) {
      setPwMsg({ type:'err', text: error.message })
    } else {
      setPwMsg({ type:'ok', text:'Password updated successfully!' })
      setCurrPw(''); setNewPw(''); setConfirmPw('')
    }
  }

  const currentLogo = logoPreview || LOGOS[abbrev]

  return (
    <div className="settings-root">
      <div className="settings-header">
        <h1 className="settings-title">Team Settings</h1>
        <p className="settings-sub">{abbrev} · {manager?.display_name}</p>
      </div>

      <div className="settings-body">

        {/* ── Team Name ── */}
        <div className="settings-card">
          <div className="settings-card-title">Team Name</div>
          <div className="settings-card-desc">
            This is how your team appears throughout the league — scoreboard, standings, rosters, and messages.
          </div>
          <input
            className="settings-input"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="Enter team name…"
            maxLength={60}
          />
          <div className="settings-actions">
            <button className="settings-btn settings-btn--primary" onClick={saveName} disabled={nameSaving || !teamName.trim()}>
              {nameSaving ? 'Saving…' : 'Save Name'}
            </button>
          </div>
          {nameMsg && <div className={`settings-msg settings-msg--${nameMsg.type}`}>{nameMsg.text}</div>}
        </div>

        {/* ── Team Logo ── */}
        <div className="settings-card">
          <div className="settings-card-title">Team Logo</div>
          <div className="settings-card-desc">
            Upload a new logo for your team. PNG or JPG recommended, under 2MB. Square images work best.
          </div>
          <div className="settings-logo-preview-row">
            {currentLogo && (
              <img src={currentLogo} alt="Team logo preview" className="settings-logo-preview"/>
            )}
            <div className="settings-logo-upload">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="settings-file-input"
                id="logo-upload"
                onChange={onFileChange}
              />
              <label htmlFor="logo-upload" className="settings-file-label">
                Choose Image
              </label>
              {fileRef.current?.files?.[0] && (
                <span className="settings-file-name">{fileRef.current.files[0].name}</span>
              )}
            </div>
          </div>
          <div className="settings-actions">
            <button className="settings-btn settings-btn--primary" onClick={uploadLogo}
              disabled={logoUploading || !logoPreview}>
              {logoUploading ? 'Uploading…' : 'Save Logo'}
            </button>
          </div>
          {logoMsg && <div className={`settings-msg settings-msg--${logoMsg.type}`}>{logoMsg.text}</div>}
        </div>

        {/* ── Password ── */}
        <div className="settings-card">
          <div className="settings-card-title">Change Password</div>
          <div className="settings-card-desc">
            Choose a strong password. If you ever get locked out, contact the commissioner to reset it.
          </div>
          <div className="settings-fields">
            <div className="settings-field">
              <label className="settings-label">Current Password</label>
              <input
                className="settings-input"
                type="password"
                value={currPw}
                onChange={e => setCurrPw(e.target.value)}
                placeholder="Current password"
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">New Password</label>
              <input
                className="settings-input"
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="New password (min 8 characters)"
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Confirm New Password</label>
              <input
                className="settings-input"
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                onKeyDown={e => e.key === 'Enter' && changePassword()}
              />
            </div>
          </div>
          <div className="settings-actions">
            <button className="settings-btn settings-btn--primary" onClick={changePassword}
              disabled={pwSaving || !currPw || !newPw || !confirmPw}>
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
          {pwMsg && <div className={`settings-msg settings-msg--${pwMsg.type}`}>{pwMsg.text}</div>}
        </div>

      </div>
    </div>
  )
}
