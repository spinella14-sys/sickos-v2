#!/usr/bin/env python3
"""
Patch -- Style .pp-career-subheading (Full Stats / Analytics section titles)
Was completely unstyled (default browser h3). Adds sizing/spacing
consistent with .pp-career-group-label but as a more prominent section
title, matching the page's established typography conventions.

Run from ~/Downloads/sickos-v2
    python3 patch_career_subheading_css.py
"""
import sys
from pathlib import Path

PLAYER_CSS = Path.cwd() / "src" / "pages" / "PlayerPage.css"

APPEND = """

.pp-career-subheading {
  font-family: var(--font-display); font-size: 18px; font-weight: 800;
  color: var(--text-primary); margin: 24px 0 10px;
  padding-bottom: 6px; border-bottom: 1px solid var(--border);
}
"""

def main():
    text = PLAYER_CSS.read_text(encoding="utf-8")
    text = text + APPEND
    PLAYER_CSS.write_text(text, encoding="utf-8")
    print("OK -- styled .pp-career-subheading")
    print("Next: npm run build")

if __name__ == "__main__":
    main()
