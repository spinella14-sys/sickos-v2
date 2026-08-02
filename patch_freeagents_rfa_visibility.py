#!/usr/bin/env python3
"""
Patches src/pages/FreeAgentsPage.jsx: adds RFA visibility for managers.
Previously RFA-tagged players showed up on this page indistinguishable
from true open free agents (they have no active contract, so they pass
the existing rostered-player filters) with no way to tell which team holds
RFA rights to them. This was only visible in the admin-only RFA Draft
module before. Adds:
  - rfaMap state (sleeper_id -> incumbent_team), fetched from the existing
    public GET /api/rfa/pool endpoint (no admin auth required)
  - A "RFA Status" filter dropdown (All / RFA Only / My RFAs)
  - A "RFA · {incumbent_team}" badge on tagged players' rows

Run from the sickos-v2 directory:
    python3 patch_freeagents_rfa_visibility.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/FreeAgentsPage.jsx")

# ── 1. Add rfaMap + rfaFilter state ──────────────────────────────────────────
OLD_1 = """  const [rosteredIds,  setRosteredIds]  = useState(new Set())"""
NEW_1 = """  const [rosteredIds,  setRosteredIds]  = useState(new Set())
  const [rfaMap,       setRfaMap]       = useState({})   // { sleeper_id: incumbent_team }
  const [rfaFilter,    setRfaFilter]    = useState('all') // 'all' | 'rfa' | 'my-rfa'"""

# ── 2. Fetch RFA pool, same pattern as the contracts fetch ──────────────────
OLD_2 = """  useEffect(() => {
    fetch(`${API_BASE}/contracts?season=${CURRENT_SEASON}`)
      .then(r => r.ok ? r.json() : [])
      .then(contracts => setRosteredIds(new Set((contracts || []).map(c => c.sleeper_id))))
      .catch(() => {})
  }, [])"""

NEW_2 = """  useEffect(() => {
    fetch(`${API_BASE}/contracts?season=${CURRENT_SEASON}`)
      .then(r => r.ok ? r.json() : [])
      .then(contracts => setRosteredIds(new Set((contracts || []).map(c => c.sleeper_id))))
      .catch(() => {})
  }, [])

  // RFA pool -- shows which free agents are actually RFA-tagged and which
  // team holds retention rights, so managers can see their own RFAs (this
  // was previously only visible in the admin-only RFA Draft module).
  useEffect(() => {
    fetch(`${API_BASE}/rfa/pool`)
      .then(r => r.ok ? r.json() : [])
      .then(pool => {
        const map = {}
        ;(pool || []).forEach(p => { map[p.sleeper_id] = p.incumbent_team })
        setRfaMap(map)
      })
      .catch(() => {})
  }, [])"""

# ── 3. Apply the RFA filter in the filtered useMemo ──────────────────────────
OLD_3 = """    let rows = allPlayers.filter(p => {
      if (!showRostered && rosteredIds.has(p.sleeper_id)) return false
      if (pos !== 'All' && p.position !== pos) return false"""

NEW_3 = """    let rows = allPlayers.filter(p => {
      if (!showRostered && rosteredIds.has(p.sleeper_id)) return false
      if (rfaFilter === 'rfa' && !rfaMap[p.sleeper_id]) return false
      if (rfaFilter === 'my-rfa' && rfaMap[p.sleeper_id] !== myTeam) return false
      if (pos !== 'All' && p.position !== pos) return false"""

# ── 4. Add the filter dropdown next to "Show rostered" ───────────────────────
OLD_4 = """          <label className="fa-rostered-toggle">
            <input type="checkbox" checked={showRostered} onChange={e => setShowRostered(e.target.checked)} />
            Show rostered
          </label>"""

NEW_4 = """          <label className="fa-rostered-toggle">
            <input type="checkbox" checked={showRostered} onChange={e => setShowRostered(e.target.checked)} />
            Show rostered
          </label>
          <select className="fa-team-select" value={rfaFilter} onChange={e => setRfaFilter(e.target.value)}>
            <option value="all">RFA Status: All</option>
            <option value="rfa">RFA Only</option>
            <option value="my-rfa">My RFAs</option>
          </select>"""

# ── 5. Show a badge on RFA-tagged players' rows ──────────────────────────────
OLD_5 = """                                {p.nfl_team && <span style={{color:'var(--text-muted)',fontSize:10}}> · {p.nfl_team}</span>}
                              </div>"""

NEW_5 = """                                {p.nfl_team && <span style={{color:'var(--text-muted)',fontSize:10}}> · {p.nfl_team}</span>}
                                {rfaMap[p.sleeper_id] && (
                                  <span style={{
                                    marginLeft:6, fontSize:9, fontWeight:800, letterSpacing:'0.06em',
                                    color: rfaMap[p.sleeper_id] === myTeam ? '#3dba6e' : '#d4a843',
                                    border: `1px solid ${rfaMap[p.sleeper_id] === myTeam ? '#3dba6e' : '#d4a843'}`,
                                    borderRadius:3, padding:'1px 4px',
                                  }}>
                                    RFA · {rfaMap[p.sleeper_id]}
                                  </span>
                                )}
                              </div>"""


def apply(text, old, new, label):
    count = text.count(old)
    if count == 0:
        print(f"ERROR: Could not find block for step '{label}'. No changes made.")
        sys.exit(1)
    if count > 1:
        print(f"ERROR: Block for step '{label}' appears {count} times, expected 1. Aborting.")
        sys.exit(1)
    return text.replace(old, new, 1)


def main():
    if not TARGET.exists():
        print(f"ERROR: {TARGET} not found. Run this from the sickos-v2 directory.")
        sys.exit(1)

    text = TARGET.read_text()
    text = apply(text, OLD_1, NEW_1, "add rfaMap + rfaFilter state")
    text = apply(text, OLD_2, NEW_2, "fetch RFA pool")
    text = apply(text, OLD_3, NEW_3, "apply RFA filter")
    text = apply(text, OLD_4, NEW_4, "add RFA filter dropdown")
    text = apply(text, OLD_5, NEW_5, "add RFA badge to player row")

    TARGET.write_text(text)
    print("✓ Patched src/pages/FreeAgentsPage.jsx — RFA status now visible to all managers (badge + filter).")


if __name__ == "__main__":
    main()
