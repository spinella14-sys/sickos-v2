#!/usr/bin/env python3
"""
Patch -- Wire RosterViolationPopup into Dashboard
Run from ~/Downloads/sickos-v2
    python3 patch_wire_violation_popup.py
"""
import sys
from pathlib import Path

DASHBOARD = Path.cwd() / "src" / "pages" / "DashboardPage.jsx"

IMPORT_OLD = "import PendingTradesWidget from '../components/PendingTradesWidget'"
IMPORT_NEW = "import PendingTradesWidget from '../components/PendingTradesWidget'\nimport RosterViolationPopup from '../components/RosterViolationPopup'"

RENDER_OLD = "      <PendingTradesWidget />"
RENDER_NEW = "      <RosterViolationPopup />\n      <PendingTradesWidget />"


def main():
    text = DASHBOARD.read_text()

    if text.count(IMPORT_OLD) != 1:
        print(f"FAILED -- import anchor, found {text.count(IMPORT_OLD)}")
        sys.exit(1)
    text = text.replace(IMPORT_OLD, IMPORT_NEW, 1)

    if text.count(RENDER_OLD) != 1:
        print(f"FAILED -- render anchor, found {text.count(RENDER_OLD)}")
        sys.exit(1)
    text = text.replace(RENDER_OLD, RENDER_NEW, 1)

    DASHBOARD.write_text(text)
    print("OK -- wired RosterViolationPopup into Dashboard")
    print("Next: npm run build")


if __name__ == "__main__":
    main()
