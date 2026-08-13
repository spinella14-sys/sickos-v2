#!/usr/bin/env python3
"""
Patch -- Show injury detail (body part) on the injury badge
Sleeper's free API already includes real injury_body_part detail for real
injured players -- previously synced but never displayed.

Run from ~/Downloads/sickos-v2
    python3 patch_injury_badge_detail.py
"""
import sys
from pathlib import Path

PLAYER_PAGE = Path.cwd() / "src" / "pages" / "PlayerPage.jsx"

OLD = '                    <span className="pp-badge pp-badge--injury">\U0001f3e5 {player.injury_status}</span>'
NEW = '                    <span className="pp-badge pp-badge--injury">\U0001f3e5 {player.injury_status}{player.injury_body_part ? ` \u2014 ${player.injury_body_part}` : \'\'}</span>'

def main():
    text = PLAYER_PAGE.read_text(encoding="utf-8")
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED -- expected exactly 1 match, found {count}. Aborting, nothing written.")
        sys.exit(1)
    text = text.replace(OLD, NEW, 1)
    PLAYER_PAGE.write_text(text, encoding="utf-8")
    print("OK -- injury badge now shows body part when available")
    print("Next: npm run build")

if __name__ == "__main__":
    main()
