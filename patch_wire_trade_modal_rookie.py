#!/usr/bin/env python3
"""
Patch -- Wire embedded trade modal into Rookie Draft
Run from ~/Downloads/sickos-v2
    python3 patch_wire_trade_modal_rookie.py
"""
import sys
from pathlib import Path

ROOKIE_DRAFT = Path.cwd() / "src" / "pages" / "draft" / "RookieDraft.jsx"
DRAFT_HERO = Path.cwd() / "src" / "components" / "draft" / "DraftHero.jsx"

def apply_or_die(text, old, new, label, path_name):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}] in {path_name}, expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)

def main():
    # ---- RookieDraft.jsx ----
    rd_text = ROOKIE_DRAFT.read_text(encoding="utf-8")

    IMPORT_OLD = "import TeamPanel       from '../../components/draft/TeamPanel'"
    IMPORT_NEW = "import TeamPanel       from '../../components/draft/TeamPanel'\nimport DraftTradeModal from '../../components/draft/DraftTradeModal'"
    rd_text = apply_or_die(rd_text, IMPORT_OLD, IMPORT_NEW, "import DraftTradeModal", "RookieDraft.jsx")

    STATE_OLD = "  const [loading,      setLoading]      = useState(true)"
    STATE_NEW = "  const [loading,      setLoading]      = useState(true)\n  const [showTradeModal, setShowTradeModal] = useState(false)"
    rd_text = apply_or_die(rd_text, STATE_OLD, STATE_NEW, "add showTradeModal state", "RookieDraft.jsx")

    HERO_OLD = """        <DraftHero currentPick={currentPick} timeLeft={timeLeft} isMyPick={isMyPick}
          draftState={draftState} getTeamName={getTeamName} getTeamLogo={getTeamLogo}/>
      )}"""
    HERO_NEW = """        <DraftHero currentPick={currentPick} timeLeft={timeLeft} isMyPick={isMyPick}
          draftState={draftState} getTeamName={getTeamName} getTeamLogo={getTeamLogo}
          onOpenTrade={() => setShowTradeModal(true)}/>
      )}
      <DraftTradeModal isOpen={showTradeModal} onClose={() => setShowTradeModal(false)} />"""
    rd_text = apply_or_die(rd_text, HERO_OLD, HERO_NEW, "pass onOpenTrade + render modal", "RookieDraft.jsx")
    ROOKIE_DRAFT.write_text(rd_text, encoding="utf-8")

    # ---- DraftHero.jsx ----
    dh_text = DRAFT_HERO.read_text(encoding="utf-8")

    PROPS_OLD = "export default function DraftHero({ currentPick, timeLeft, isMyPick, draftState, getTeamName, getTeamLogo }) {"
    PROPS_NEW = "export default function DraftHero({ currentPick, timeLeft, isMyPick, draftState, getTeamName, getTeamLogo, onOpenTrade }) {"
    dh_text = apply_or_die(dh_text, PROPS_OLD, PROPS_NEW, "add onOpenTrade prop", "DraftHero.jsx")

    BTN_OLD = """        <button
          className="draft-hero__trade-btn"
          onClick={() => navigate('/trade-machine')}
          title="Trade Machine (coming soon)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          TRADE MACHINE
          <span className="draft-hero__trade-badge">SOON</span>
        </button>"""
    BTN_NEW = """        <button
          className="draft-hero__trade-btn"
          onClick={onOpenTrade}
          title="Trade Machine"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          TRADE MACHINE
        </button>"""
    dh_text = apply_or_die(dh_text, BTN_OLD, BTN_NEW, "open modal instead of navigating, remove SOON badge", "DraftHero.jsx")
    DRAFT_HERO.write_text(dh_text, encoding="utf-8")

    print("\nAll patches applied. Next: npm run build")

if __name__ == "__main__":
    main()
