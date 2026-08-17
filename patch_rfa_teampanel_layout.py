#!/usr/bin/env python3
"""
Patch -- Add TeamPanel to RFA draft layout (right column)
Run from ~/Downloads/sickos-v2
    python3 patch_rfa_teampanel_layout.py
"""
import sys
from pathlib import Path

RFA_DRAFT = Path.cwd() / "src" / "pages" / "draft" / "RFADraft.jsx"

OLD = """        <RFAPool
          pool={pool}
          wave={wave}
          isWaveOpen={isOpen}
          isPreRfa={isPreRfa}
          currentTeam={currentTeam}
          myBids={myBids}
          myTeamData={myTeamData}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
          onBidSubmit={handleBidSubmit}
        />
      </div>"""

NEW = """        <RFAPool
          pool={pool}
          wave={wave}
          isWaveOpen={isOpen}
          isPreRfa={isPreRfa}
          currentTeam={currentTeam}
          myBids={myBids}
          myTeamData={myTeamData}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
          onBidSubmit={handleBidSubmit}
        />

        <TeamPanel
          viewingTeam={viewingTeam || currentTeam}
          setViewingTeam={setViewingTeam}
          teams={TEAMS}
          currentTeam={currentTeam}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
          showDraftPicks={false}
        />
      </div>"""

def apply_or_die(text, old, new, label):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}], expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)

def main():
    text = RFA_DRAFT.read_text(encoding="utf-8")
    text = apply_or_die(text, OLD, NEW, "add TeamPanel as third layout sibling")
    RFA_DRAFT.write_text(text, encoding="utf-8")
    print("\nApplied. Next: npm run build")

if __name__ == "__main__":
    main()
