#!/usr/bin/env python3
"""
Rotates the hardcoded admin password ('brethart' -> new value) across every
frontend file that references it. This does NOT make the password secret --
it's still shipped in the public JS bundle, same as before. It's a stopgap
rotation only. The real fix (session-based admin auth via managers.is_admin,
checked server-side) is a separate, larger task.

Run from the sickos-v2 directory:
    python3 patch_rotate_admin_password.py
"""
import sys
from pathlib import Path

NEW_PASSWORD = "Sickos26-Vault!Q7"
OLD_PASSWORD = "brethart"

FILES = [
    "src/components/PendingTradesWidget.jsx",
    "src/pages/AdminRosterPage.jsx",
    "src/pages/AdminPage.jsx",
    "src/pages/AdminManagersPage.jsx",
    "src/pages/TradeMachinePage.jsx",
    "src/pages/AdminRFAPage.jsx",
    "src/pages/CalendarPage.jsx",
    "src/pages/CapSheetPage.jsx",
    "src/pages/InboxPage.jsx",
    "src/pages/PayoutCalculatorPage.jsx",
    "src/pages/AdminBulkEditPage.jsx",
    "src/pages/AdminUFAPage.jsx",
]


def main():
    total = 0
    missing = []
    zero_matches = []

    for rel_path in FILES:
        path = Path(rel_path)
        if not path.exists():
            missing.append(rel_path)
            continue
        text = path.read_text()
        count = text.count(OLD_PASSWORD)
        if count == 0:
            zero_matches.append(rel_path)
            continue
        new_text = text.replace(OLD_PASSWORD, NEW_PASSWORD)
        path.write_text(new_text)
        print(f"✓ {rel_path}: replaced {count} occurrence(s)")
        total += count

    if missing:
        print("\nERROR: These files were not found (run this from the sickos-v2 directory):")
        for m in missing:
            print(f"  - {m}")
    if zero_matches:
        print("\nWARNING: No occurrences of the old password found in these files")
        print("(may have already been changed, or the file content shifted):")
        for z in zero_matches:
            print(f"  - {z}")

    print(f"\nTotal replacements: {total}")
    if missing or zero_matches:
        print("Review the warnings above before proceeding.")
        sys.exit(1)
    print("All 12 files patched successfully.")


if __name__ == "__main__":
    main()
