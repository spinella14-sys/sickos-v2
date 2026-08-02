#!/usr/bin/env python3
"""
Patches src/pages/FreeAgentsPage.jsx: the `filtered` useMemo's dependency
array was missing rfaFilter and rfaMap, even though both are used inside
the filter logic -- meaning React never recomputed the list when the
RFA/UFA dropdown changed. This is why selecting RFA or UFA had no visible
effect.

Run from the sickos-v2 directory:
    python3 patch_freeagents_rfa_filter_deps.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/FreeAgentsPage.jsx")

OLD_BLOCK = """  }, [allPlayers, rosteredIds, pos, nflTeam, search, showRostered, sortKey, sortDir, statsMap])"""

NEW_BLOCK = """  }, [allPlayers, rosteredIds, pos, nflTeam, search, rfaFilter, rfaMap, sortKey, sortDir, statsMap])"""


def main():
    if not TARGET.exists():
        print(f"ERROR: {TARGET} not found. Run this from the sickos-v2 directory.")
        sys.exit(1)

    text = TARGET.read_text()
    count = text.count(OLD_BLOCK)

    if count == 0:
        print("ERROR: Could not find the exact block to replace. No changes made.")
        sys.exit(1)
    if count > 1:
        print(f"ERROR: Found {count} matches, expected exactly 1. Aborting.")
        sys.exit(1)

    new_text = text.replace(OLD_BLOCK, NEW_BLOCK, 1)
    TARGET.write_text(new_text)
    print("✓ Patched src/pages/FreeAgentsPage.jsx — RFA/UFA dropdown now actually triggers a re-filter.")


if __name__ == "__main__":
    main()
