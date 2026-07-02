import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TEAMS, LOGOS } from '../data/league'
import DraftOrderPanel from '../components/draft/DraftOrderPanel'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import './DraftBoardPage.css'

const API  = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const YEAR = 2026

const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }
const POSITIONS = ['ALL','QB','RB','WR','TE']

const getTeamName = (abbrev) => TEAMS.find(t => t.abbrev === abbrev)?.name || abbrev || '—'
const getTeamLogo = (abbrev) => LOGOS[abbrev] || ''

export default function DraftBoardPage() {
  const navigate = useNavigate()
  const { manager } = useAuth()
  const myTeam = manager?.team_abbrev

  const [board,          setBoard]          = useState([])
  const [allPicks,       setAllPicks]       = useState([])
  const [ownership,      setOwnership]      = useState({})
  const [activeRound,    setActiveRound]    = useState(1)
  const [posFilter,      setPosFilter]      = useState('ALL')
  const [search,         setSearch]         = useState('')
  const [saveStatus,     setSaveStatus]     = useState('clean')
  const [toast,          setToast]          = useState('')
  const [loading,        setLoading]        = useState(true)
  const [draftDone,      setDraftDone]      = useState(false)
  const [ownershipReady, setOwnershipReady] = useState(false)

  // Drag: only triggered from handle, not the whole row
  const dragIdx    = useRef(null)
  const isDragging = useRef(false)
  const toastTimer = useRef(null)

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
  }

  // ── Load rookies + saved board + picks ────────────────────────────────────
  useEffect(() => {
    if (!myTeam) return
    Promise.all([
      fetch(`${API}/draft/rookies`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/draft/bigboard/${myTeam}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/draft/picks`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/draft/state`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([rookies, boardData, picksData, stateRes]) => {
      setDraftDone(stateRes?.state?.status === 'completed')
      setAllPicks(Array.isArray(picksData) ? picksData : [])

      if (boardData.length > 0) {
        const poolMap = {}
        rookies.forEach(r => { poolMap[r.sleeper_id] = r })
        const ranked = boardData
          .filter(b => poolMap[b.sleeper_id])
          .map(b => ({ ...poolMap[b.sleeper_id], rank: b.rank }))
          .sort((a, b) => a.rank - b.rank)
        const boardIds = new Set(ranked.map(b => b.sleeper_id))
        const unranked = rookies
          .filter(r => !boardIds.has(r.sleeper_id))
          .map((r, i) => ({ ...r, rank: ranked.length + i + 1 }))
        setBoard([...ranked, ...unranked])
      } else {
        const sorted = [...rookies].sort((a, b) =>
          (a.nfl_draft_pick ?? 9999) - (b.nfl_draft_pick ?? 9999)
        )
        setBoard(sorted.map((r, i) => ({ ...r, rank: i + 1 })))
      }
      setLoading(false)
    })
  }, [myTeam])

  useEffect(() => {
    fetch(`${API}/draft/rookies/ownership`)
      .then(r => r.ok ? r.json() : {})
      .then(data => { setOwnership(data || {}); setOwnershipReady(true) })
      .catch(() => setOwnershipReady(true))
  }, [])

  // ── Save board ────────────────────────────────────────────────────────────
  const saveBoard = useCallback(async (list) => {
    if (!myTeam || !list.length) return
    setSaveStatus('saving')
    try {
      const rankings = list.map((p, i) => ({ sleeper_id: p.sleeper_id, rank: i + 1 }))
      const r = await fetch(`${API}/draft/bigboard/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: myTeam, rankings }),
      })
      if (r.ok) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('clean'), 2500)
        showToast(`Board saved — ${rankings.length} players ranked`)
      } else {
        const err = await r.json().catch(() => ({}))
        setSaveStatus('error')
        showToast(`Save failed: ${err.error || r.status}`)
        setTimeout(() => setSaveStatus('dirty'), 3000)
      }
    } catch (e) {
      setSaveStatus('error')
      showToast('Save failed — check console')
      setTimeout(() => setSaveStatus('dirty'), 3000)
    }
  }, [myTeam])

  // ── Sort helpers ──────────────────────────────────────────────────────────
  function resetToNflOrder() {
    if (!board.length) return
    const next = [...board]
      .sort((a, b) => (a.nfl_draft_pick ?? 9999) - (b.nfl_draft_pick ?? 9999))
      .map((p, i) => ({ ...p, rank: i + 1 }))
    setBoard(next)
    setSaveStatus('dirty')
    const count = next.filter(p => p.nfl_draft_pick).length
    showToast(`NFL Draft order applied — ${count} with picks, ${next.length - count} UDFA`)
  }

  function resetToOwnership() {
    if (!board.length) return
    const count = board.filter(p => (ownership[p.sleeper_id] ?? 0) > 0).length
    if (count === 0) {
      showToast('No % owned data — run Sync Rookie Pool from Draft Central first')
      return
    }
    const next = [...board]
      .sort((a, b) => {
        const ao = ownership[a.sleeper_id] ?? -1
        const bo = ownership[b.sleeper_id] ?? -1
        return bo !== ao ? bo - ao : (a.nfl_draft_pick ?? 9999) - (b.nfl_draft_pick ?? 9999)
      })
      .map((p, i) => ({ ...p, rank: i + 1 }))
    setBoard(next)
    setSaveStatus('dirty')
    showToast(`% Owned order applied — ${count} players with data`)
  }

  // ── Move to specific rank ─────────────────────────────────────────────────
  function moveToRank(fromIdx, targetRank) {
    const toIdx = Math.max(0, Math.min(board.length - 1, targetRank - 1))
    if (fromIdx === toIdx) return
    const next = [...board]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setBoard(next.map((p, i) => ({ ...p, rank: i + 1 })))
    setSaveStatus('dirty')
    showToast(`Moved ${moved.full_name} to #${targetRank}`)
  }

  // ── Drag — handle only triggers drag ─────────────────────────────────────
  // The drag handle is the ONLY draggable element.
  // The row is the drop target only — so player name clicks work fine.
  function handleHandleDragStart(e, idx) {
    dragIdx.current = idx
    isDragging.current = true
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleRowDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleRowDrop(e, idx) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    const next = [...board]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(idx, 0, moved)
    setBoard(next.map((p, i) => ({ ...p, rank: i + 1 })))
    dragIdx.current = null
    isDragging.current = false
    setSaveStatus('dirty')
  }

  function handleDragEnd() {
    dragIdx.current = null
    isDragging.current = false
  }

  // ── Filtered display ──────────────────────────────────────────────────────
  const displayed = board.filter(p => {
    if (posFilter !== 'ALL' && p.position !== posFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return p.full_name?.toLowerCase().includes(q) ||
             (p.nfl_team || '').toLowerCase().includes(q) ||
             (p.college || '').toLowerCase().includes(q)
    }
    return true
  })

  const ownedCount = Object.values(ownership).filter(v => v > 0).length

  const saveLabel = { clean:'✓ Saved', dirty:'Save Board', saving:'Saving…', saved:'✓ Saved!', error:'Retry Save' }[saveStatus]
  const saveCls   = `db-save-btn db-save-btn--${saveStatus}`

  if (!myTeam) return <div className="db-root"><div className="db-empty"><h2>Sign in to manage your big board</h2></div></div>
  if (loading)  return <div className="db-root"><div className="db-loading"><div className="db-spinner"/><span>Loading prospects…</span></div></div>
  if (draftDone) return (
    <div className="db-root">
      <div className="db-header">
        <button className="db-back" onClick={() => navigate('/draft')}>‹ Draft Central</button>
        <h1 className="db-title">Draft Board — {YEAR}</h1>
      </div>
      <div className="db-empty">
        <div className="db-empty-icon">✓</div>
        <h2>Draft Complete</h2>
        <p>The {YEAR} rookie draft has concluded.</p>
        <button className="db-empty-btn" onClick={() => navigate(`/team/${myTeam}`)}>View My Roster →</button>
      </div>
    </div>
  )

  return (
    <div className="db-root">
      {toast && <div className="db-toast">{toast}</div>}

      {/* Header */}
      <div className="db-header">
        <div className="db-header-left">
          <button className="db-back" onClick={() => navigate('/draft')}>‹ Draft Central</button>
          <div>
            <h1 className="db-title">My Big Board — {YEAR}</h1>
            <p className="db-sub">{myTeam} · Private · Used for autodraft in the Rookie Draft room</p>
          </div>
        </div>
        <div className="db-header-right">
          <span className="db-count">{board.length} prospects</span>
          <button className={saveCls}
            onClick={() => saveBoard(board)}
            disabled={saveStatus === 'saving' || saveStatus === 'clean' || saveStatus === 'saved'}>
            {saveLabel}
          </button>
        </div>
      </div>

      {/* Sort starting point */}
      <div className="db-sort-bar">
        <div className="db-sort-label">
          <span className="db-sort-title">SET STARTING ORDER</span>
          <span className="db-sort-sub">Pick a starting point, then drag the ⠿ handle on any row to fine-tune</span>
        </div>
        <div className="db-sort-btns">
          <button className="db-sort-btn" onClick={resetToNflOrder}>
            <span className="db-sort-btn-icon">🏈</span>
            <span className="db-sort-btn-text">
              <span className="db-sort-btn-label">NFL Draft Order</span>
              <span className="db-sort-btn-desc">
                {board.filter(p => p.nfl_draft_pick).length} with picks · {board.filter(p => !p.nfl_draft_pick).length} UDFA after
              </span>
            </span>
          </button>
          <button className="db-sort-btn" onClick={resetToOwnership}>
            <span className="db-sort-btn-icon">📊</span>
            <span className="db-sort-btn-text">
              <span className="db-sort-btn-label">% Owned</span>
              <span className="db-sort-btn-desc">
                {!ownershipReady ? 'Loading…' : ownedCount > 0 ? `${ownedCount} players with data` : 'Run sync to populate'}
              </span>
            </span>
          </button>
        </div>
        <span className="db-drag-hint">⠿ Drag handle to reorder · Type # in Move column to jump</span>
      </div>

      {/* Unsaved banner */}
      {saveStatus === 'dirty' && (
        <div className="db-unsaved-bar">
          Unsaved changes —
          <button className="db-unsaved-save" onClick={() => saveBoard(board)}>Save Now</button>
        </div>
      )}

      {/* Two-column body */}
      <div className="db-body">
        <DraftOrderPanel
          allPicks={allPicks}
          activeRound={activeRound}
          setActiveRound={setActiveRound}
          currentPickNumber={null}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
        />

        <div className="db-main">
          {/* Filters */}
          <div className="db-filters">
            <div className="db-pos-tabs">
              {POSITIONS.map(p => (
                <button key={p}
                  className={`db-pos-tab ${posFilter===p?'db-pos-tab--active':''}`}
                  style={posFilter===p && POS_COLOR[p] ? { borderColor:POS_COLOR[p], color:POS_COLOR[p] } : {}}
                  onClick={() => setPosFilter(p)}>{p}</button>
              ))}
            </div>
            <input className="db-search" placeholder="Search players, teams, colleges…"
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>

          {/* Col headers — drag | rank | shot | player | pos | nfl | pick | own | move */}
          <div className="db-col-headers">
            <span/>
            <span>RK</span>
            <span/>
            <span>PLAYER</span>
            <span>POS</span>
            <span>NFL</span>
            <span>PICK</span>
            <span>%OWN</span>
            <span>MOVE</span>
          </div>

          <div className="db-list">
            {displayed.length === 0 && (
              <div className="db-empty-filter">No players match your filters.</div>
            )}
            {displayed.map(rookie => {
              const fullIdx  = board.findIndex(b => b.sleeper_id === rookie.sleeper_id)
              const pctOwned = ownership[rookie.sleeper_id] ?? rookie.percent_owned

              return (
                <div
                  key={rookie.sleeper_id}
                  className="db-row"
                  onDragOver={handleRowDragOver}
                  onDrop={e => handleRowDrop(e, fullIdx)}
                >
                  {/* Drag handle — ONLY draggable element */}
                  <div
                    className="db-drag-handle"
                    draggable
                    onDragStart={e => handleHandleDragStart(e, fullIdx)}
                    onDragEnd={handleDragEnd}
                    title="Drag to reorder"
                  >⠿</div>

                  <div className="db-rank">{rookie.rank}</div>

                  <div className="db-shot-wrap">
                    <img src={`https://sleepercdn.com/content/nfl/players/thumb/${rookie.sleeper_id}.jpg`}
                      alt="" className="db-shot" onError={e => e.target.style.opacity = 0}/>
                  </div>

                  {/* Player name — PlayerLink works because row is NOT draggable */}
                  <div className="db-player">
                    <PlayerLink playerId={rookie.sleeper_id} className="db-name">
                      {rookie.full_name}
                    </PlayerLink>
                    {(rookie.age || rookie.college) && (
                      <div className="db-age">
                        {[rookie.age ? `${rookie.age}y` : null, rookie.college].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>

                  <div>
                    <span style={{ fontFamily:'var(--font-ui)', fontSize:11, fontWeight:800,
                      padding:'2px 6px', background:`${POS_COLOR[rookie.position]}22`, color:POS_COLOR[rookie.position] }}>
                      {rookie.position}
                    </span>
                  </div>

                  <div>
                    {rookie.nfl_team
                      ? <img src={`https://sleepercdn.com/images/team_logos/nfl/${rookie.nfl_team?.toLowerCase()}.jpg`}
                          alt={rookie.nfl_team} style={{ width:22, height:22, objectFit:'contain' }}
                          onError={e => { e.target.replaceWith(Object.assign(document.createElement('span'), { textContent: rookie.nfl_team, style:'font-size:10px;color:rgba(255,255,255,0.5)' })) }}/>
                      : <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>—</span>}
                  </div>

                  <div className="db-pick">
                    {rookie.nfl_draft_pick
                      ? <><span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>R{rookie.nfl_draft_round} </span>#{rookie.nfl_draft_pick}</>
                      : <span style={{color:'rgba(255,255,255,0.3)',fontSize:10}}>UDFA</span>}
                  </div>

                  <div className="db-own">
                    {pctOwned != null && parseFloat(pctOwned) > 0
                      ? <span style={{ color: parseFloat(pctOwned) >= 50 ? '#e8822a' : 'rgba(255,255,255,0.55)',
                          fontWeight: parseFloat(pctOwned) >= 50 ? 700 : 400 }}>
                          {parseFloat(pctOwned).toFixed(0)}%
                        </span>
                      : <span style={{color:'rgba(255,255,255,0.2)'}}>—</span>}
                  </div>

                  {/* Move-to input — type a rank number + Enter */}
                  <div className="db-move-wrap">
                    <input
                      className="db-move-input"
                      type="number"
                      placeholder="→"
                      min={1}
                      max={board.length}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const target = parseInt(e.target.value)
                          if (target >= 1 && target <= board.length) {
                            moveToRank(fullIdx, target)
                            e.target.value = ''
                            e.target.blur()
                          }
                        }
                        if (e.key === 'Escape') { e.target.value = ''; e.target.blur() }
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="db-footer-tip">
            Your board is private — only you can see it. Saved order is used for autodraft in the Rookie Draft room.
          </div>
        </div>
      </div>
    </div>
  )
}
