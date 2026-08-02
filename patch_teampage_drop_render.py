#!/usr/bin/env python3
"""
Patches src/pages/TeamPage.jsx: renders <DropConfirmModal> conditionally
when dropTarget is set, right after the existing NewsCard modal render.

Run from the sickos-v2 directory:
    python3 patch_teampage_drop_render.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/TeamPage.jsx")

OLD_BLOCK = """      {newsModal && (
        <NewsCard
          sleeperId={newsModal.sleeperId}
          playerName={newsModal.name}
          defaultTab={newsModal.tab}
          onClose={() => setNewsModal(null)}
        />
      )}
    </div>
  )
}"""

NEW_BLOCK = """      {newsModal && (
        <NewsCard
          sleeperId={newsModal.sleeperId}
          playerName={newsModal.name}
          defaultTab={newsModal.tab}
          onClose={() => setNewsModal(null)}
        />
      )}

      {dropTarget && (
        <DropConfirmModal
          contract={dropTarget}
          teamAbbrev={abbrev}
          onClose={() => setDropTarget(null)}
          onDropped={() => window.location.reload()}
        />
      )}
    </div>
  )
}"""


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
    print("✓ Patched src/pages/TeamPage.jsx — DropConfirmModal now renders when dropTarget is set.")


if __name__ == "__main__":
    main()
