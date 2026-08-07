#!/usr/bin/env python3
"""
Patch — Remove old SBWidget render from CapSheetPage
The signing bonus content now has its own tab (SBTab.jsx). Leaves the
SBWidget component definition in place, unused — just removes the call site.

Run from ~/Downloads/sickos-v2
    python3 patch_remove_old_sbwidget.py
"""
import sys
from pathlib import Path

CAP_SHEET = Path.cwd() / "src" / "pages" / "CapSheetPage.jsx"

OLD = "      <SBWidget abbrev={abbrev?.toUpperCase()} salary={team?.salary || 0} />\n"
NEW = ""


def main():
    text = CAP_SHEET.read_text()
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED — expected exactly 1 match, found {count}.")
        sys.exit(1)
    CAP_SHEET.write_text(text.replace(OLD, NEW, 1))
    print("OK — removed old SBWidget render call")
    print("Next: npm run build")


if __name__ == "__main__":
    main()
