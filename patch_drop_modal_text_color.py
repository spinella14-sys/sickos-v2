#!/usr/bin/env python3
"""
Patches src/pages/TeamPage.jsx: fixes the DropConfirmModal's title (had no
explicit color at all, inheriting an unreadable dark color against the
modal's dark background) and brightens the body text for better contrast.

Run from the sickos-v2 directory:
    python3 patch_drop_modal_text_color.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/TeamPage.jsx")

OLD_BLOCK = """        <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>Drop {p.full_name}?</div>
        <div style={{ fontSize:13, color:'#8B929E', marginBottom:16 }}>
          This removes {p.full_name} from your roster and makes them a free agent. This cannot be undone.
        </div>

        {loading && <div style={{ fontSize:13, color:'#8B929E' }}>Loading dead cap impact…</div>}"""

NEW_BLOCK = """        <div style={{ fontSize:18, fontWeight:800, marginBottom:4, color:'#fff' }}>Drop {p.full_name}?</div>
        <div style={{ fontSize:13, color:'#B8BEC7', marginBottom:16 }}>
          This removes {p.full_name} from your roster and makes them a free agent. This cannot be undone.
        </div>

        {loading && <div style={{ fontSize:13, color:'#B8BEC7' }}>Loading dead cap impact…</div>}"""


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
    print("✓ Patched src/pages/TeamPage.jsx — Drop modal text now explicitly light-colored and readable.")


if __name__ == "__main__":
    main()
