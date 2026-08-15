#!/usr/bin/env python3
"""
Patch -- Trade Machine: disable submission past the deadline
Page stays fully browsable (build hypothetical trades, view rosters/cap),
but the actual submit button gets disabled with a clear message once the
deadline has passed, per GET /api/trades/deadline-status.

Run from ~/Downloads/sickos-v2
    python3 patch_trade_machine_deadline_ui.py
"""
import sys
from pathlib import Path

TRADE_MACHINE = Path.cwd() / "src" / "pages" / "TradeMachinePage.jsx"

def apply_or_die(text, old, new, label):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}], expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)

def main():
    text = TRADE_MACHINE.read_text(encoding="utf-8")

    OLD_STATE = """  const [threeWay,   setThreeWay]   = useState(counterThreeWay)"""
    NEW_STATE = """  const [pastDeadline, setPastDeadline] = useState(false)
  useEffect(() => {
    fetch(`${API}/trades/deadline-status`)
      .then(r => r.ok ? r.json() : { isPastDeadline: false })
      .then(d => setPastDeadline(!!d.isPastDeadline))
      .catch(() => {})
  }, [])

  const [threeWay,   setThreeWay]   = useState(counterThreeWay)"""
    text = apply_or_die(text, OLD_STATE, NEW_STATE, "add deadline-status fetch")

    OLD_BUTTON = """              {result && (
                <div className={`tm-result ${result.ok?'tm-result--ok':'tm-result--err'}`}>{result.msg}</div>
              )}
            </div>
            <button className="tm-submit" onClick={() => setShowConfirm(true)}
              disabled={!canSubmit || !hasAnyAssets}>
              {!hasAnyAssets ? 'Add players or picks to trade' : 'Propose Trade \u2192'}
            </button>"""
    NEW_BUTTON = """              {result && (
                <div className={`tm-result ${result.ok?'tm-result--ok':'tm-result--err'}`}>{result.msg}</div>
              )}
              {pastDeadline && (
                <div className="tm-warn-msg">\u23f0 The trade deadline has passed \u2014 no new trades can be submitted for the rest of the season. You can still build and review trades here.</div>
              )}
            </div>
            <button className="tm-submit" onClick={() => setShowConfirm(true)}
              disabled={!canSubmit || !hasAnyAssets || pastDeadline}>
              {pastDeadline ? 'Trade Deadline Has Passed' : !hasAnyAssets ? 'Add players or picks to trade' : 'Propose Trade \u2192'}
            </button>"""
    text = apply_or_die(text, OLD_BUTTON, NEW_BUTTON, "disable submit button + warning message")

    TRADE_MACHINE.write_text(text, encoding="utf-8")
    print("\nAll patches applied. Next: npm run build")

if __name__ == "__main__":
    main()
