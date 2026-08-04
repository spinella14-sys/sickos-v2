#!/usr/bin/env python3
"""
Patch 4 (frontend) — Drag-and-drop lineup/roster redesign
- Replaces the <select> MoveDropdown with native HTML5 drag-and-drop
- Splits save behavior: pure lineup<->bench moves save INSTANTLY (fixes the
  save-doesn't-persist bug); anything touching PS/IR stays on the existing
  staged + explicit "Save Lineup" button flow (cap/QB-limit validation lives there)
- Old MoveDropdown component is left in place, unused — safe no-op, makes
  reverting easier if you want to go back to the dropdown UI

Run from ~/Downloads/sickos-v2
    python3 patch_lineup_dnd.py

PRE-CHANGE COMMIT (for full revert if needed): e9ce5b1
"""
import sys
from pathlib import Path

ROOT = Path.cwd()
TEAM_PAGE = ROOT / "src" / "pages" / "TeamPage.jsx"
TEAM_PAGE_CSS = ROOT / "src" / "pages" / "TeamPage.css"


def apply_patch(path: Path, old: str, new: str, label: str):
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        print(f"FAILED — expected exactly 1 match for [{label}], found {count}.")
        print("--- expected old_str ---")
        print(old)
        sys.exit(1)
    path.write_text(text.replace(old, new, 1))
    print(f"OK — patched [{label}]")


# ═══════════════════════════════════════════════════════════════════════
# 1. New state
# ═══════════════════════════════════════════════════════════════════════
STATE_OLD = "  const [dropTarget,      setDropTarget]      = useState(null)  // contract pending drop confirmation"
STATE_NEW = """  const [dropTarget,      setDropTarget]      = useState(null)  // contract pending drop confirmation
  const [dragCard,        setDragCard]        = useState(null)  // contract currently being dragged
  const [dragOverKey,     setDragOverKey]     = useState(null)  // drop-zone key currently hovered
  const [moveMsg,         setMoveMsg]         = useState('')    // instant-move feedback toast"""

# ═══════════════════════════════════════════════════════════════════════
# 3. Helper functions + attemptMove, inserted before handleMove
# ═══════════════════════════════════════════════════════════════════════
HANDLEMOVE_OLD = """  function isPlayerLocked(contract) {
    const sleeperId = contract.players?.sleeper_id || contract.sleeper_id
    return weeklyLineup.find(r => r.sleeper_id === sleeperId)?.is_locked ?? false
  }

  // ── Handle move — only updates UI state, no API calls ─────────────────
  function handleMove(contractId, newSlot) {"""

HANDLEMOVE_NEW = """  function isPlayerLocked(contract) {
    const sleeperId = contract.players?.sleeper_id || contract.sleeper_id
    return weeklyLineup.find(r => r.sleeper_id === sleeperId)?.is_locked ?? false
  }

  // ── Drag & drop: source location + valid target keys for a contract ────
  function getEffectiveSlot(contract) {
    const cid = contract.id || contract.sleeper_id
    return slotOverrides[cid] || contract.roster_slots?.[0]?.slot_type || 'active'
  }

  function getSourceLoc(contract) {
    const cid = contract.id || contract.sleeper_id
    const effSlot = getEffectiveSlot(contract)
    if (effSlot === 'ps') return 'ps'
    if (effSlot === 'ir') return 'ir'
    const lineupKey = Object.entries(lineupAssign).find(([, v]) => v === cid)?.[0]
    return lineupKey ? `lineup:${lineupKey}` : 'bench'
  }

  function getValidTargets(contract) {
    const cid = contract.id || contract.sleeper_id
    const pos = contract.players?.position
    const effSlot = getEffectiveSlot(contract)
    const isOnPS = effSlot === 'ps'
    const isOnIR = effSlot === 'ir'
    const activeQBs = (activeRoster || []).filter(r =>
      r.players?.position === 'QB' && (r.id || r.sleeper_id) !== cid
    ).length
    const targets = new Set()

    if (isOnPS || isOnIR) {
      const canActivate = pos !== 'QB' || activeQBs < 2
      if (canActivate) {
        targets.add('bench')
        for (const slot of LINEUP_SLOTS) {
          if (slot.eligible.includes(pos)) targets.add(`lineup:${slot.key}`)
        }
      }
    } else {
      for (const slot of LINEUP_SLOTS) {
        if (slot.eligible.includes(pos)) targets.add(`lineup:${slot.key}`)
      }
      targets.add('bench')
      const psQBs = (psRoster || []).filter(r => r.players?.position === 'QB').length
      if (!(pos === 'QB' && psQBs >= 1)) targets.add('ps')
      if (['Out','IR','PUP'].includes(contract.players?.injury_status)) targets.add('ir')
    }
    return targets
  }

  // ── Drag & drop: attempt a move. Pure lineup<->bench shuffles (no cap
  // implications) save INSTANTLY. Anything touching PS/IR stays on the
  // existing staged flow (Save Lineup button) since that's where cap/QB-limit
  // validation lives.
  async function attemptMove(contract, targetKey) {
    const cid = contract.id || contract.sleeper_id
    if (!getValidTargets(contract).has(targetKey)) {
      setMoveMsg('Invalid move ✗')
      setTimeout(() => setMoveMsg(''), 2000)
      return
    }
    const sourceLoc      = getSourceLoc(contract)
    const sourceIsActive = sourceLoc === 'bench' || sourceLoc.startsWith('lineup:')
    const targetIsActive = targetKey === 'bench' || targetKey.startsWith('lineup:')

    if (sourceIsActive && targetIsActive) {
      const sleeperId = contract.players?.sleeper_id || contract.sleeper_id
      if (!sleeperId) return
      const newSlotType = targetKey === 'bench' ? 'BN' : keyToSlotType(targetKey.split(':')[1])
      const headers = {
        'Content-Type':     'application/json',
        'x-team-abbrev':    manager?.team_abbrev || '',
        'x-admin-password': isAdmin ? (localStorage.getItem('adminPw') || '') : '',
      }
      try {
        const r = await fetch(`${API_BASE}/lineup/${abbrev.toUpperCase()}/move`, {
          method:'PATCH', headers,
          body: JSON.stringify({ sleeper_id: sleeperId, new_slot: newSlotType, season: CURRENT_SEASON, week: currentWeek }),
        })
        if (r.ok) {
          const { lineup } = await r.json()
          setWeeklyLineup(Array.isArray(lineup) ? lineup : [])
          setMoveMsg('Saved ✓')
        } else {
          const body = await r.json().catch(() => ({}))
          setMoveMsg(body.error || 'Move failed ✗')
        }
      } catch {
        setMoveMsg('Move failed ✗')
      }
      setTimeout(() => setMoveMsg(''), 2000)
    } else {
      handleMove(cid, targetKey)
    }
  }

  // ── Handle move — only updates UI state, no API calls ─────────────────
  function handleMove(contractId, newSlot) {"""

# ═══════════════════════════════════════════════════════════════════════
# 4. EmptySlotRow — becomes a drop zone
# ═══════════════════════════════════════════════════════════════════════
EMPTYSLOT_OLD = """function EmptySlotRow({ slot, canEdit }) {
  const extraCols = canEdit ? 10 : 9
  return (
    <tr className="rtr rtr--empty">
      <td className="rtr-slot">
        <span className="rtr-slot-label" style={{ borderLeftColor:'var(--border)', color:'var(--text-muted)' }}>
          {slot.label}
        </span>
      </td>
      <td className="rtr-player">
        <div className="rtr-empty-cell">
          <div className="rtr-empty-avatar"/>
          <span className="rtr-empty-text">Empty — move a {slot.eligible.join('/')} here</span>
        </div>
      </td>
      <td colSpan={extraCols}/>
    </tr>
  )
}"""

EMPTYSLOT_NEW = """function EmptySlotRow({ slot, canEdit, dragCard, dragOverKey, setDragOverKey, onAttemptMove, isEligible }) {
  const extraCols = canEdit ? 10 : 9
  const dropKey = `lineup:${slot.key}`
  const isHover = dragOverKey === dropKey
  const dropProps = dragCard ? {
    onDragOver: e => { e.preventDefault(); setDragOverKey(dropKey) },
    onDrop:     e => { e.preventDefault(); onAttemptMove(dragCard, dropKey) },
  } : {}
  return (
    <tr {...dropProps} className={`rtr rtr--empty ${dragCard ? (isEligible ? 'rtr--dnd-eligible' : 'rtr--dnd-ineligible') : ''} ${isHover ? 'rtr--dnd-hover' : ''}`}>
      <td className="rtr-slot">
        <span className="rtr-slot-label" style={{ borderLeftColor:'var(--border)', color:'var(--text-muted)' }}>
          {slot.label}
        </span>
      </td>
      <td className="rtr-player">
        <div className="rtr-empty-cell">
          <div className="rtr-empty-avatar"/>
          <span className="rtr-empty-text">Empty — move a {slot.eligible.join('/')} here</span>
        </div>
      </td>
      <td colSpan={extraCols}/>
    </tr>
  )
}"""

# ═══════════════════════════════════════════════════════════════════════
# 5. PlayerRow — draggable source + optional drop target
# ═══════════════════════════════════════════════════════════════════════
PLAYERROW_SIG_OLD = """function PlayerRow({ contract, slotLabel, slotColor, lineupAssign, onMove, slotOverride,
  playerStats, isLineupSlot, activeRoster, psRoster, isLocked, canEdit, opponents, defRankings, transNewsIds, onShowNews, onDrop }) {
  const p    = contract.players || {}
  const sid  = p.sleeper_id || contract.sleeper_id
  const sal  = parseFloat(contract.salary || 0)
  const slot = slotOverride || contract.roster_slots?.[0]?.slot_type || 'active'
  const disc = (slot === 'ps' || slot === 'ir') ? 0.5 : contract.is_max_contract ? 0.8 : 1
  const capHit = sal * disc
  const ps   = playerStats || {}
  const isPending = !!slotOverride

  return (
    <tr className={`rtr ${isPending ? 'rtr--pending' : ''} ${isLineupSlot ? 'rtr--lineup' : ''} ${isLocked ? 'rtr--locked' : ''}`}>"""

PLAYERROW_SIG_NEW = """function PlayerRow({ contract, slotLabel, slotColor, lineupAssign, onMove, slotOverride,
  playerStats, isLineupSlot, activeRoster, psRoster, isLocked, canEdit, opponents, defRankings, transNewsIds, onShowNews, onDrop,
  dragCard, setDragCard, setDragOverKey, dropKey, dragOverKey, onAttemptMove, isEligible }) {
  const p    = contract.players || {}
  const sid  = p.sleeper_id || contract.sleeper_id
  const sal  = parseFloat(contract.salary || 0)
  const slot = slotOverride || contract.roster_slots?.[0]?.slot_type || 'active'
  const disc = (slot === 'ps' || slot === 'ir') ? 0.5 : contract.is_max_contract ? 0.8 : 1
  const capHit = sal * disc
  const ps   = playerStats || {}
  const isPending = !!slotOverride
  const cid  = contract.id || contract.sleeper_id
  const isDraggingThis = dragCard && (dragCard.id || dragCard.sleeper_id) === cid
  const isDropZone = !!dropKey
  const isHover = isDropZone && dragOverKey === dropKey

  const rowProps = {}
  if (canEdit && !isLocked) {
    rowProps.draggable = true
    rowProps.onDragStart = () => setDragCard(contract)
    rowProps.onDragEnd   = () => { setDragCard(null); setDragOverKey(null) }
  }
  if (isDropZone) {
    rowProps.onDragOver = e => { e.preventDefault(); setDragOverKey(dropKey) }
    rowProps.onDrop     = e => { e.preventDefault(); if (dragCard) onAttemptMove(dragCard, dropKey) }
  }

  return (
    <tr {...rowProps} className={`rtr ${isPending ? 'rtr--pending' : ''} ${isLineupSlot ? 'rtr--lineup' : ''} ${isLocked ? 'rtr--locked' : ''} ${canEdit && !isLocked ? 'rtr--draggable' : ''} ${isDraggingThis ? 'rtr--dragging' : ''} ${isDropZone && dragCard ? (isEligible ? 'rtr--dnd-eligible' : 'rtr--dnd-ineligible') : ''} ${isHover ? 'rtr--dnd-hover' : ''}`}>"""

PLAYERROW_ACTION_OLD = """      {canEdit && (
        <td className="rtr-action">
          <MoveDropdown contract={contract} lineupAssign={lineupAssign} onMove={onMove}
            currentSlotOverride={slotOverride} activeRoster={activeRoster}
            psRoster={psRoster} isLocked={isLocked}/>
          <button className="rtr-drop-btn" onClick={() => onDrop && onDrop(contract)} title="Drop player">
            Drop
          </button>
        </td>
      )}"""

PLAYERROW_ACTION_NEW = """      {canEdit && (
        <td className="rtr-action">
          {!isLocked && <span className="rtr-drag-handle" title="Drag to move">⠿⠿</span>}
          <button className="rtr-drop-btn" onClick={() => onDrop && onDrop(contract)} title="Drop player">
            Drop
          </button>
        </td>
      )}"""

# ═══════════════════════════════════════════════════════════════════════
# 6. Render sections — Lineup slots, Bench, PS, IR
# ═══════════════════════════════════════════════════════════════════════
SECTIONS_OLD = """                {/* Starting Lineup */}
                <div className="tp-section-hdr tp-section-lineup">
                  <span>STARTING LINEUP</span>
                  <span className="tp-section-note">1 QB · 2 RB · 3 WR · 1 TE · 1 FLEX — locks at individual game kick-offs</span>
                </div>
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {LINEUP_SLOTS.map(slot => {
                        const cid      = lineupAssign[slot.key]
                        const contract = cid ? roster.find(r => (r.id||r.sleeper_id) === cid) : null
                        if (!contract) return <EmptySlotRow key={slot.key} slot={slot} canEdit={canEdit}/>
                        const sid = contract.players?.sleeper_id || contract.sleeper_id
                        return (
                          <PlayerRow key={slot.key} contract={contract}
                            slotLabel={slot.label}
                            slotColor={POS_COLOR[contract.players?.position] || 'var(--orange)'}
                            lineupAssign={lineupAssign} onMove={handleMove}
                            slotOverride={slotOverrides[contract.id||contract.sleeper_id]}
                            playerStats={stats[sid]} isLineupSlot={true}
                            activeRoster={activeRoster} psRoster={psRoster}
                            isLocked={isPlayerLocked(contract)} canEdit={canEdit}
                            opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                            onDrop={setDropTarget}/>
                        )
                      })}
                    </tbody>"""

SECTIONS_NEW = """                {/* Starting Lineup */}
                <div className="tp-section-hdr tp-section-lineup">
                  <span>STARTING LINEUP</span>
                  <span className="tp-section-note">1 QB · 2 RB · 3 WR · 1 TE · 1 FLEX — locks at individual game kick-offs</span>
                </div>
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {LINEUP_SLOTS.map(slot => {
                        const cid      = lineupAssign[slot.key]
                        const contract = cid ? roster.find(r => (r.id||r.sleeper_id) === cid) : null
                        const dropKey  = `lineup:${slot.key}`
                        const isEligible = dragCard ? getValidTargets(dragCard).has(dropKey) : false
                        if (!contract) return (
                          <EmptySlotRow key={slot.key} slot={slot} canEdit={canEdit}
                            dragCard={dragCard} dragOverKey={dragOverKey} setDragOverKey={setDragOverKey}
                            onAttemptMove={attemptMove} isEligible={isEligible}/>
                        )
                        const sid = contract.players?.sleeper_id || contract.sleeper_id
                        return (
                          <PlayerRow key={slot.key} contract={contract}
                            slotLabel={slot.label}
                            slotColor={POS_COLOR[contract.players?.position] || 'var(--orange)'}
                            lineupAssign={lineupAssign} onMove={handleMove}
                            slotOverride={slotOverrides[contract.id||contract.sleeper_id]}
                            playerStats={stats[sid]} isLineupSlot={true}
                            activeRoster={activeRoster} psRoster={psRoster}
                            isLocked={isPlayerLocked(contract)} canEdit={canEdit}
                            opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                            onDrop={setDropTarget}
                            dragCard={dragCard} setDragCard={setDragCard} setDragOverKey={setDragOverKey}
                            dropKey={dropKey} dragOverKey={dragOverKey} onAttemptMove={attemptMove} isEligible={isEligible}/>
                        )
                      })}
                    </tbody>"""

BENCH_WRAP_OLD = """                {/* Bench */}
                <div className="tp-section-hdr tp-section-bench">
                  <span>BENCH ({benchPlayers.length}/{BENCH_SLOTS})</span>
                  <span className="tp-section-note">Active roster · Full cap hit · No scoring</span>
                </div>
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {benchPlayers.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="Bench"
                          slotColor="var(--text-muted)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                          onDrop={setDropTarget}/>
                      ))}"""

BENCH_WRAP_NEW = """                {/* Bench */}
                <div className="tp-section-hdr tp-section-bench">
                  <span>BENCH ({benchPlayers.length}/{BENCH_SLOTS})</span>
                  <span className="tp-section-note">Active roster · Full cap hit · No scoring</span>
                </div>
                <div className={`tp-table-wrap ${dragCard ? (getValidTargets(dragCard).has('bench') ? 'tp-dnd-eligible' : 'tp-dnd-ineligible') : ''} ${dragOverKey==='bench' ? 'tp-dnd-hover' : ''}`}
                  onDragOver={e => { if (dragCard) { e.preventDefault(); setDragOverKey('bench') } }}
                  onDrop={e => { if (dragCard) { e.preventDefault(); attemptMove(dragCard, 'bench') } }}>
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {benchPlayers.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="Bench"
                          slotColor="var(--text-muted)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                          onDrop={setDropTarget}
                          dragCard={dragCard} setDragCard={setDragCard} setDragOverKey={setDragOverKey}/>
                      ))}"""

PS_WRAP_OLD = """                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {psRoster.length === 0 ? (
                        <tr className="rtr rtr--empty">
                          <td className="rtr-slot"><span className="rtr-slot-label" style={{borderLeftColor:'var(--blue)',color:'var(--text-muted)'}}>PS</span></td>
                          <td className="rtr-player"><div className="rtr-empty-cell"><div className="rtr-empty-avatar"/><span className="rtr-empty-text">No players on practice squad</span></div></td>
                          <td colSpan={extraColSpan}/>
                        </tr>
                      ) : psRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="PS"
                          slotColor="var(--blue)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                          onDrop={setDropTarget}/>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* IR */}"""

PS_WRAP_NEW = """                <div className={`tp-table-wrap ${dragCard ? (getValidTargets(dragCard).has('ps') ? 'tp-dnd-eligible' : 'tp-dnd-ineligible') : ''} ${dragOverKey==='ps' ? 'tp-dnd-hover' : ''}`}
                  onDragOver={e => { if (dragCard) { e.preventDefault(); setDragOverKey('ps') } }}
                  onDrop={e => { if (dragCard) { e.preventDefault(); attemptMove(dragCard, 'ps') } }}>
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {psRoster.length === 0 ? (
                        <tr className="rtr rtr--empty">
                          <td className="rtr-slot"><span className="rtr-slot-label" style={{borderLeftColor:'var(--blue)',color:'var(--text-muted)'}}>PS</span></td>
                          <td className="rtr-player"><div className="rtr-empty-cell"><div className="rtr-empty-avatar"/><span className="rtr-empty-text">No players on practice squad</span></div></td>
                          <td colSpan={extraColSpan}/>
                        </tr>
                      ) : psRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="PS"
                          slotColor="var(--blue)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                          onDrop={setDropTarget}
                          dragCard={dragCard} setDragCard={setDragCard} setDragOverKey={setDragOverKey}/>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* IR */}"""

IR_WRAP_OLD = """                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {irRoster.length === 0 ? (
                        <tr className="rtr rtr--empty">
                          <td className="rtr-slot"><span className="rtr-slot-label" style={{borderLeftColor:'var(--red)',color:'var(--text-muted)'}}>IR</span></td>
                          <td className="rtr-player"><div className="rtr-empty-cell"><div className="rtr-empty-avatar"/><span className="rtr-empty-text">No players on injured reserve</span></div></td>
                          <td colSpan={extraColSpan}/>
                        </tr>
                      ) : irRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="IR"
                          slotColor="var(--red)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                          onDrop={setDropTarget}/>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>"""

IR_WRAP_NEW = """                <div className={`tp-table-wrap ${dragCard ? (getValidTargets(dragCard).has('ir') ? 'tp-dnd-eligible' : 'tp-dnd-ineligible') : ''} ${dragOverKey==='ir' ? 'tp-dnd-hover' : ''}`}
                  onDragOver={e => { if (dragCard) { e.preventDefault(); setDragOverKey('ir') } }}
                  onDrop={e => { if (dragCard) { e.preventDefault(); attemptMove(dragCard, 'ir') } }}>
                  <table className="tp-table">
                    <TableHeader/>
                    <tbody>
                      {irRoster.length === 0 ? (
                        <tr className="rtr rtr--empty">
                          <td className="rtr-slot"><span className="rtr-slot-label" style={{borderLeftColor:'var(--red)',color:'var(--text-muted)'}}>IR</span></td>
                          <td className="rtr-player"><div className="rtr-empty-cell"><div className="rtr-empty-avatar"/><span className="rtr-empty-text">No players on injured reserve</span></div></td>
                          <td colSpan={extraColSpan}/>
                        </tr>
                      ) : irRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="IR"
                          slotColor="var(--red)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                          onDrop={setDropTarget}
                          dragCard={dragCard} setDragCard={setDragCard} setDragOverKey={setDragOverKey}/>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>"""

# ═══════════════════════════════════════════════════════════════════════
# 7. moveMsg toast next to saveMsg
# ═══════════════════════════════════════════════════════════════════════
TOAST_OLD = "          {saveMsg && <span className=\"tp-save-msg\">{saveMsg}</span>}"
TOAST_NEW = """          {saveMsg && <span className="tp-save-msg">{saveMsg}</span>}
          {moveMsg && <span className="tp-save-msg">{moveMsg}</span>}"""


def main():
    apply_patch(TEAM_PAGE, STATE_OLD, STATE_NEW, "new drag state")
    apply_patch(TEAM_PAGE, HANDLEMOVE_OLD, HANDLEMOVE_NEW, "dnd helper functions + attemptMove")
    apply_patch(TEAM_PAGE, EMPTYSLOT_OLD, EMPTYSLOT_NEW, "EmptySlotRow drop zone")
    apply_patch(TEAM_PAGE, PLAYERROW_SIG_OLD, PLAYERROW_SIG_NEW, "PlayerRow drag source/target")
    apply_patch(TEAM_PAGE, PLAYERROW_ACTION_OLD, PLAYERROW_ACTION_NEW, "PlayerRow action cell drag handle")
    apply_patch(TEAM_PAGE, SECTIONS_OLD, SECTIONS_NEW, "Lineup slots render section")
    apply_patch(TEAM_PAGE, BENCH_WRAP_OLD, BENCH_WRAP_NEW, "Bench drop zone")
    apply_patch(TEAM_PAGE, PS_WRAP_OLD, PS_WRAP_NEW, "PS drop zone")
    apply_patch(TEAM_PAGE, IR_WRAP_OLD, IR_WRAP_NEW, "IR drop zone")
    apply_patch(TEAM_PAGE, TOAST_OLD, TOAST_NEW, "moveMsg toast")

    css_text = TEAM_PAGE_CSS.read_text()
    dnd_css = """
/* Drag-and-drop roster moves */
.rtr--draggable { cursor: grab; }
.rtr--draggable:active { cursor: grabbing; }
.rtr--dragging { opacity: 0.4; }
.rtr--dnd-eligible, .tp-dnd-eligible { outline: 2px dashed var(--green); outline-offset: -2px; background: var(--green-dim); }
.rtr--dnd-ineligible, .tp-dnd-ineligible { opacity: 0.35; }
.rtr--dnd-hover, .tp-dnd-hover { outline: 2px solid var(--green); background: var(--green-dim); }
.rtr-drag-handle { display:inline-block; cursor: grab; color: var(--text-muted); font-size: 12px; margin-right: 8px; letter-spacing: -2px; user-select: none; }
"""
    if ".rtr--draggable" in css_text:
        print("SKIPPED — DnD CSS already present in TeamPage.css")
    else:
        TEAM_PAGE_CSS.write_text(css_text.rstrip() + "\n" + dnd_css)
        print("OK — appended DnD CSS to TeamPage.css")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
