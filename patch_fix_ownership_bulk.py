#!/usr/bin/env python3
"""
Patch -- Fix ownership-bulk 404: frontend called with POST + body, but the
backend only registers GET and ignores any body/position filter entirely
(confirmed by reading the route). This call has never actually worked.
Switches to a plain GET, dropping the meaningless body.

Run from ~/Downloads/sickos-v2
    python3 patch_fix_ownership_bulk.py
"""
import sys
from pathlib import Path

ROOKIE_DRAFT = Path.cwd() / "src" / "pages" / "draft" / "RookieDraft.jsx"

OLD = """    fetch(`${API}/stats/ownership-bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: ['QB','RB','WR','TE'] }),
    })
      .then(r => r.ok ? r.json() : {})
      .then(d => { if (d && typeof d === 'object') setOwnership(d) })
      .catch(() => {})"""

NEW = """    // GET, no body -- the backend endpoint (confirmed) ignores any
    // request body/position filter entirely and always returns the full
    // ownership map for every player. The prior POST call always 404'd.
    fetch(`${API}/stats/ownership-bulk`)
      .then(r => r.ok ? r.json() : {})
      .then(d => { if (d && typeof d === 'object') setOwnership(d) })
      .catch(() => {})"""

def main():
    text = ROOKIE_DRAFT.read_text(encoding="utf-8")
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED -- expected exactly 1 match, found {count}. Aborting, nothing written.")
        sys.exit(1)
    text = text.replace(OLD, NEW, 1)
    ROOKIE_DRAFT.write_text(text, encoding="utf-8")
    print("OK -- fixed ownership-bulk call to use real GET method")
    print("Next: npm run build")

if __name__ == "__main__":
    main()
