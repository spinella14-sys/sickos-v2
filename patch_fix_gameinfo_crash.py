#!/usr/bin/env python3
"""
Patch — Fix MatchupPage crash: "gameInfo is not defined"
PlayerStatus's body references `gameInfo` (passed in as a prop from
PlayerCell) but the function signature never destructured it. Leftover from
Stage 1's opponent/kickoff feature, which was built but never live-tested.

Run from ~/Downloads/sickos-v2
    python3 patch_fix_gameinfo_crash.py
"""
import sys
from pathlib import Path

MATCHUP_PAGE = Path.cwd() / "src" / "pages" / "MatchupPage.jsx"

OLD = "function PlayerStatus({ player, projPts, isFinal }) {"
NEW = "function PlayerStatus({ player, projPts, isFinal, gameInfo }) {"


def main():
    text = MATCHUP_PAGE.read_text()
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED — expected exactly 1 match, found {count}.")
        sys.exit(1)
    MATCHUP_PAGE.write_text(text.replace(OLD, NEW, 1))
    print("OK — patched PlayerStatus signature to include gameInfo")
    print("Next: npm run build")


if __name__ == "__main__":
    main()
