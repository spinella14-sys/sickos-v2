#!/usr/bin/env python3
"""
Patches src/pages/FreeAgentsPage.jsx: comprehensive redesign per Adam's
request --
  1. Removes the "Show rostered" toggle (rostered players always excluded)
  2. Redesigns RFA filter from all/rfa/my-rfa to all/rfa/ufa (All FA
     default; RFA shows every RFA-eligible player league-wide, not just
     the viewer's own; UFA shows only non-RFA-tagged players)
  3. Removes the NFL Team column, adds a new RFA column showing the
     incumbent team (or — if not RFA-tagged)
  4. Merges the two-row player cell (name on top, POS/TEAM/RFA badge
     below) into a single row: name + small red "RFA" tag + POS + team,
     all inline
  5. Removes the duplicate watchlist star next to the player name
     (the one in the ACTION column stays)

Run from the sickos-v2 directory:
    python3 patch_freeagents_redesign.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/FreeAgentsPage.jsx")

# ── 1. Simplify the filtered() rostered check (always exclude) ──────────────
OLD_1 = """    let rows = allPlayers.filter(p => {
      if (!showRostered && rosteredIds.has(p.sleeper_id)) return false
      if (rfaFilter === 'rfa' && !rfaMap[p.sleeper_id]) return false
      if (rfaFilter === 'my-rfa' && rfaMap[p.sleeper_id] !== myTeam) return false
      if (pos !== 'All' && p.position !== pos) return false"""

NEW_1 = """    let rows = allPlayers.filter(p => {
      if (rosteredIds.has(p.sleeper_id)) return false
      if (rfaFilter === 'rfa' && !rfaMap[p.sleeper_id]) return false
      if (rfaFilter === 'ufa' && rfaMap[p.sleeper_id]) return false
      if (pos !== 'All' && p.position !== pos) return false"""

# ── 2. Remove "Show rostered" toggle + fix the RFA filter dropdown options ──
OLD_2 = """          <label className="fa-rostered-toggle">
            <input type="checkbox" checked={showRostered} onChange={e => setShowRostered(e.target.checked)} />
            Show rostered
          </label>
          <select className="fa-team-select" value={rfaFilter} onChange={e => setRfaFilter(e.target.value)}>
            <option value="all">RFA Status: All</option>
            <option value="rfa">RFA Only</option>
            <option value="my-rfa">My RFAs</option>
          </select>"""

NEW_2 = """          <select className="fa-team-select" value={rfaFilter} onChange={e => setRfaFilter(e.target.value)}>
            <option value="all">All FA</option>
            <option value="rfa">RFA</option>
            <option value="ufa">UFA</option>
          </select>"""

# ── 3. Header: remove NFL column, add RFA column ─────────────────────────────
OLD_3 = """                    <th className="fa-th fa-th-player"><SortHeader colKey="name" label="PLAYER" title="Player Name" /></th>
                    <th className="fa-th"><SortHeader colKey="default" label="NFL" title="NFL Team" /></th>
                    <th className="fa-th">POS</th>"""

NEW_3 = """                    <th className="fa-th fa-th-player"><SortHeader colKey="name" label="PLAYER" title="Player Name" /></th>
                    <th className="fa-th">POS</th>
                    <th className="fa-th">RFA</th>"""

# ── 4. Player cell: merge into one row, RFA badge in red, remove watchlist star ──
OLD_4 = """                            <div className="fa-player-info">
                              <PlayerLink playerId={p.sleeper_id} onClick={e => e.stopPropagation()} style={{textDecoration:'none',color:'inherit'}}>
                                {p.full_name || '—'}
                              </PlayerLink>
                              <div className="fa-player-meta">
                                <span style={{color: p.position==='QB'?'#e8822a':p.position==='RB'?'#3dba6e':p.position==='WR'?'#3a9fd4':'#d4a843', fontWeight:800, fontSize:10}}>
                                  {p.position}
                                </span>
                                {p.nfl_team && <span style={{color:'var(--text-muted)',fontSize:10}}> · {p.nfl_team}</span>}
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
                              </div>
                            </div>
                            <button
                              className="fa-wl-btn"
                              onClick={() => toggleWatchlist(p.sleeper_id)}
                              title={onWl ? 'Remove from watchlist' : 'Add to watchlist'}
                            >
                              {onWl ? '★' : '☆'}
                            </button>
                          </div>
                        </td>
                        <td className="fa-td fa-td-center">{p.nfl_team || '—'}</td>
                        <td className="fa-td fa-td-center">{p.position || '—'}</td>"""

NEW_4 = """                            <div className="fa-player-info">
                              <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                                <PlayerLink playerId={p.sleeper_id} onClick={e => e.stopPropagation()} style={{textDecoration:'none',color:'inherit'}}>
                                  {p.full_name || '—'}
                                </PlayerLink>
                                {rfaMap[p.sleeper_id] && (
                                  <span style={{fontSize:9, fontWeight:800, letterSpacing:'0.06em', color:'#d94f4f'}}>
                                    RFA
                                  </span>
                                )}
                                <span style={{color: p.position==='QB'?'#e8822a':p.position==='RB'?'#3dba6e':p.position==='WR'?'#3a9fd4':'#d4a843', fontWeight:800, fontSize:10}}>
                                  {p.position}
                                </span>
                                {p.nfl_team && <span style={{color:'var(--text-muted)',fontSize:10}}>{p.nfl_team}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="fa-td fa-td-center">{p.position || '—'}</td>
                        <td className="fa-td fa-td-center">{rfaMap[p.sleeper_id] || '—'}</td>"""


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
    text = apply(text, OLD_1, NEW_1, "always exclude rostered players")
    text = apply(text, OLD_2, NEW_2, "remove Show Rostered toggle, fix RFA filter options")
    text = apply(text, OLD_3, NEW_3, "remove NFL header, add RFA header")
    text = apply(text, OLD_4, NEW_4, "merge player cell to one row, add RFA column, remove duplicate star")

    TARGET.write_text(text)
    print("✓ Patched src/pages/FreeAgentsPage.jsx — full redesign applied.")
    print("NOTE: showRostered/setShowRostered state declaration is now unused but harmless to leave in place.")


if __name__ == "__main__":
    main()
