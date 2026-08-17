#!/usr/bin/env python3
"""
Patch -- Wire embedded trade modal into UFA draft
Run from ~/Downloads/sickos-v2
    python3 patch_wire_trade_modal_ufa.py
"""
import sys
from pathlib import Path

UFA_DRAFT = Path.cwd() / "src" / "pages" / "draft" / "UFADraft.jsx"
UFA_HERO = Path.cwd() / "src" / "components" / "ufa" / "UFAHero.jsx"

def apply_or_die(text, old, new, label, path_name):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}] in {path_name}, expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)

def main():
    # ---- UFADraft.jsx ----
    ud_text = UFA_DRAFT.read_text(encoding="utf-8")

    IMPORT_OLD = "import UFAMyBids      from '../../components/ufa/UFAMyBids'"
    IMPORT_NEW = "import UFAMyBids      from '../../components/ufa/UFAMyBids'\nimport DraftTradeModal from '../../components/draft/DraftTradeModal'"
    ud_text = apply_or_die(ud_text, IMPORT_OLD, IMPORT_NEW, "import DraftTradeModal", "UFADraft.jsx")

    STATE_OLD = "  const [loading,        setLoading]        = useState(true)"
    STATE_NEW = "  const [loading,        setLoading]        = useState(true)\n  const [showTradeModal, setShowTradeModal] = useState(false)"
    ud_text = apply_or_die(ud_text, STATE_OLD, STATE_NEW, "add showTradeModal state", "UFADraft.jsx")

    HERO_OLD = """      <UFAHero
        ufaState={ufaState}
        timeLeft={timeLeft}
        currentTeam={currentTeam}
        bidsThisWave={bidsThisWave}
      />
"""
    HERO_NEW = """      <UFAHero
        ufaState={ufaState}
        timeLeft={timeLeft}
        currentTeam={currentTeam}
        bidsThisWave={bidsThisWave}
        onOpenTrade={() => setShowTradeModal(true)}
      />
      <DraftTradeModal isOpen={showTradeModal} onClose={() => setShowTradeModal(false)} />
"""
    ud_text = apply_or_die(ud_text, HERO_OLD, HERO_NEW, "pass onOpenTrade + render modal", "UFADraft.jsx")
    UFA_DRAFT.write_text(ud_text, encoding="utf-8")

    # ---- UFAHero.jsx ----
    uh_text = UFA_HERO.read_text(encoding="utf-8")

    PROPS_OLD = "export default function UFAHero({ ufaState, timeLeft, currentTeam, bidsThisWave }) {"
    PROPS_NEW = "export default function UFAHero({ ufaState, timeLeft, currentTeam, bidsThisWave, onOpenTrade }) {"
    uh_text = apply_or_die(uh_text, PROPS_OLD, PROPS_NEW, "add onOpenTrade prop", "UFAHero.jsx")

    BTN_OLD = """        <button
          className="rfa-hero__trade-btn"
          onClick={() => navigate('/trade')}
        >"""
    BTN_NEW = """        <button
          className="rfa-hero__trade-btn"
          onClick={onOpenTrade}
        >"""
    uh_text = apply_or_die(uh_text, BTN_OLD, BTN_NEW, "open modal instead of navigating", "UFAHero.jsx")
    UFA_HERO.write_text(uh_text, encoding="utf-8")

    print("\nAll patches applied. Next: npm run build")

if __name__ == "__main__":
    main()
