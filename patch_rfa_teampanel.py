#!/usr/bin/env python3
"""
Patch -- Add TeamPanel to RFA draft (right column: cap, roster, SB budget)
RFA already has getTeamName/getTeamLogo at module level -- just needs
viewingTeam state and the layout restructured to a two-column flex.

Run from ~/Downloads/sickos-v2
    python3 patch_rfa_teampanel.py
"""
import sys
from pathlib import Path

RFA_DRAFT = Path.cwd() / "src" / "pages" / "draft" / "RFADraft.jsx"

def apply_or_die(text, old, new, label):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}], expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)

def main():
    text = RFA_DRAFT.read_text(encoding="utf-8")

    IMPORT_OLD = "import DraftTradeModal from '../../components/draft/DraftTradeModal'"
    IMPORT_NEW = "import DraftTradeModal from '../../components/draft/DraftTradeModal'\nimport TeamPanel from '../../components/draft/TeamPanel'"
    text = apply_or_die(text, IMPORT_OLD, IMPORT_NEW, "import TeamPanel")

    STATE_OLD = "  const [showTradeModal, setShowTradeModal] = useState(false)"
    STATE_NEW = "  const [showTradeModal, setShowTradeModal] = useState(false)\n  const [viewingTeam, setViewingTeam] = useState(currentTeam)"
    text = apply_or_die(text, STATE_OLD, STATE_NEW, "add viewingTeam state")

    print("\nProps/state patches applied. Next: layout restructure needs manual anchor check")
    RFA_DRAFT.write_text(text, encoding="utf-8")

if __name__ == "__main__":
    main()
