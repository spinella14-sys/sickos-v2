#!/usr/bin/env python3
"""
Patch 6 (frontend) — Exact-target swaps + PS capacity gate + failed-save preservation
1. PlayerRow's onDrop now passes the target row's own contract along, so
   attemptMove can swap with the EXACT player targeted (lineup slots) or
   perform a true 1-for-1 staged swap (PS).
2. getValidTargets now gates 'ps' by real+staged capacity (max 4) — blocks
   the general-zone drop once full, matching the backend rule, instead of
   silently over-staging.
3. Dropping onto a SPECIFIC PS player's row still allows a direct swap
   regardless of capacity, since headcount doesn't change (fixes "wasn't a
   pure swap").
4. saveChanges no longer clears ALL slotOverrides on save — only the ones
   that actually succeeded. Failed ones stay staged and the real backend
   error message is shown.

Run from ~/Downloads/sickos-v2
    python3 patch_swap_and_save_fixes.py
"""
import sys
from pathlib import Path

ROOT = Path.cwd()
TEAM_PAGE = ROOT / "src" / "pages" / "TeamPage.jsx"


def apply_patch(path, old, new, label):
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
# 1. getValidTargets — gate 'ps' by real+staged capacity
# ═══════════════════════════════════════════════════════════════════════
GVT_OLD = """      targets.add('bench')
      const psQBs = (psRoster || []).filter(r => r.players?.position === 'QB').length
      if (!(pos === 'QB' && psQBs >= 1)) targets.add('ps')
      if (['Out','IR','PUP'].includes(contract.players?.injury_status)) targets.add('ir')"""
GVT_NEW = """      targets.add('bench')
      const psQBs = (psRoster || []).filter(r => r.players?.position === 'QB').length
      const stagedPSCount = Object.values(slotOverrides).filter(v => v === 'ps').length
      const psAtCapacity = ((psRoster || []).length + stagedPSCount) >= 4
      if (!(pos === 'QB' && psQBs >= 1) && !psAtCapacity) targets.add('ps')
      if (['Out','IR','PUP'].includes(contract.players?.injury_status)) targets.add('ir')"""

# ═══════════════════════════════════════════════════════════════════════
# 2. New helpers (isValidSwapTarget, stagedSwap) + rewritten attemptMove
# ═══════════════════════════════════════════════════════════════════════
ATTEMPT_OLD = """  // ── Drag & drop: attempt a move. Pure lineup<->bench shuffles (no cap
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
  }"""

ATTEMPT_NEW = """  // ── Drag & drop: validity + staging for a direct swap onto a specific
  // occupied PS/IR row. A direct swap never changes headcount, so it's
  // allowed regardless of capacity — only position/QB-limit rules matter.
  function isValidSwapTarget(dragged, targetContract, targetKey) {
    const pos = dragged.players?.position
    if (targetKey === 'ir') {
      return ['Out','IR','PUP'].includes(dragged.players?.injury_status)
    }
    if (targetKey === 'ps') {
      if (pos !== 'QB') return true
      const otherPSQBs = (psRoster || []).filter(r =>
        r.players?.position === 'QB' && (r.id||r.sleeper_id) !== (targetContract.id||targetContract.sleeper_id)
      )
      return otherPSQBs.length === 0
    }
    return false
  }

  // ── Stage a direct 1-for-1 swap: dragged player takes the target's PS/IR
  // slot, target occupant goes back to the active roster (bench), pending Save.
  function stagedSwap(draggedContract, targetContract, newSlotForDragged) {
    const draggedId = draggedContract.id || draggedContract.sleeper_id
    const targetId   = targetContract.id  || targetContract.sleeper_id
    setLineupAssign(prev => {
      const next = {...prev}
      Object.entries(next).forEach(([k,v]) => { if (v === draggedId) delete next[k] })
      return next
    })
    setSlotOverrides(prev => ({
      ...prev,
      [draggedId]: newSlotForDragged,
      [targetId]:  'active',
    }))
  }

  // ── Drag & drop: attempt a move. Pure lineup<->bench shuffles (no cap
  // implications) save INSTANTLY, swapping with the EXACT slot targeted.
  // Dropping onto a specific occupied PS/IR row performs a direct staged
  // swap. Everything else touching PS/IR stays on the existing staged flow
  // (Save Lineup button) since that's where cap/QB-limit validation lives.
  async function attemptMove(contract, targetKey, targetContract) {
    const cid = contract.id || contract.sleeper_id
    const sourceLoc      = getSourceLoc(contract)
    const sourceIsActive = sourceLoc === 'bench' || sourceLoc.startsWith('lineup:')
    const targetIsActive = targetKey === 'bench' || targetKey.startsWith('lineup:')
    const isDirectSwap   = !!targetContract && (targetKey === 'ps' || targetKey === 'ir') &&
                            (targetContract.id||targetContract.sleeper_id) !== cid

    if (isDirectSwap) {
      if (!isValidSwapTarget(contract, targetContract, targetKey)) {
        setMoveMsg('Invalid move ✗')
        setTimeout(() => setMoveMsg(''), 2000)
        return
      }
      stagedSwap(contract, targetContract, targetKey)
      return
    }

    if (!getValidTargets(contract).has(targetKey)) {
      setMoveMsg('Invalid move ✗')
      setTimeout(() => setMoveMsg(''), 2000)
      return
    }

    if (sourceIsActive && targetIsActive) {
      const sleeperId = contract.players?.sleeper_id || contract.sleeper_id
      if (!sleeperId) return
      const newSlotType = targetKey === 'bench' ? 'BN' : keyToSlotType(targetKey.split(':')[1])
      const swapSid = targetContract ? (targetContract.players?.sleeper_id || targetContract.sleeper_id) : null
      const headers = {
        'Content-Type':     'application/json',
        'x-team-abbrev':    manager?.team_abbrev || '',
        'x-admin-password': isAdmin ? (localStorage.getItem('adminPw') || '') : '',
      }
      try {
        const r = await fetch(`${API_BASE}/lineup/${abbrev.toUpperCase()}/move`, {
          method:'PATCH', headers,
          body: JSON.stringify({ sleeper_id: sleeperId, new_slot: newSlotType, season: CURRENT_SEASON, week: currentWeek, swap_with_sleeper_id: swapSid }),
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
  }"""

# ═══════════════════════════════════════════════════════════════════════
# 3. PlayerRow onDrop — pass the target row's own contract for exact swaps
# ═══════════════════════════════════════════════════════════════════════
DROP_OLD = "    rowProps.onDrop     = e => { e.preventDefault(); if (dragCard) onAttemptMove(dragCard, dropKey) }"
DROP_NEW = "    rowProps.onDrop     = e => { e.preventDefault(); if (dragCard) onAttemptMove(dragCard, dropKey, contract) }"

# ═══════════════════════════════════════════════════════════════════════
# 4. PS render section — wire row-level drop target for direct swaps
# ═══════════════════════════════════════════════════════════════════════
PS_ROWS_OLD = """                      ) : psRoster.map((r,i) => (
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
                      ))}"""
PS_ROWS_NEW = """                      ) : psRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="PS"
                          slotColor="var(--blue)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                          onDrop={setDropTarget}
                          dragCard={dragCard} setDragCard={setDragCard} setDragOverKey={setDragOverKey}
                          dropKey="ps" dragOverKey={dragOverKey} onAttemptMove={attemptMove}
                          isEligible={!!dragCard && (dragCard.id||dragCard.sleeper_id) !== (r.id||r.sleeper_id)}/>
                      ))}"""

# ═══════════════════════════════════════════════════════════════════════
# 5. saveChanges — preserve failed staged moves instead of clearing all
# ═══════════════════════════════════════════════════════════════════════
SAVE_OLD = """    // 3. Save PS/IR slot changes
    for (const [contractId, newSlot] of Object.entries(slotOverrides)) {
      const contract  = roster.find(r => (r.id||r.sleeper_id) === contractId)
      const sleeperId = contract?.players?.sleeper_id || contract?.sleeper_id
      if (!sleeperId) { fail++; continue }
      try {
        const r = await fetch(`${API_BASE}/teams/${abbrev.toUpperCase()}/slot-move`, {
          method:'PATCH', headers,
          body: JSON.stringify({ sleeper_id: sleeperId, new_slot: newSlot }),
        })
        if (r.ok) { const updated = await r.json(); setTeamData(prev => ({...prev, ...updated})); ok++ }
        else fail++
      } catch { fail++ }
    }

    setSaving(false)
    setSlotOverrides({})
    setSaveMsg(fail ? `${ok} saved, ${fail} failed ✗` : `${ok} change${ok!==1?'s':''} saved ✓`)
    setTimeout(() => setSaveMsg(''), 3000)
    loadTeam()
  }"""
SAVE_NEW = """    // 3. Save PS/IR slot changes — keep failed ones staged instead of
    // silently clearing them, and surface the real backend error.
    const remainingOverrides = {}
    let firstError = ''
    for (const [contractId, newSlot] of Object.entries(slotOverrides)) {
      const contract  = roster.find(r => (r.id||r.sleeper_id) === contractId)
      const sleeperId = contract?.players?.sleeper_id || contract?.sleeper_id
      if (!sleeperId) { fail++; remainingOverrides[contractId] = newSlot; continue }
      try {
        const r = await fetch(`${API_BASE}/teams/${abbrev.toUpperCase()}/slot-move`, {
          method:'PATCH', headers,
          body: JSON.stringify({ sleeper_id: sleeperId, new_slot: newSlot }),
        })
        if (r.ok) { const updated = await r.json(); setTeamData(prev => ({...prev, ...updated})); ok++ }
        else {
          fail++
          remainingOverrides[contractId] = newSlot
          const body = await r.json().catch(() => ({}))
          if (body.error && !firstError) firstError = body.error
        }
      } catch { fail++; remainingOverrides[contractId] = newSlot }
    }

    setSaving(false)
    setSlotOverrides(remainingOverrides)
    setSaveMsg(fail ? `${ok} saved, ${fail} failed ✗${firstError ? ' — ' + firstError : ''}` : `${ok} change${ok!==1?'s':''} saved ✓`)
    setTimeout(() => setSaveMsg(''), 4000)
    loadTeam()
  }"""


def main():
    apply_patch(TEAM_PAGE, GVT_OLD, GVT_NEW, "PS capacity gate in getValidTargets")
    apply_patch(TEAM_PAGE, ATTEMPT_OLD, ATTEMPT_NEW, "exact-swap helpers + rewritten attemptMove")
    apply_patch(TEAM_PAGE, DROP_OLD, DROP_NEW, "PlayerRow onDrop passes target contract")
    apply_patch(TEAM_PAGE, PS_ROWS_OLD, PS_ROWS_NEW, "PS rows: row-level drop target for direct swap")
    apply_patch(TEAM_PAGE, SAVE_OLD, SAVE_NEW, "preserve failed staged moves on save")
    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
