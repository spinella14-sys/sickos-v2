#!/usr/bin/env python3
"""
Patch -- QB limit filtering in UFA draft pool
Hides QBs from the pool entirely (regardless of position filter selected)
once the team already has 2 active QBs, matching the backend's
checkQBLimit logic exactly. Shows a clear banner explaining why.

Run from ~/Downloads/sickos-v2
    python3 patch_ufa_qb_limit.py
"""
import sys
from pathlib import Path

BOARD = Path.cwd() / "src" / "components" / "ufa" / "UFAPlayerBoard.jsx"

OLD = """  const filtered = useMemo(() => {
    let list = [...players];
    if (posFilter !== 'ALL') list = list.filter(p => p.position === posFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        (p.nfl_team || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => String(a[sortKey] || '').toLowerCase().localeCompare(String(b[sortKey] || '').toLowerCase()));
    return list;
  }, [players, posFilter, search, sortKey]);"""

NEW = """  const activeQBCount = useMemo(() => {
    return (myCapData?.roster || []).filter(c =>
      c.roster_slots?.[0]?.slot_type === 'active' && c.players?.position === 'QB'
    ).length;
  }, [myCapData]);
  const qbLimitReached = activeQBCount >= 2;

  const filtered = useMemo(() => {
    let list = [...players];
    if (qbLimitReached) list = list.filter(p => p.position !== 'QB');
    if (posFilter !== 'ALL') list = list.filter(p => p.position === posFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        (p.nfl_team || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => String(a[sortKey] || '').toLowerCase().localeCompare(String(b[sortKey] || '').toLowerCase()));
    return list;
  }, [players, posFilter, search, sortKey, qbLimitReached]);"""

BANNER_OLD = """        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: GRID,
        padding: '7px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        color: 'var(--draft-text-muted)', textTransform: 'uppercase',
        borderBottom: '1px solid var(--draft-border)', background: 'var(--draft-surface)', flexShrink: 0,
      }}>
        <span /><span>PLAYER</span><span>POS</span><span>NFL TEAM</span><span>STATUS</span><span>ACTION</span>
      </div>"""

BANNER_NEW = """        </div>
      </div>

      {qbLimitReached && (
        <div style={{
          padding: '8px 16px', fontSize: 12, fontWeight: 600,
          color: 'var(--draft-amber)', background: 'rgba(232,168,67,0.12)',
          borderBottom: '1px solid var(--draft-border)',
        }}>
          \u26a0 QBs are hidden from this pool -- your roster is already at the 2-QB active limit.
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: GRID,
        padding: '7px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        color: 'var(--draft-text-muted)', textTransform: 'uppercase',
        borderBottom: '1px solid var(--draft-border)', background: 'var(--draft-surface)', flexShrink: 0,
      }}>
        <span /><span>PLAYER</span><span>POS</span><span>NFL TEAM</span><span>STATUS</span><span>ACTION</span>
      </div>"""

def main():
    text = BOARD.read_text(encoding="utf-8")
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

    BOARD.write_text(text, encoding="utf-8")
    print("OK -- QB limit filtering + banner added to UFA pool")
    print("Next: npm run build")

if __name__ == "__main__":
    main()
