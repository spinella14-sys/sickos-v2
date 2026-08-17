#!/usr/bin/env python3
"""
Patch -- Fix broken mark-as-read loop in InboxPage
Was calling PATCH /messages/:id/read, which doesn't exist on the backend
(confirmed -- only GET /:id marks a message read, as a side effect).
Switches to calling that real endpoint instead, preserving the intended
"clear unread count on mount" behavior with zero backend changes needed.

Run from ~/Downloads/sickos-v2
    python3 patch_fix_inbox_read_endpoint.py
"""
import sys
from pathlib import Path

INBOX = Path.cwd() / "src" / "pages" / "InboxPage.jsx"

OLD = """        const unread = (msgs || []).filter(m => !m.is_read)
        unread.forEach(m => {
          fetch(`${API}/messages/${m.id}/read`, {
            method: 'PATCH',
            headers: { 'x-team-abbrev': myTeam },
          }).catch(() => {})
        })"""

NEW = """        const unread = (msgs || []).filter(m => !m.is_read)
        unread.forEach(m => {
          // GET /:id marks the message read as a side effect (backend
          // confirmed) -- there is no separate PATCH .../read endpoint.
          fetch(`${API}/messages/${m.id}`, {
            headers: { 'x-team-abbrev': myTeam },
          }).catch(() => {})
        })"""

def main():
    text = INBOX.read_text(encoding="utf-8")
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED -- expected exactly 1 match, found {count}. Aborting, nothing written.")
        sys.exit(1)
    text = text.replace(OLD, NEW, 1)
    INBOX.write_text(text, encoding="utf-8")
    print("OK -- fixed mark-as-read loop to use the real endpoint")
    print("Next: npm run build")

if __name__ == "__main__":
    main()
