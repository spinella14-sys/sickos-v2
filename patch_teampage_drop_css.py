#!/usr/bin/env python3
"""
Patches src/pages/TeamPage.css: adds styling for the new .rtr-drop-btn,
matching the existing font-ui/uppercase/letter-spacing button convention
used elsewhere on this page (e.g. .tp-save-btn), in the destructive red
already used for IR/danger states on this page.

Run from the sickos-v2 directory:
    python3 patch_teampage_drop_css.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/TeamPage.css")

OLD_BLOCK = """.rtr-action { width:120px; padding-left:4px!important; }"""

NEW_BLOCK = """.rtr-action { width:120px; padding-left:4px!important; display:flex; align-items:center; gap:6px; }
.rtr-drop-btn {
  font-family:var(--font-ui); font-size:9px; font-weight:700; letter-spacing:0.08em;
  text-transform:uppercase; white-space:nowrap; cursor:pointer;
  background:transparent; color:var(--red); border:1px solid var(--red);
  border-radius:4px; padding:4px 8px; transition:background 0.15s, color 0.15s;
}
.rtr-drop-btn:hover { background:var(--red); color:#fff; }"""


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
    print("✓ Patched src/pages/TeamPage.css — added Drop button styling.")


if __name__ == "__main__":
    main()
