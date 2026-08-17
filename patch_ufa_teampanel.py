#!/usr/bin/env python3
"""
Patch -- Add TeamPanel to UFA draft (right column: cap, roster, SB budget)
UFA is missing TEAMS/LOGOS import and getTeamName/getTeamLogo helpers
entirely (unlike RFA/Rookie) -- adds all of it plus viewingTeam state and
wires TeamPanel into the layout as a third flex sibling.

Run from ~/Downloads/sickos-v2
    python3 patch_ufa_teampanel.py
"""
import sys
from pathlib import Path

UFA_DRAFT = Path.cwd() / "src" / "pages" / "draft" / "UFADraft.jsx"

def apply_or_die(text, old, new, label):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}], expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)

def main():
    text = UFA_DRAFT.read_text(encoding="utf-8")

    IMPORT_OLD = """import DraftTradeModal from '../../components/draft/DraftTradeModal'
import './RFADraft.css'"""
    IMPORT_NEW = """import DraftTradeModal from '../../components/draft/DraftTradeModal'
import TeamPanel from '../../components/draft/TeamPanel'
import { TEAMS, LOGOS } from '../../data/league'
import './RFADraft.css'"""
    text = apply_or_die(text, IMPORT_OLD, IMPORT_NEW, "add TeamPanel + TEAMS/LOGOS imports")

    CONST_OLD = "const API    = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'"
    CONST_NEW = """const API    = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const getTeamName = (abbrev) => TEAMS.find(t => t.abbrev === abbrev)?.name || abbrev
const getTeamLogo = (abbrev) => LOGOS[abbrev] || null"""
    text = apply_or_die(text, CONST_OLD, CONST_NEW, "add getTeamName/getTeamLogo helpers")

    STATE_OLD = "  const [showTradeModal, setShowTradeModal] = useState(false)"
    STATE_NEW = "  const [showTradeModal, setShowTradeModal] = useState(false)\n  const [viewingTeam, setViewingTeam] = useState(currentTeam)"
    text = apply_or_die(text, STATE_OLD, STATE_NEW, "add viewingTeam state")

    LAYOUT_OLD = """          myBids={myBids}
          myCapData={myCapData}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          onBidSubmit={handleBidSubmit}
          bidsRemaining={bidsRemaining}
        />
      </div>
    </div>
  )
}"""
    LAYOUT_NEW = """          myBids={myBids}
          myCapData={myCapData}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          onBidSubmit={handleBidSubmit}
          bidsRemaining={bidsRemaining}
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
      </div>
    </div>
  )
}"""
    text = apply_or_die(text, LAYOUT_OLD, LAYOUT_NEW, "add TeamPanel as third layout sibling")

    UFA_DRAFT.write_text(text, encoding="utf-8")
    print("\nAll patches applied. Next: npm run build")

if __name__ == "__main__":
    main()
