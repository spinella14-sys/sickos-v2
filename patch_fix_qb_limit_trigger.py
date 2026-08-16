#!/usr/bin/env python3
"""
Corrective patch -- fix QB limit trigger condition
The real rule is max 2 active + max 1 PS (3 total, active+PS combined),
with IR unlimited/excluded. The first pass incorrectly blocked as soon as
active hit 2, even though a 3rd QB can still go to PS. Fixes the trigger
to count active+PS combined and block only at 3 total.

Run from ~/Downloads/sickos-v2
    python3 patch_fix_qb_limit_trigger.py
"""
import sys
from pathlib import Path

UFA_BOARD = Path.cwd() / "src" / "components" / "ufa" / "UFAPlayerBoard.jsx"
RFA_POOL = Path.cwd() / "src" / "components" / "rfa" / "RFAPool.jsx"


def apply_or_die(text, old, new, label, path_name):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}] in {path_name}, expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)


def main():
    # ---- UFA ----
    ufa_text = UFA_BOARD.read_text(encoding="utf-8")
    UFA_OLD = """  const activeQBCount = useMemo(() => {
    return (myCapData?.roster || []).filter(c =>
      c.roster_slots?.[0]?.slot_type === 'active' && c.players?.position === 'QB'
    ).length;
  }, [myCapData]);
  const qbLimitReached = activeQBCount >= 2;"""
    UFA_NEW = """  const totalQBCount = useMemo(() => {
    return (myCapData?.roster || []).filter(c => {
      const slot = c.roster_slots?.[0]?.slot_type;
      return (slot === 'active' || slot === 'ps') && c.players?.position === 'QB';
    }).length;
  }, [myCapData]);
  // Real rule: max 2 active + max 1 PS (3 total, active+PS combined). IR is
  // unlimited and excluded from this count entirely.
  const qbLimitReached = totalQBCount >= 3;"""
    ufa_text = apply_or_die(ufa_text, UFA_OLD, UFA_NEW, "fix UFA QB limit trigger (3 total, not 2 active)", "UFAPlayerBoard.jsx")
    UFA_BOARD.write_text(ufa_text, encoding="utf-8")

    # ---- RFA ----
    rfa_text = RFA_POOL.read_text(encoding="utf-8")
    RFA_OLD = """  const activeQBCount = (myTeamData?.roster || []).filter(c =>
    c.roster_slots?.[0]?.slot_type === 'active' && c.players?.position === 'QB'
  ).length;
  const qbLimitReached = activeQBCount >= 2;"""
    RFA_NEW = """  const totalQBCount = (myTeamData?.roster || []).filter(c => {
    const slot = c.roster_slots?.[0]?.slot_type;
    return (slot === 'active' || slot === 'ps') && c.players?.position === 'QB';
  }).length;
  // Real rule: max 2 active + max 1 PS (3 total, active+PS combined). IR is
  // unlimited and excluded from this count entirely.
  const qbLimitReached = totalQBCount >= 3;"""
    rfa_text = apply_or_die(rfa_text, RFA_OLD, RFA_NEW, "fix RFA QB limit trigger (3 total, not 2 active)", "RFAPool.jsx")
    RFA_POOL.write_text(rfa_text, encoding="utf-8")

    print("\nBoth files fixed. Next: npm run build")


if __name__ == "__main__":
    main()
