#!/usr/bin/env python3
"""
Corrective patch -- finish PlayerBoard.jsx QB limit changes
The prior run's banner match failed on an em-dash transcription mismatch,
which (due to write-at-the-end ordering) meant NONE of PlayerBoard.jsx's
three intended changes were saved, despite two of them succeeding
in-memory. This redoes all three and writes once, only if all succeed.

Run from ~/Downloads/sickos-v2
    python3 patch_rookie_qb_limit_finish.py
"""
import sys
from pathlib import Path

PLAYER_BOARD = Path.cwd() / "src" / "components" / "draft" / "PlayerBoard.jsx"


def apply_or_die(text, old, new, label):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}], expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)


def main():
    text = PLAYER_BOARD.read_text(encoding="utf-8")

    PROPS_OLD = """  currentTeam,
  ownership = {},   // { sleeper_id: pct_owned }
}) {"""
    PROPS_NEW = """  currentTeam,
  ownership = {},   // { sleeper_id: pct_owned }
  myTeamData = null,
}) {"""
    text = apply_or_die(text, PROPS_OLD, PROPS_NEW, "add myTeamData prop")

    FILTER_OLD = """  const filtered = useMemo(() => {
    let list = rookies.map(r => ({
      ...r,
      percent_owned: ownership[r.sleeper_id] ?? 0,
    }));

    if (posFilter !== 'ALL') {
      list = list.filter(r => r.position === posFilter);
    }"""
    FILTER_NEW = """  const totalQBCount = useMemo(() => {
    return (myTeamData?.roster || []).filter(c => {
      const slot = c.roster_slots?.[0]?.slot_type;
      return (slot === 'active' || slot === 'ps') && c.players?.position === 'QB';
    }).length;
  }, [myTeamData]);
  // Real rule: max 2 active + max 1 PS (3 total, active+PS combined). IR is
  // unlimited and excluded from this count entirely.
  const qbLimitReached = totalQBCount >= 3;

  const filtered = useMemo(() => {
    let list = rookies.map(r => ({
      ...r,
      percent_owned: ownership[r.sleeper_id] ?? 0,
    }));

    if (qbLimitReached) {
      list = list.filter(r => r.position !== 'QB');
    }
    if (posFilter !== 'ALL') {
      list = list.filter(r => r.position === posFilter);
    }"""
    text = apply_or_die(text, FILTER_OLD, FILTER_NEW, "compute QB filter")

    BANNER_OLD = (
        "      </div>\n"
        "\n"
        "      {/* Column headers \u2014 7 cols: rank | player | pos | nfl team | college | % own | action */}"
    )
    BANNER_NEW = (
        "      </div>\n"
        "\n"
        "      {qbLimitReached && (\n"
        "        <div style={{\n"
        "          padding: '8px 16px', fontSize: 12, fontWeight: 600,\n"
        "          color: 'var(--draft-amber)', background: 'rgba(232,168,67,0.12)',\n"
        "          borderBottom: '1px solid var(--draft-border)',\n"
        "        }}>\n"
        "          \u26a0 QBs are hidden from this pool \u2014 your roster is already at the 2-active/1-PS QB limit.\n"
        "        </div>\n"
        "      )}\n"
        "\n"
        "      {/* Column headers \u2014 7 cols: rank | player | pos | nfl team | college | % own | action */}"
    )
    text = apply_or_die(text, BANNER_OLD, BANNER_NEW, "add QB limit banner")

    PLAYER_BOARD.write_text(text, encoding="utf-8")
    print("\nAll 3 patches applied and written. Next: npm run build")


if __name__ == "__main__":
    main()
