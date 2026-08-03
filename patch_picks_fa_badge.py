#!/usr/bin/env python3
"""
Patch 3 (frontend) — Draft Pick tab: inline FA badge instead of Status column
Also fixes a real bug found along the way: Cap Sheet's FA badge never applied
the round-specific cs-fa-rfa-1/cs-fa-rfa-2 class (solid vs dashed border).

Run from ~/Downloads/sickos-v2
    python3 patch_picks_fa_badge.py
"""
import sys
from pathlib import Path

ROOT = Path.cwd()
TEAM_PAGE = ROOT / "src" / "pages" / "TeamPage.jsx"
TEAM_PAGE_CSS = ROOT / "src" / "pages" / "TeamPage.css"
CAP_SHEET = ROOT / "src" / "pages" / "CapSheetPage.jsx"


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
    # 1. Cap Sheet bug fix: apply round-specific class
    apply_patch(
        CAP_SHEET,
        old='<span className={`cs-fa-badge ${fa.isRFA ? \'cs-fa-rfa\' : \'cs-fa-ufa\'}`}>',
        new='<span className={`cs-fa-badge ${fa.isRFA ? `cs-fa-rfa cs-fa-rfa-${fa.round}` : \'cs-fa-ufa\'}`}>',
        label="Cap Sheet RFA round-specific badge class",
    )

    # 2. Add badge CSS to TeamPage.css (append at end of file)
    css_text = TEAM_PAGE_CSS.read_text()
    badge_css = """
/* FA status badge (mirrors CapSheetPage.css) */
.tp-fa-badge {
  display:inline-block;
  font-family:var(--font-ui); font-size:10px; font-weight:800; letter-spacing:0.12em;
  text-transform:uppercase; padding:4px 8px; border-radius:2px; white-space:nowrap;
}
.tp-fa-rfa   { background:rgba(217,79,79,0.15); color:var(--red); border:1px solid var(--red); }
.tp-fa-rfa-1 { border-style:solid; }
.tp-fa-rfa-2 { border-style:dashed; }
.tp-fa-ufa   { background:var(--green-dim); color:var(--green); border:1px solid var(--green); }
"""
    if ".tp-fa-badge" in css_text:
        print("SKIPPED — .tp-fa-badge CSS already present in TeamPage.css")
    else:
        TEAM_PAGE_CSS.write_text(css_text.rstrip() + "\n" + badge_css)
        print("OK — appended FA badge CSS to TeamPage.css")

    # 3. Expand pickYearCols to include the FA year (one year after contract ends)
    apply_patch(
        TEAM_PAGE,
        old="""  const pickYearCols = useMemo(() => {
    const years = new Set()
    ownedPicks.forEach(p => {
      const pc = p.projected_contract
      if (!pc) return
      for (let i = 0; i < pc.years; i++) years.add(p.season + i)
    })
    return Array.from(years).sort((a, b) => a - b)
  }, [ownedPicks])""",
        new="""  const pickYearCols = useMemo(() => {
    const years = new Set()
    ownedPicks.forEach(p => {
      const pc = p.projected_contract
      if (!pc) return
      for (let i = 0; i < pc.years; i++) years.add(p.season + i)
      years.add(p.season + pc.years) // FA year (year after contract ends)
    })
    return Array.from(years).sort((a, b) => a - b)
  }, [ownedPicks])""",
        label="include FA year in pickYearCols",
    )

    # 4. Replace table body: drop Status column, render inline FA badge
    apply_patch(
        TEAM_PAGE,
        old="""                      <thead>
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
                      </tbody>""",
        new="""                      <thead>
                        <tr>
                          <th>Season</th><th>Round</th><th>Pick</th><th>Origin</th>
                          {pickYearCols.map(y => <th key={y}>{y}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {ownedPicks.map(p => {
                          const pc = p.projected_contract
                          const faYear = pc ? p.season + pc.years : null
                          const faBadgeClass = pc
                            ? (pc.rfa_round ? `tp-fa-rfa tp-fa-rfa-${pc.rfa_round}` : 'tp-fa-ufa')
                            : ''
                          const faBadgeText = pc
                            ? (pc.rfa_round ? `RFA (${pc.rfa_round === 1 ? '1st' : '2nd'})` : 'UFA')
                            : ''
                          return (
                            <tr key={p.id} className="rtr">
                              <td style={{fontFamily:'var(--font-ui)',fontWeight:700}}>{p.season}</td>
                              <td style={{fontFamily:'var(--font-ui)'}}>Round {p.round}</td>
                              <td style={{fontFamily:'var(--font-ui)',color:'var(--text-muted)'}}>{p.pick_number ?? 'TBD'}</td>
                              <td style={{fontFamily:'var(--font-ui)',fontSize:12,color:'var(--text-muted)'}}>
                                {p.original_team_abbrev === abbrev?.toUpperCase() ? '—' : `via ${p.original_team_abbrev}`}
                              </td>
                              {pickYearCols.map((y, i) => {
                                if (pc && y === faYear) {
                                  return (
                                    <td key={y}>
                                      <span className={`tp-fa-badge ${faBadgeClass}`}>{faBadgeText}</span>
                                    </td>
                                  )
                                }
                                if (!pc || y < p.season || y >= faYear) {
                                  return <td key={y} style={{color:'var(--text-muted)'}}>—</td>
                                }
                                const yearIdx = y - p.season
                                const isNG = yearIdx >= pc.guaranteed_years
                                const sal = pc.salaries[yearIdx]
                                return (
                                  <td key={y} style={{fontFamily:'var(--font-ui)', color: isNG ? 'var(--purple)' : 'var(--orange)'}}>
                                    ${sal.toFixed(2)}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>""",
        label="Owned Picks table: inline FA badge, drop Status column",
    )

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
