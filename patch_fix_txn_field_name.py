#!/usr/bin/env python3
"""
Patch — Fix PlayerPage Transactions tab field-name bug
GET /api/transactions reshapes its response to key each transaction's
asset list as `assets`, not `transaction_assets` (see the `enriched` mapping
in index.js). My PlayerPage code read the wrong field name, so the detail
line silently fell back to blank for every transaction, for every player.

Run from ~/Downloads/sickos-v2
    python3 patch_fix_txn_field_name.py
"""
import sys
from pathlib import Path

PLAYER_PAGE = Path.cwd() / "src" / "pages" / "PlayerPage.jsx"

OLD = "const asset = (txn.transaction_assets || []).find(a => a.player_id === id) || (txn.transaction_assets || [])[0]"
NEW = "const asset = (txn.assets || []).find(a => a.player_id === id) || (txn.assets || [])[0]"


def main():
    text = PLAYER_PAGE.read_text()
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED — expected exactly 1 match, found {count}.")
        sys.exit(1)
    PLAYER_PAGE.write_text(text.replace(OLD, NEW, 1))
    print("OK — fixed field name: txn.assets instead of txn.transaction_assets")
    print("Next: npm run build")


if __name__ == "__main__":
    main()
