#!/usr/bin/env python3
"""
Patch — Fix missing helper definitions from the previous Transactions-tab patch
My earlier patch script's "already present" check was flawed — it checked
for the string PP_TXN_TYPE_META anywhere in the file, but by the time that
check ran, the render block (inserted moments earlier in the same script run)
already REFERENCED that name, so the check false-positived and the actual
helper definitions never got inserted. Same failure class as tonight's
gameInfo crash: a clean build doesn't catch a missing definition in plain JS.

Run from ~/Downloads/sickos-v2
    python3 patch_fix_missing_txn_helpers.py
"""
import sys
from pathlib import Path

PLAYER_PAGE = Path.cwd() / "src" / "pages" / "PlayerPage.jsx"

OLD = "import { TEAMS, LOGOS } from '../data/league'"
NEW = """import { TEAMS, LOGOS } from '../data/league'

const PP_TXN_TYPE_META = {
  signing:     { label: 'Signing',     color: 'var(--green)' },
  release:     { label: 'Release',     color: 'var(--text-muted)' },
  trade:       { label: 'Trade',       color: 'var(--blue)' },
  bid_lost:    { label: 'Failed Bid',  color: 'var(--gold)' },
  draft_batch: { label: 'Draft',       color: 'var(--text-primary)' },
}
function fmtTxnDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}"""


def main():
    text = PLAYER_PAGE.read_text()
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED — expected exactly 1 match, found {count}.")
        sys.exit(1)
    if "const PP_TXN_TYPE_META = {" in text:
        print("FAILED — a real definition already exists; do not double-patch. Investigate manually.")
        sys.exit(1)
    PLAYER_PAGE.write_text(text.replace(OLD, NEW, 1))
    print("OK — inserted PP_TXN_TYPE_META + fmtTxnDate definitions")
    print("Next: grep -n 'const PP_TXN_TYPE_META\\|function fmtTxnDate' src/pages/PlayerPage.jsx")
    print("Then: npm run build")


if __name__ == "__main__":
    main()
