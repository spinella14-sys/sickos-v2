#!/usr/bin/env python3
"""
Patch — Horizontally compact Trade History
.tm-history had no max-width, so cards stretched edge-to-edge on wide
screens. Constrains to a centered 760px column, appropriate for the
simple header + one-line-summary card design.

Run from ~/Downloads/sickos-v2
    python3 patch_trade_history_width.py
"""
import sys
from pathlib import Path

CSS_PATH = Path.cwd() / "src" / "pages" / "TradeMachinePage.css"

OLD = ".tm-history       { padding:24px; display:flex; flex-direction:column; gap:12px; overflow-y:auto; }"
NEW = ".tm-history       { padding:24px; display:flex; flex-direction:column; gap:12px; overflow-y:auto; max-width:760px; margin:0 auto; width:100%; }"


def main():
    text = CSS_PATH.read_text()
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED — expected exactly 1 match, found {count}.")
        sys.exit(1)
    CSS_PATH.write_text(text.replace(OLD, NEW, 1))
    print("OK — constrained .tm-history to a centered 760px column")
    print("Next: npm run build")


if __name__ == "__main__":
    main()
