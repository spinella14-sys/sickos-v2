#!/usr/bin/env python3
"""
Patch -- Wire embedded trade modal into RFA draft
Run from ~/Downloads/sickos-v2
    python3 patch_wire_trade_modal_rfa.py
"""
import sys
from pathlib import Path

RFA_DRAFT = Path.cwd() / "src" / "pages" / "draft" / "RFADraft.jsx"
RFA_HERO = Path.cwd() / "src" / "components" / "rfa" / "RFAHero.jsx"

def apply_or_die(text, old, new, label, path_name):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}] in {path_name}, expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)

def main():
    # ---- RFADraft.jsx ----
    rd_text = RFA_DRAFT.read_text(encoding="utf-8")

    IMPORT_OLD = "import RFAWaveSummaryModal from '../../components/rfa/RFAWaveSummaryModal'"
    IMPORT_NEW = "import RFAWaveSummaryModal from '../../components/rfa/RFAWaveSummaryModal'\nimport DraftTradeModal from '../../components/draft/DraftTradeModal'"
    rd_text = apply_or_die(rd_text, IMPORT_OLD, IMPORT_NEW, "import DraftTradeModal", "RFADraft.jsx")

    STATE_OLD = "  const [loading,        setLoading]       = useState(true)"
    STATE_NEW = "  const [loading,        setLoading]       = useState(true)\n  const [showTradeModal, setShowTradeModal] = useState(false)"
    rd_text = apply_or_die(rd_text, STATE_OLD, STATE_NEW, "add showTradeModal state", "RFADraft.jsx")

    HERO_OLD = """      <RFAHero
        rfaState={rfaState}
        timeLeft={timeLeft}
        matchWindows={matchWindows}
        currentTeam={currentTeam}
        getTeamName={getTeamName}
        getTeamLogo={getTeamLogo}
        isCommissioner={isCommissioner}
        onRefresh={load}
      />
"""
    HERO_NEW = """      <RFAHero
        rfaState={rfaState}
        timeLeft={timeLeft}
        matchWindows={matchWindows}
        currentTeam={currentTeam}
        getTeamName={getTeamName}
        getTeamLogo={getTeamLogo}
        isCommissioner={isCommissioner}
        onRefresh={load}
        onOpenTrade={() => setShowTradeModal(true)}
      />
      <DraftTradeModal isOpen={showTradeModal} onClose={() => setShowTradeModal(false)} />
"""
    rd_text = apply_or_die(rd_text, HERO_OLD, HERO_NEW, "pass onOpenTrade + render modal", "RFADraft.jsx")
    RFA_DRAFT.write_text(rd_text, encoding="utf-8")

    # ---- RFAHero.jsx ----
    rh_text = RFA_HERO.read_text(encoding="utf-8")

    PROPS_OLD = """export default function RFAHero({
  rfaState, timeLeft, matchWindows, currentTeam,
  getTeamName, getTeamLogo, isCommissioner, onRefresh,
}) {"""
    PROPS_NEW = """export default function RFAHero({
  rfaState, timeLeft, matchWindows, currentTeam,
  getTeamName, getTeamLogo, isCommissioner, onRefresh, onOpenTrade,
}) {"""
    rh_text = apply_or_die(rh_text, PROPS_OLD, PROPS_NEW, "add onOpenTrade prop", "RFAHero.jsx")

    BTN_OLD = """        <button
          className="rfa-hero__trade-btn"
          onClick={() => navigate('/trade')}
        >"""
    BTN_NEW = """        <button
          className="rfa-hero__trade-btn"
          onClick={onOpenTrade}
        >"""
    rh_text = apply_or_die(rh_text, BTN_OLD, BTN_NEW, "open modal instead of navigating", "RFAHero.jsx")
    RFA_HERO.write_text(rh_text, encoding="utf-8")

    print("\nAll patches applied. Next: npm run build")

if __name__ == "__main__":
    main()
