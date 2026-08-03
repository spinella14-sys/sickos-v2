#!/usr/bin/env python3
"""
Patch 2/2 (frontend) — Draft Pick tab redesign
Replaces the single "Cap Value" column in TeamPage.jsx's Owned Picks table
with per-season contract columns (matching Cap Sheet's purple non-guaranteed
styling) + an RFA/UFA status column.

Run from ~/Downloads/sickos-v2
    python3 patch_owned_picks_table.py
"""
import sys
from pathlib import Path

ROOT = Path.cwd()
TEAM_PAGE = ROOT / "src" / "pages" / "TeamPage.jsx"

OLD_TABLE = """                  <div className="tp-table-wrap">
                    <table className="tp-table">
                      <thead><tr><th>Season</th><th>Round</th><th>Pick</th><th>Origin</th><th>Cap Value</th></tr></thead>
                      <tbody>
                        {ownedPicks.map(p => (
                          <tr key={p.id} className="rtr">
                            <td style={{fontFamily:'var(--font-ui)',fontWeight:700}}>{p.season}</td>
                            <td style={{fontFamily:'var(--font-ui)'}}>Round {p.round}</td>
                            <td style={{fontFamily:'var(--font-ui)',color:'var(--text-muted)'}}>{p.pick_number ?? 'TBD'}</td>
                            <td style={{fontFamily:'var(--font-ui)',fontSize:12,color:'var(--text-muted)'}}>
                              {p.original_team_abbrev === abbrev?.toUpperCase() ? '—' : `via ${p.original_team_abbrev}`}
                            </td>
                            <td style={{fontFamily:'var(--font-ui)',color:'var(--orange)'}}>{p.cap_value ? `$${parseFloat(p.cap_value).toFixed(2)}` : '$TBD'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>"""

NEW_TABLE = """                  <div className="tp-table-wrap">
                    <table className="tp-table">
                      <thead>
                        <tr>
                          <th>Season</th><th>Round</th><th>Pick</th><th>Origin</th><th>Status</th>
                          {pickYearCols.map(y => <th key={y}>{y}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {ownedPicks.map(p => {
                          const pc = p.projected_contract
                          return (
                            <tr key={p.id} className="rtr">
                              <td style={{fontFamily:'var(--font-ui)',fontWeight:700}}>{p.season}</td>
                              <td style={{fontFamily:'var(--font-ui)'}}>Round {p.round}</td>
                              <td style={{fontFamily:'var(--font-ui)',color:'var(--text-muted)'}}>{p.pick_number ?? 'TBD'}</td>
                              <td style={{fontFamily:'var(--font-ui)',fontSize:12,color:'var(--text-muted)'}}>
                                {p.original_team_abbrev === abbrev?.toUpperCase() ? '—' : `via ${p.original_team_abbrev}`}
                              </td>
                              <td style={{fontFamily:'var(--font-ui)',fontSize:12,fontWeight:700,color:'var(--text-muted)'}}>
                                {pc?.rfa_status ?? '—'}
                              </td>
                              {pickYearCols.map((y, i) => {
                                if (!pc || i >= pc.years) {
                                  return <td key={y} style={{color:'var(--text-muted)'}}>—</td>
                                }
                                const isNG = i >= pc.guaranteed_years
                                const sal = pc.salaries[i]
                                return (
                                  <td key={y} style={{fontFamily:'var(--font-ui)', color: isNG ? 'var(--purple)' : 'var(--orange)'}}>
                                    ${sal.toFixed(2)}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>"""

HOOK_ANCHOR = "  const [ownedPicks,      setOwnedPicks]      = useState([])"
HOOK_NEW = """  const [ownedPicks,      setOwnedPicks]      = useState([])
  const pickYearCols = useMemo(() => {
    const years = new Set()
    ownedPicks.forEach(p => {
      const pc = p.projected_contract
      if (!pc) return
      for (let i = 0; i < pc.years; i++) years.add(p.season + i)
    })
    return Array.from(years).sort((a, b) => a - b)
  }, [ownedPicks])"""


def apply_patch(path: Path, old: str, new: str, label: str):
    if not path.exists():
        print(f"FAILED — file not found: {path}")
        sys.exit(1)
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        print(f"FAILED — expected exactly 1 match for [{label}], found {count}.")
        print("--- expected old_str ---")
        print(old)
        sys.exit(1)
    path.write_text(text.replace(old, new, 1))
    print(f"OK — patched [{label}]")


def main():
    apply_patch(TEAM_PAGE, HOOK_ANCHOR, HOOK_NEW, "pickYearCols computed column hook")
    apply_patch(TEAM_PAGE, OLD_TABLE, NEW_TABLE, "Owned Picks table redesign")
    print("\nBoth patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
