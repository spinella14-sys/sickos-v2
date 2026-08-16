#!/usr/bin/env python3
"""
Patch -- QB limit filtering in RFA draft pool
Only applies to Wave 2+ (bidding on another team's RFA -- a genuine new
acquisition). Wave 1 retention doesn't change QB count at all (the player
is already on the roster), so it's correctly left untouched.

Run from ~/Downloads/sickos-v2
    python3 patch_rfa_qb_limit.py
"""
import sys
from pathlib import Path

POOL = Path.cwd() / "src" / "components" / "rfa" / "RFAPool.jsx"

OLD = """  const filtered = pool.filter(p => {
    if (posFilter !== 'ALL' && p.position !== posFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.full_name.toLowerCase().includes(q) ||
        (p.position || '').toLowerCase().includes(q);
    }
    return true;
  });"""

NEW = """  const activeQBCount = (myTeamData?.roster || []).filter(c =>
    c.roster_slots?.[0]?.slot_type === 'active' && c.players?.position === 'QB'
  ).length;
  const qbLimitReached = activeQBCount >= 2;

  const filtered = pool.filter(p => {
    // Wave 1 is retention-only (player already on your roster) -- QB limit
    // never applies there. Wave 2+ is a genuine new acquisition.
    if (wave > 1 && qbLimitReached && p.position === 'QB') return false;
    if (posFilter !== 'ALL' && p.position !== posFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.full_name.toLowerCase().includes(q) ||
        (p.position || '').toLowerCase().includes(q);
    }
    return true;
  });"""

BANNER_OLD = """      </div>

      <div className="rfa-pool__col-headers">"""

BANNER_NEW = """      </div>

      {wave > 1 && qbLimitReached && (
        <div style={{
          padding: '8px 16px', fontSize: 12, fontWeight: 600,
          color: 'var(--draft-amber)', background: 'rgba(232,168,67,0.12)',
          borderBottom: '1px solid var(--draft-border)',
        }}>
          \u26a0 QBs are hidden from this pool -- your roster is already at the 2-QB active limit.
        </div>
      )}

      <div className="rfa-pool__col-headers">"""

def main():
    text = POOL.read_text(encoding="utf-8")
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED -- expected exactly 1 match, found {count}. Aborting, nothing written.")
        sys.exit(1)
    text = text.replace(OLD, NEW, 1)

    count2 = text.count(BANNER_OLD)
    if count2 != 1:
        print(f"FAILED -- banner anchor, expected exactly 1 match, found {count2}. Aborting, nothing written.")
        sys.exit(1)
    text = text.replace(BANNER_OLD, BANNER_NEW, 1)

    POOL.write_text(text, encoding="utf-8")
    print("OK -- QB limit filtering + banner added to RFA pool")
    print("Next: npm run build")

if __name__ == "__main__":
    main()
