#!/usr/bin/env python3
"""
Patch — Box score mirror fix
The JSX already renders [pts, bio, headshot] for the away side to mirror
home's [headshot, bio, pts] — but .mp-player--right's flex-direction:
row-reverse was reversing that back, making both sides render identically
(headshot always visually left, pts always visually right) instead of
mirrored (headshots toward outer edges, scores toward the center divider).

Run from ~/Downloads/sickos-v2
    python3 patch_mirror_fix.py
"""
import sys
from pathlib import Path

CSS_PATH = Path.cwd() / "src" / "pages" / "MatchupPage.css"


def apply_patch(path, old, new, label):
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        print(f"FAILED — expected exactly 1 match for [{label}], found {count}.")
        print("--- expected old_str ---")
        print(old)
        sys.exit(1)
    path.write_text(text.replace(old, new, 1))
    print(f"OK — patched [{label}]")


ROWREVERSE_OLD = ".mp-player--right { flex-direction: row-reverse; }"
ROWREVERSE_NEW = "/* .mp-player--right intentionally does NOT reverse flex-direction — the JSX\n   already swaps element order ([pts, bio, headshot]) to mirror home's\n   [headshot, bio, pts]. Adding row-reverse here would cancel that out. */"


def main():
    text = CSS_PATH.read_text()
    apply_patch(CSS_PATH, ROWREVERSE_OLD, ROWREVERSE_NEW, "remove row-reverse cancelling out JSX mirror")

    # Clean up now-dead rule referencing the old single .mp-pts element
    # (replaced by .mp-pts-block/.mp-pts-tot/.mp-pts-proj in Stage 2)
    text = CSS_PATH.read_text()
    DEAD_RULE = ".mp-player--right .mp-pts { text-align: left; }"
    if DEAD_RULE in text:
        text = text.replace(DEAD_RULE + "\n", "").replace(DEAD_RULE, "")
        CSS_PATH.write_text(text)
        print("OK — removed dead .mp-player--right .mp-pts rule (superseded by .mp-pts-block)")
    else:
        print("SKIPPED — dead .mp-pts rule not found (already clean)")

    print("\nPatch applied. Next: npm run build")


if __name__ == "__main__":
    main()
