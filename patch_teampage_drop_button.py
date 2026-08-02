#!/usr/bin/env python3
"""
Patches src/pages/TeamPage.jsx: adds a "Drop" button (visible when
canEdit) to every roster row regardless of slot (active lineup, bench, PS,
IR), opening a confirmation modal that shows real dead-cap impact for all
three release methods (via GET /contracts/:id/release-preview) before
calling POST /contracts/:id/self-release.

Run from the sickos-v2 directory:
    python3 patch_teampage_drop_button.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/TeamPage.jsx")

# ── 1. PlayerRow: accept onDrop, render Drop button next to MoveDropdown ────
OLD_1 = """function PlayerRow({ contract, slotLabel, slotColor, lineupAssign, onMove, slotOverride,
  playerStats, isLineupSlot, activeRoster, psRoster, isLocked, canEdit, opponents, defRankings, transNewsIds, onShowNews }) {"""

NEW_1 = """function PlayerRow({ contract, slotLabel, slotColor, lineupAssign, onMove, slotOverride,
  playerStats, isLineupSlot, activeRoster, psRoster, isLocked, canEdit, opponents, defRankings, transNewsIds, onShowNews, onDrop }) {"""

OLD_2 = """      {canEdit && (
        <td className="rtr-action">
          <MoveDropdown contract={contract} lineupAssign={lineupAssign} onMove={onMove}
            currentSlotOverride={slotOverride} activeRoster={activeRoster}
            psRoster={psRoster} isLocked={isLocked}/>
        </td>
      )}"""

NEW_2 = """      {canEdit && (
        <td className="rtr-action">
          <MoveDropdown contract={contract} lineupAssign={lineupAssign} onMove={onMove}
            currentSlotOverride={slotOverride} activeRoster={activeRoster}
            psRoster={psRoster} isLocked={isLocked}/>
          <button className="rtr-drop-btn" onClick={() => onDrop && onDrop(contract)} title="Drop player">
            Drop
          </button>
        </td>
      )}"""

# ── 2. Thread onDrop through all four PlayerRow call sites ──────────────────
OLD_3 = """                          <PlayerRow key={slot.key} contract={contract}
                            slotLabel={slot.label}
                            slotColor={POS_COLOR[contract.players?.position] || 'var(--orange)'}
                            lineupAssign={lineupAssign} onMove={handleMove}
                            slotOverride={slotOverrides[contract.id||contract.sleeper_id]}
                            playerStats={stats[sid]} isLineupSlot={true}
                            activeRoster={activeRoster} psRoster={psRoster}
                            isLocked={isPlayerLocked(contract)} canEdit={canEdit}
                            opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}/>"""

NEW_3 = """                          <PlayerRow key={slot.key} contract={contract}
                            slotLabel={slot.label}
                            slotColor={POS_COLOR[contract.players?.position] || 'var(--orange)'}
                            lineupAssign={lineupAssign} onMove={handleMove}
                            slotOverride={slotOverrides[contract.id||contract.sleeper_id]}
                            playerStats={stats[sid]} isLineupSlot={true}
                            activeRoster={activeRoster} psRoster={psRoster}
                            isLocked={isPlayerLocked(contract)} canEdit={canEdit}
                            opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                            onDrop={setDropTarget}/>"""

OLD_4 = """                      {benchPlayers.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="Bench"
                          slotColor="var(--text-muted)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}/>
                      ))}"""

NEW_4 = """                      {benchPlayers.map((r,i) => (
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

OLD_5 = """                      ) : psRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="PS"
                          slotColor="var(--blue)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}/>
                      ))}"""

NEW_5 = """                      ) : psRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="PS"
                          slotColor="var(--blue)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                          onDrop={setDropTarget}/>
                      ))}"""

OLD_6 = """                      ) : irRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="IR"
                          slotColor="var(--red)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}"""

NEW_6 = """                      ) : irRoster.map((r,i) => (
                        <PlayerRow key={r.id||i} contract={r} slotLabel="IR"
                          slotColor="var(--red)" lineupAssign={lineupAssign}
                          onMove={handleMove}
                          slotOverride={slotOverrides[r.id||r.sleeper_id]}
                          playerStats={stats[r.players?.sleeper_id||r.sleeper_id]}
                          isLineupSlot={false} activeRoster={activeRoster}
                          psRoster={psRoster} canEdit={canEdit}
                          opponents={opponents} defRankings={defRankings} transNewsIds={transNewsIds} onShowNews={showNews}
                          onDrop={setDropTarget}"""


def apply(text, old, new, label):
    count = text.count(old)
    if count == 0:
        print(f"ERROR: Could not find block for step '{label}'. No changes made.")
        sys.exit(1)
    if count > 1:
        print(f"ERROR: Block for step '{label}' appears {count} times, expected 1. Aborting.")
        sys.exit(1)
    return text.replace(old, new, 1)


def main():
    if not TARGET.exists():
        print(f"ERROR: {TARGET} not found. Run this from the sickos-v2 directory.")
        sys.exit(1)

    text = TARGET.read_text()
    text = apply(text, OLD_1, NEW_1, "PlayerRow accepts onDrop")
    text = apply(text, OLD_2, NEW_2, "add Drop button next to MoveDropdown")
    text = apply(text, OLD_3, NEW_3, "thread onDrop to active lineup PlayerRow")
    text = apply(text, OLD_4, NEW_4, "thread onDrop to Bench PlayerRow")
    text = apply(text, OLD_5, NEW_5, "thread onDrop to PS PlayerRow")
    text = apply(text, OLD_6, NEW_6, "thread onDrop to IR PlayerRow")

    TARGET.write_text(text)
    print("✓ Patched src/pages/TeamPage.jsx — Drop button added to PlayerRow (all 4 slot types), threaded via setDropTarget.")
    print("NOTE: setDropTarget state + DropConfirmModal component still need to be added in a follow-up patch.")


if __name__ == "__main__":
    main()
