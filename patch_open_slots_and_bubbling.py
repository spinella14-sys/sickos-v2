#!/usr/bin/env python3
"""
Patch 8 (frontend) — Open PS slots, no double-fire, flexible bench framing
1. New EmptyZoneRow component — renders open PS capacity as real drop
   targets (no swap forced) instead of every visible row being an occupant.
2. e.stopPropagation() on row-level drag handlers so a row's swap logic and
   the zone wrapper's general-add logic never both fire from one drop.
3. Bench section: drop the fixed BENCH_SLOTS=5 filler rows and header count
   — bench is not fixed-size, it shares the 13-man active roster with starters.

Run from ~/Downloads/sickos-v2
    python3 patch_open_slots_and_bubbling.py
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
# 1. EmptySlotRow — add stopPropagation, and define EmptyZoneRow after it
# ═══════════════════════════════════════════════════════════════════════
EMPTYSLOT_OLD = """  const dropProps = dragCard ? {
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

EMPTYSLOT_NEW = """  const dropProps = dragCard ? {
    onDragOver: e => { e.preventDefault(); e.stopPropagation(); setDragOverKey(dropKey) },
    onDrop:     e => { e.preventDefault(); e.stopPropagation(); onAttemptMove(dragCard, dropKey) },
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
}

function EmptyZoneRow({ zoneKey, label, colorVar, canEdit, dragCard, dragOverKey, setDragOverKey, onAttemptMove, isEligible }) {
  const isHover = dragOverKey === zoneKey
  const dropProps = dragCard ? {
    onDragOver: e => { e.preventDefault(); e.stopPropagation(); setDragOverKey(zoneKey) },
    onDrop:     e => { e.preventDefault(); e.stopPropagation(); onAttemptMove(dragCard, zoneKey) },
  } : {}
  const extraCols = canEdit ? 10 : 9
  return (
    <tr {...dropProps} className={`rtr rtr--empty ${dragCard ? (isEligible ? 'rtr--dnd-eligible' : 'rtr--dnd-ineligible') : ''} ${isHover ? 'rtr--dnd-hover' : ''}`}>
      <td className="rtr-slot">
        <span className="rtr-slot-label" style={{ borderLeftColor: colorVar || 'var(--border)', color:'var(--text-muted)' }}>
          {label}
        </span>
      </td>
      <td className="rtr-player">
        <div className="rtr-empty-cell">
          <div className="rtr-empty-avatar"/>
          <span className="rtr-empty-text">Drop a player here</span>
        </div>
      </td>
      <td colSpan={extraCols}/>
    </tr>
  )
}"""

# ═══════════════════════════════════════════════════════════════════════
# 2. PlayerRow — stopPropagation on row-level drop handlers
# ═══════════════════════════════════════════════════════════════════════
ROWPROPS_OLD = """  if (isDropZone) {
    rowProps.onDragOver = e => { e.preventDefault(); setDragOverKey(dropKey) }
    rowProps.onDrop     = e => { e.preventDefault(); if (dragCard) onAttemptMove(dragCard, dropKey, contract) }
  }"""
ROWPROPS_NEW = """  if (isDropZone) {
    rowProps.onDragOver = e => { e.preventDefault(); e.stopPropagation(); setDragOverKey(dropKey) }
    rowProps.onDrop     = e => { e.preventDefault(); e.stopPropagation(); if (dragCard) onAttemptMove(dragCard, dropKey, contract) }
  }"""

# ═══════════════════════════════════════════════════════════════════════
# 3. PS section — real open-slot rows instead of forcing every drop onto
#    an occupant. Drop the zero-state special case entirely (empty rows
#    now convey "nobody here" the same way Lineup's EmptySlotRow does).
# ═══════════════════════════════════════════════════════════════════════
PS_SECTION_OLD = """                      {psRoster.length === 0 ? (
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
                          dragCard={dragCard} setDragCard={setDragCard} setDragOverKey={setDragOverKey}
                          dropKey="ps" dragOverKey={dragOverKey} onAttemptMove={attemptMove}
                          isEligible={!!dragCard && (dragCard.id||dragCard.sleeper_id) !== (r.id||r.sleeper_id)}/>
                      ))}
                    </tbody>"""

PS_SECTION_NEW = """                      {psRoster.map((r,i) => (
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
                      ))}
                      {Array.from({length: Math.max(0, 4 - psRoster.length)}).map((_,i) => (
                        <EmptyZoneRow key={`eps${i}`} zoneKey="ps" label="Open PS slot" colorVar="var(--blue)" canEdit={canEdit}
                          dragCard={dragCard} dragOverKey={dragOverKey} setDragOverKey={setDragOverKey}
                          onAttemptMove={attemptMove}
                          isEligible={!!dragCard && getValidTargets(dragCard).has('ps')}/>
                      ))}
                    </tbody>"""

# ═══════════════════════════════════════════════════════════════════════
# 4. Bench — drop fixed 5-slot framing, it shares the 13-man active roster
# ═══════════════════════════════════════════════════════════════════════
BENCH_HDR_OLD = """                <div className="tp-section-hdr tp-section-bench">
                  <span>BENCH ({benchPlayers.length}/{BENCH_SLOTS})</span>
                  <span className="tp-section-note">Active roster · Full cap hit · No scoring</span>
                </div>"""
BENCH_HDR_NEW = """                <div className="tp-section-hdr tp-section-bench">
                  <span>BENCH ({benchPlayers.length})</span>
                  <span className="tp-section-note">Active roster · Full cap hit · No scoring · shares the 13-man active roster with your starters</span>
                </div>"""

BENCH_FILLER_OLD = """                      {Array.from({length:Math.max(0,BENCH_SLOTS-benchPlayers.length)}).map((_,i) => (
                        <tr key={`eb${i}`} className="rtr rtr--empty">
                          <td className="rtr-slot"><span className="rtr-slot-label" style={{borderLeftColor:'var(--border)',color:'var(--text-muted)'}}>Bench</span></td>
                          <td className="rtr-player"><div className="rtr-empty-cell"><div className="rtr-empty-avatar"/><span className="rtr-empty-text">Empty bench slot</span></div></td>
                          <td colSpan={extraColSpan}/>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Practice Squad */}"""
BENCH_FILLER_NEW = """                    </tbody>
                  </table>
                </div>

                {/* Practice Squad */}"""


def main():
    apply_patch(TEAM_PAGE, EMPTYSLOT_OLD, EMPTYSLOT_NEW, "EmptySlotRow stopPropagation + new EmptyZoneRow component")
    apply_patch(TEAM_PAGE, ROWPROPS_OLD, ROWPROPS_NEW, "PlayerRow stopPropagation")
    apply_patch(TEAM_PAGE, PS_SECTION_OLD, PS_SECTION_NEW, "PS open-slot rows")
    apply_patch(TEAM_PAGE, BENCH_HDR_OLD, BENCH_HDR_NEW, "Bench header: flexible framing")
    apply_patch(TEAM_PAGE, BENCH_FILLER_OLD, BENCH_FILLER_NEW, "remove fixed bench filler rows")
    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
