#!/usr/bin/env python3
"""
Patch -- Career tab: add analytics percentile table
Fetches /analytics per season (parallel to the existing /position-ranks
fetch), merges raw position-specific rate values with their percentiles
from analytics_percentile, and renders a second, position-appropriate
table below the main counting-stats table.

Run from ~/Downloads/sickos-v2
    python3 patch_career_analytics_table.py
"""
import sys
from pathlib import Path

PLAYER_PAGE = Path.cwd() / "src" / "pages" / "PlayerPage.jsx"

def apply_or_die(text, old, new, label):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}], expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)


def main():
    jsx = PLAYER_PAGE.read_text(encoding="utf-8")

    OLD_EFFECT = (
        "  }, [career, id])\n"
        "\n"
        "  // CTG-style diverging percentile color"
    )
    NEW_EFFECT = (
        "  }, [career, id])\n"
        "\n"
        "  const [careerAnalytics, setCareerAnalytics] = useState({}) // { [season]: /analytics response }\n"
        "\n"
        "  // Fetch raw analytics (rate stats) once per season present in career data\n"
        "  useEffect(() => {\n"
        "    if (!career || !career.length || !id) return\n"
        "    const seasonsNeeded = career.map(s => s.season).filter(s => !careerAnalytics[s])\n"
        "    if (!seasonsNeeded.length) return\n"
        "    Promise.all(seasonsNeeded.map(s =>\n"
        "      fetch(`${API_BASE}/stats/player/${id}/analytics?season=${s}`)\n"
        "        .then(r => r.ok ? r.json() : null)\n"
        "        .then(data => ({ season: s, data }))\n"
        "        .catch(() => ({ season: s, data: null }))\n"
        "    )).then(results => {\n"
        "      setCareerAnalytics(prev => {\n"
        "        const next = { ...prev }\n"
        "        results.forEach(r => { next[r.season] = r.data })\n"
        "        return next\n"
        "      })\n"
        "    })\n"
        "  }, [career, id])\n"
        "\n"
        "  // CTG-style diverging percentile color"
    )
    jsx = apply_or_die(jsx, OLD_EFFECT, NEW_EFFECT, "add per-season /analytics fetch")

    OLD_NOTE = (
        "                <div className=\"pp-career-note\">Colored badges show percentile rank vs. same-position players that season. Stats reflect seasons with recorded data in the Sickos Only database.</div>\n"
        "              </div>"
    )
    NEW_NOTE = (
        "                <div className=\"pp-career-note\">Colored badges show percentile rank vs. same-position players that season. Stats reflect seasons with recorded data in the Sickos Only database.</div>\n"
        "\n"
        "                <h3 className=\"pp-career-subheading\">Analytics</h3>\n"
        "                <table className=\"pp-career-table pp-career-table--pct\">\n"
        "                  <thead>\n"
        "                    <tr>\n"
        "                      <th>YEAR</th>\n"
        "                      {pos==='QB' && <><th>YDS/ATT</th><th>TD RATE</th><th>SACK RATE</th><th>EPA</th></>}\n"
        "                      {(pos==='RB') && <><th>CARRY RATE</th><th>RUSH TD RATE</th></>}\n"
        "                      {(pos==='WR'||pos==='TE'||pos==='RB') && <><th>TARGET RATE</th><th>CATCH RATE</th><th>YDS/TGT</th><th>REC TD RATE</th></>}\n"
        "                    </tr>\n"
        "                  </thead>\n"
        "                  <tbody>\n"
        "                    {career.map(s => {\n"
        "                      const pctSrc = careerRanks[s.season]?.analytics_percentile\n"
        "                      const an = careerAnalytics[s.season]\n"
        "                      const epaVal = pos==='QB' ? an?.passing?.epa : pos==='RB' ? an?.rushing?.epa : an?.receiving?.epa\n"
        "                      return (\n"
        "                      <tr key={s.season} className={`pp-career-row ${s.season===CURRENT_SEASON?'pp-career-row--current':''}`}>\n"
        "                        <td className=\"pp-career-year\">{s.season}</td>\n"
        "                        {pos==='QB' && <>\n"
        "                          <PctCell value={an?.passing?.yds_per_att ?? '\u2014'} percentile={pctSrc?.yds_per_att}/>\n"
        "                          <PctCell value={an?.passing?.td_rate!=null?`${an.passing.td_rate}%`:'\u2014'} percentile={pctSrc?.td_rate_pass}/>\n"
        "                          <PctCell value={an?.passing?.sack_rate!=null?`${an.passing.sack_rate}%`:'\u2014'} percentile={pctSrc?.sack_rate}/>\n"
        "                          <PctCell value={epaVal ?? '\u2014'} percentile={pctSrc?.epa_total}/>\n"
        "                        </>}\n"
        "                        {pos==='RB' && <>\n"
        "                          <PctCell value={an?.rushing?.carry_rate!=null?`${an.rushing.carry_rate}%`:'\u2014'} percentile={pctSrc?.carry_rate}/>\n"
        "                          <PctCell value={an?.rushing?.td_rate!=null?`${an.rushing.td_rate}%`:'\u2014'} percentile={pctSrc?.td_rate_rush}/>\n"
        "                        </>}\n"
        "                        {(pos==='WR'||pos==='TE'||pos==='RB') && <>\n"
        "                          <PctCell value={an?.receiving?.target_rate!=null?`${an.receiving.target_rate}%`:'\u2014'} percentile={pctSrc?.target_rate}/>\n"
        "                          <PctCell value={an?.receiving?.catch_rate!=null?`${an.receiving.catch_rate}%`:'\u2014'} percentile={pctSrc?.catch_rate}/>\n"
        "                          <PctCell value={an?.receiving?.yds_per_target ?? '\u2014'} percentile={pctSrc?.yds_per_target}/>\n"
        "                          <PctCell value={an?.receiving?.td_rate!=null?`${an.receiving.td_rate}%`:'\u2014'} percentile={pctSrc?.td_rate_rec}/>\n"
        "                        </>}\n"
        "                      </tr>\n"
        "                    )})}\n"
        "                  </tbody>\n"
        "                </table>\n"
        "              </div>"
    )
    jsx = apply_or_die(jsx, OLD_NOTE, NEW_NOTE, "add analytics percentile table")

    PLAYER_PAGE.write_text(jsx, encoding="utf-8")
    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
