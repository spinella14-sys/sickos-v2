import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TEAMS, LOGOS } from '../data/league'
import './TradeBlockPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()
const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }

const PLAYER_STATUSES = {
  available:   { label:'On the Block',  color:'#3dba6e', dot:'🟢', short:'AVAILABLE' },
  listening:   { label:'Will Listen',   color:'#d4a843', dot:'🟡', short:'LISTENING' },
  untouchable: { label:'Untouchable',   color:'#d94f4f', dot:'🔴', short:'UNTOUCHABLE' },
}

const PICK_PHILOSOPHY = {
  looking: { label:'Looking for Picks',     color:'#3dba6e', icon:'🟢', short:'Looking for Picks' },
  neutral: { label:'Neutral',               color:'#888',    icon:'⚪', short:'Neutral' },
  willing: { label:'Willing to Trade Picks',color:'#e8822a', icon:'🔄', short:'Willing to Trade' },
}

function statusOf(blocks, sleeperId) {
  return blocks.find(b => b.sleeper_id === sleeperId)?.status || null
}
function noteOf(blocks, sleeperId) {
  return blocks.find(b => b.sleeper_id === sleeperId)?.note || ''
}
function pickPhilosophy(blocks) {
  return blocks.find(b => b.asset_type === 'picks')
}

// ─── Team Block Card (league view) ────────────────────────────────────────────
function TeamBlockCard({ team, blocks, myTeam, navigate }) {
  const onBlock  = blocks.filter(b => b.asset_type==='player' && ['available','listening'].includes(b.status))
  const locked   = blocks.filter(b => b.asset_type==='player' && b.status==='untouchable')
  const pickPhil = pickPhilosophy(blocks)
  const phil     = PICK_PHILOSOPHY[pickPhil?.status] || PICK_PHILOSOPHY.neutral
  const isMyTeam = team.abbrev === myTeam

  return (
    <div className={`tb-card ${isMyTeam?'tb-card--mine':''}`}>
      <div className="tb-card-header">
        <img src={LOGOS[team.abbrev]} alt={team.name} className="tb-card-logo"/>
        <div className="tb-card-meta">
          <div className="tb-card-name">{team.name}</div>
          <div className="tb-card-manager">{team.manager}</div>
        </div>
        {isMyTeam && <span className="tb-card-mine-badge">My Block</span>}
      </div>

      <div className="tb-pick-row" style={{borderColor:`${phil.color}33`,background:`${phil.color}0a`}}>
        <span className="tb-pick-icon">{phil.icon}</span>
        <div>
          <div className="tb-pick-label">Draft Picks</div>
          <div className="tb-pick-value" style={{color:phil.color}}>{phil.short}</div>
        </div>
        {pickPhil?.note && <div className="tb-pick-note">"{pickPhil.note}"</div>}
      </div>

      {onBlock.length > 0 && (
        <div className="tb-section">
          <div className="tb-section-label tb-section-label--available">On the Block ({onBlock.length})</div>
          {onBlock.map(b => {
            const p  = b.player || {}
            const c  = b.contract || {}
            const st = PLAYER_STATUSES[b.status]
            return (
              <div key={b.id} className="tb-player-row">
                <img src={`https://sleepercdn.com/content/nfl/players/thumb/${b.sleeper_id}.jpg`}
                  alt="" className="tb-player-shot" onError={e=>e.target.style.opacity=0}/>
                <div className="tb-player-info">
                  <div className="tb-player-name">{p.full_name || b.sleeper_id}</div>
                  <div className="tb-player-meta">
                    <span style={{color:POS_COLOR[p.position]}}>{p.position}</span>
                    <span className="tb-player-nfl">{p.nfl_team}</span>
                    {p.injury_status && <span className="tb-inj">{p.injury_status}</span>}
                  </div>
                </div>
                <div className="tb-player-right">
                  <div className="tb-player-sal">${parseFloat(c.salary||0).toFixed(2)}</div>
                  <div style={{color:st.color,fontSize:9,fontWeight:800,letterSpacing:'0.08em'}}>{st.short}</div>
                </div>
              </div>
            )
          })}
          {onBlock.filter(b=>b.note).map(b => (
            <div key={`note-${b.id}`} className="tb-player-note">"{b.note}"</div>
          ))}
        </div>
      )}

      {locked.length > 0 && (
        <div className="tb-section">
          <div className="tb-section-label tb-section-label--locked">Untouchable ({locked.length})</div>
          <div className="tb-locked-grid">
            {locked.map(b => (
              <div key={b.id} className="tb-locked-chip">
                <span style={{color:POS_COLOR[b.player?.position]}}>{b.player?.position}</span>
                <span>{b.player?.full_name?.split(' ').slice(-1)[0] || b.sleeper_id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {onBlock.length === 0 && locked.length === 0 && (
        <div className="tb-empty-block">No designations set</div>
      )}

      <div className="tb-card-footer">
        {!isMyTeam && myTeam && (
          <button className="tb-propose-btn"
            onClick={()=>navigate(`/trade?teams=${myTeam},${team.abbrev}`)}>
            Propose Trade →
          </button>
        )}
        {/* Fix: use navigate with ?edit=1 so route works */}
        {isMyTeam && (
          <button className="tb-edit-btn" onClick={()=>navigate('/trade-block?edit=1')}>
            Edit My Block →
          </button>
        )}
      </div>
    </div>
  )
}

// ─── My Block Edit View ───────────────────────────────────────────────────────
function MyBlockEdit({ myTeam, allBlocks, onSaved, navigate }) {
  const [roster,      setRoster]      = useState([])
  const [blocks,      setBlocks]      = useState(allBlocks)
  const [saving,      setSaving]      = useState({})
  const [saveError,   setSaveError]   = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [pickPhil,    setPickPhil]    = useState(pickPhilosophy(allBlocks)?.status || 'neutral')
  const [pickNote,    setPickNote]    = useState(pickPhilosophy(allBlocks)?.note || '')
  const [editNote,    setEditNote]    = useState(null)
  const [noteText,    setNoteText]    = useState('')

  // Sync blocks + pick state when parent reloads after save
  useEffect(() => {
    setBlocks(allBlocks)
    const pp = pickPhilosophy(allBlocks)
    if (pp) { setPickPhil(pp.status); setPickNote(pp.note || '') }
  }, [allBlocks])

  const hdrs = useCallback(() => ({
    'Content-Type':'application/json',
    'x-team-abbrev': myTeam,
  }), [myTeam])

  useEffect(() => {
    if (!myTeam) return
    fetch(`${API}/teams/${myTeam}`).then(r=>r.ok?r.json():null)
      .then(d => setRoster(d?.roster || []))
  }, [myTeam])

  function flashSuccess(msg) {
    setSaveSuccess(msg)
    setTimeout(() => setSaveSuccess(''), 2000)
  }

  async function setPlayerStatus(sleeperId, status) {
    setSaving(p=>({...p,[sleeperId]:true}))
    setSaveError('')
    try {
      if (status === null) {
        const r = await fetch(`${API}/trade-block/player/${sleeperId}`, {
          method:'DELETE', headers: hdrs()
        })
        if (r.ok) {
          setBlocks(prev => prev.filter(b => b.sleeper_id !== sleeperId))
          flashSuccess('Removed')
          if (onSaved) onSaved()
        } else {
          const d = await r.json()
          setSaveError(d.error || 'Failed to remove')
        }
      } else {
        const note = editNote === sleeperId ? noteText : noteOf(blocks, sleeperId)
        const r = await fetch(`${API}/trade-block/player`, {
          method:'POST', headers: hdrs(),
          body: JSON.stringify({ sleeper_id: sleeperId, status, note }),
        })
        const data = await r.json()
        if (r.ok) {
          setBlocks(prev => [...prev.filter(b=>b.sleeper_id!==sleeperId), data])
          flashSuccess('Saved!')
          if (onSaved) onSaved()
        } else {
          setSaveError(data.error || `Save failed (${r.status}) — make sure the trade_block table exists in Supabase`)
        }
      }
    } catch(e) {
      setSaveError(`Network error: ${e.message}`)
    }
    setSaving(p=>({...p,[sleeperId]:false}))
  }

  async function savePickPhilosophy() {
    setSaving(p=>({...p,'picks':true}))
    setSaveError('')
    try {
      const r = await fetch(`${API}/trade-block/picks`, {
        method:'POST', headers: hdrs(),
        body: JSON.stringify({ status: pickPhil, note: pickNote }),
      })
      const data = await r.json()
      if (r.ok) {
        flashSuccess('Pick philosophy saved!')
        if (onSaved) onSaved()
      } else {
        setSaveError(data.error || `Save failed (${r.status}) — make sure the trade_block table exists in Supabase`)
      }
    } catch(e) {
      setSaveError(`Network error: ${e.message}`)
    }
    setSaving(p=>({...p,'picks':false}))
  }

  const byPos = useMemo(() => {
    const map = { QB:[], RB:[], WR:[], TE:[] }
    roster.forEach(r => {
      const pos  = r.players?.position
      const slot = r.roster_slots?.[0]?.slot_type||'active'
      if (map[pos] && slot==='active') map[pos].push(r)
    })
    return map
  }, [roster])

  return (
    <div className="tb-edit-root">
      <div className="tb-edit-header">
        <button className="tb-back-btn" onClick={()=>navigate('/trade-block')}>← Back to League</button>
        <h2 className="tb-edit-title">My Trade Block</h2>
        <p className="tb-edit-sub">Set your availability for each player. "On the Block" and "Will Listen" players appear on your public card.</p>
        {saveError && (
          <div className="tb-save-error">⚠ {saveError}</div>
        )}
        {saveSuccess && (
          <div className="tb-save-success">✓ {saveSuccess}</div>
        )}
      </div>

      {/* Pick philosophy */}
      <div className="tb-edit-section">
        <div className="tb-edit-section-title">🏈 Draft Pick Philosophy</div>
        <div className="tb-pick-options">
          {Object.entries(PICK_PHILOSOPHY).map(([k,v]) => (
            <button key={k}
              className={`tb-pick-option ${pickPhil===k?'tb-pick-option--active':''}`}
              style={{
                '--pk-color': v.color,
                borderColor: pickPhil===k ? v.color : 'var(--border)',
                color:        pickPhil===k ? v.color : 'var(--text-muted)',
                background:   pickPhil===k ? `${v.color}18` : 'none',
              }}
              onClick={()=>setPickPhil(k)}>
              <span>{v.icon}</span>
              <span>{v.label}</span>
            </button>
          ))}
        </div>
        <div className="tb-pick-note-row">
          <input className="tb-note-input"
            placeholder="Optional note (e.g. 'Only trade picks for proven starters')"
            value={pickNote} onChange={e=>setPickNote(e.target.value)}/>
          <button className="tb-save-pick-btn"
            onClick={savePickPhilosophy} disabled={saving['picks']}>
            {saving['picks'] ? '…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Roster by position */}
      {Object.entries(byPos).map(([pos, players]) => {
        if (!players.length) return null
        return (
          <div key={pos} className="tb-edit-section">
            <div className="tb-edit-section-title" style={{color:POS_COLOR[pos]}}>
              {pos} ({players.length})
            </div>
            {players.map(r => {
              const p   = r.players || {}
              const cur = statusOf(blocks, p.sleeper_id)
              const isEditing = editNote === p.sleeper_id
              const isSaving  = saving[p.sleeper_id]

              return (
                <div key={r.id} className={`tb-edit-row ${cur?`tb-edit-row--${cur}`:''}`}>
                  <img src={`https://sleepercdn.com/content/nfl/players/thumb/${p.sleeper_id}.jpg`}
                    alt="" className="tb-edit-shot" onError={e=>e.target.style.opacity=0}/>
                  <div className="tb-edit-info">
                    <div className="tb-edit-name">{p.full_name}</div>
                    <div className="tb-edit-detail">
                      <span>{p.nfl_team}</span>
                      <span>${parseFloat(r.salary||0).toFixed(2)}</span>
                      <span>{r.years}yr</span>
                    </div>
                  </div>
                  <div className="tb-status-btns">
                    {[['available','🟢 On Block'],['listening','🟡 Listening'],['untouchable','🔴 Untouchable']].map(([st,lbl]) => {
                      const stMeta = PLAYER_STATUSES[st]
                      const isActive = cur === st
                      return (
                        <button key={st}
                          className={`tb-status-btn ${isActive?'tb-status-btn--active':''}`}
                          style={isActive ? {
                            background: stMeta.color,
                            color: '#000',
                            borderColor: stMeta.color,
                          } : {}}
                          disabled={isSaving}
                          onClick={()=>{
                            if (isActive) setPlayerStatus(p.sleeper_id, null)
                            else setPlayerStatus(p.sleeper_id, st)
                          }}>
                          {isSaving ? '…' : lbl}
                        </button>
                      )
                    })}
                  </div>

                  {cur && cur !== 'untouchable' && (
                    <div className="tb-note-area">
                      {isEditing ? (
                        <div className="tb-note-edit">
                          <input className="tb-note-input"
                            placeholder="Add a note…"
                            value={noteText} onChange={e=>setNoteText(e.target.value)}
                            onKeyDown={e=>{
                              if (e.key==='Enter') { setPlayerStatus(p.sleeper_id, cur); setEditNote(null) }
                              if (e.key==='Escape') setEditNote(null)
                            }}
                            autoFocus/>
                          <button className="tb-note-save"
                            onClick={()=>{ setPlayerStatus(p.sleeper_id, cur); setEditNote(null) }}>
                            Save
                          </button>
                        </div>
                      ) : (
                        <button className="tb-note-btn"
                          onClick={()=>{ setEditNote(p.sleeper_id); setNoteText(noteOf(blocks, p.sleeper_id)) }}>
                          {noteOf(blocks, p.sleeper_id) ? `"${noteOf(blocks, p.sleeper_id)}"` : '+ Add note'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TradeBlockPage() {
  const { manager } = useAuth()
  const navigate    = useNavigate()
  const [searchParams] = useSearchParams()

  // Fix: detect ?edit=1 in URL so team card link works
  const [view,      setView]      = useState(searchParams.get('edit') === '1' ? 'edit' : 'league')
  const [allBlocks, setAllBlocks] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')

  const myTeam = manager?.team_abbrev

  const loadBlocks = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`${API}/trade-block`)
    const data = await r.json()
    setAllBlocks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadBlocks() }, [loadBlocks])

  // Sync view when URL param changes (e.g. browser back)
  useEffect(() => {
    setView(searchParams.get('edit') === '1' ? 'edit' : 'league')
  }, [searchParams])

  const byTeam = useMemo(() => {
    const map = {}
    allBlocks.forEach(b => {
      if (!map[b.team_abbrev]) map[b.team_abbrev] = []
      map[b.team_abbrev].push(b)
    })
    return map
  }, [allBlocks])

  const filteredTeams = useMemo(() =>
    TEAMS.filter(t => {
      if (filter === 'available') {
        return (byTeam[t.abbrev]||[]).some(b => b.asset_type==='player' && ['available','listening'].includes(b.status))
      }
      return true
    }), [filter, byTeam])

  if (view === 'edit') {
    return (
      <MyBlockEdit
        myTeam={myTeam}
        allBlocks={allBlocks.filter(b=>b.team_abbrev===myTeam)}
        onSaved={loadBlocks}
        navigate={navigate}/>
    )
  }

  return (
    <div className="tb-root">
      <div className="tb-header">
        <div className="tb-header-left">
          <h1 className="tb-title">Trade Block</h1>
          <p className="tb-sub">See who's available across the league. Broadcast your own availability.</p>
        </div>
        <div className="tb-header-right">
          {myTeam && (
            <button className="tb-myblock-btn" onClick={()=>navigate('/trade-block?edit=1')}>
              Edit My Block →
            </button>
          )}
        </div>
      </div>
      <div className="tb-filter-bar">
        <div className="tb-filter-tabs">
          {[['all','All Teams'],['available','Has Players Available']].map(([k,l]) => (
            <button key={k}
              className={`tb-filter-tab ${filter===k?'tb-filter-tab--active':''}`}
              onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="tb-refresh-btn" onClick={loadBlocks}>↺ Refresh</button>
      </div>
      {loading ? (
        <div className="tb-loading">Loading trade block…</div>
      ) : (
        <div className="tb-grid">
          {filteredTeams.map(team => (
            <TeamBlockCard key={team.abbrev} team={team}
              blocks={byTeam[team.abbrev]||[]}
              myTeam={myTeam} navigate={navigate}/>
          ))}
        </div>
      )}
    </div>
  )
}
