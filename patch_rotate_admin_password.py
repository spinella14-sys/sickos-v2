#!/usr/bin/env python3
"""
Patch — Rotate exposed admin password (damage control, Phase A)
Replaces the old literal 'Sickos26-Vault!Q7' with the new password across
every file where it was hardcoded. This is a stopgap — the real fix (session-
based admin auth, no password embedded in frontend code at all) is Phase B,
a separate dedicated session before the draft.

Run from ~/Downloads/sickos-v2
    python3 patch_rotate_admin_password.py
"""
import sys
from pathlib import Path

ROOT = Path.cwd()
OLD_PW = "Sickos26-Vault!Q7"
NEW_PW = "dt1mExDJxmaxcr4rNVqb"

FILES = [
    "src/components/PendingTradesWidget.jsx",
    "src/pages/AdminRFAPage.jsx",
    "src/pages/AdminRosterPage.jsx",
    "src/pages/AdminUFAPage.jsx",
    "src/pages/CalendarPage.jsx",
    "src/pages/PayoutCalculatorPage.jsx",
    "src/pages/AdminPage.jsx",
    "src/pages/TradeMachinePage.jsx",
    "src/pages/CapSheetPage.jsx",
    "src/pages/AdminBulkEditPage.jsx",
    "src/pages/AdminManagersPage.jsx",
    "src/pages/InboxPage.jsx",
]


def main():
    total_replacements = 0
    for rel_path in FILES:
        path = ROOT / rel_path
        if not path.exists():
            print(f"FAILED — file not found: {rel_path}")
            sys.exit(1)
        text = path.read_text()
        count = text.count(OLD_PW)
        if count == 0:
            print(f"SKIPPED — {rel_path}: old password not found (already rotated?)")
            continue
        path.write_text(text.replace(OLD_PW, NEW_PW))
        print(f"OK — {rel_path}: replaced {count} occurrence(s)")
        total_replacements += count

    print(f"\nTotal replacements: {total_replacements}")
    print("Next: grep -rn 'Sickos26-Vault' src/  (should return nothing)")
    print("Then: npm run build")


if __name__ == "__main__":
    main()
