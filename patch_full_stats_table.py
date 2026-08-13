#!/usr/bin/env python3
"""
Patch -- Career tab: add Full Stats section (all accrued stats, not just
fantasy-scoring ones). Reuses PctCell + already-fetched careerRanks data,
since /position-ranks already covers every field needed here.

Run from ~/Downloads/sickos-v2
    python3 patch_full_stats_table.py
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

    OLD_ANCHOR = "                <h3 className=\"pp-career-subheading\">Analytics</h3>"
    NEW_ANCHOR = (
        "                <h3 className=\"pp-career-subheading\">Full Stats</h3>\n"
        "                <table className=\"pp-career-table pp-career-table--pct\">\n"
        "                  <thead>\n"
        "                    <tr>\n"
        "                      <th>YEAR</th>\n"
        "                      {pos==='QB' && <><th>CMP</th><th>ATT</th><th>CMP%</th><th>SACK</th></>}\n"
        "                      {pos==='RB' && <><th>RUSH ATT</th><th>TGT</th><th>REC</th></>}\n"
        "                      {(pos==='WR'||pos==='TE') && <><th>TGT</th><th>REC</th><th>RUSH ATT</th></>}\n"
        "                      <th>FUM LOST</th>\n"
        "                    </tr>\n"
        "                  </thead>\n"
        "                  <tbody>\n"
        "                    {career.map(s => {\n"
        "                      const ranks = careerRanks[s.season]\n"
        "                      const pctSrc = careerViewMode==='perGame' ? ranks?.perGame_percentile : ranks?.total_percentile\n"
        "                      const divisor = careerViewMode==='perGame' && s.games ? s.games : 1\n"
        "                      const dv = (raw) => raw==null ? '\u2014' : fmt(divisor>1 ? raw/divisor : raw, divisor>1?1:0)\n"
        "                      const cmpPct = s.pass_att ? fmt((s.pass_cmp/s.pass_att)*100, 1) + '%' : '\u2014'\n"
        "                      return (\n"
        "                      <tr key={s.season} className={`pp-career-row ${s.season===CURRENT_SEASON?'pp-career-row--current':''}`}>\n"
        "                        <td className=\"pp-career-year\">{s.season}</td>\n"
        "                        {pos==='QB' && <>\n"
        "                          <PctCell value={dv(s.pass_cmp)} percentile={pctSrc?.pass_cmp}/>\n"
        "                          <PctCell value={dv(s.pass_att)} percentile={pctSrc?.pass_att}/>\n"
        "                          <td>{cmpPct}</td>\n"
        "                          <PctCell value={dv(s.pass_sack)} percentile={pctSrc?.pass_sack}/>\n"
        "                        </>}\n"
        "                        {pos==='RB' && <>\n"
        "                          <PctCell value={dv(s.rush_att)} percentile={pctSrc?.rush_att}/>\n"
        "                          <PctCell value={dv(s.targets)} percentile={pctSrc?.targets}/>\n"
        "                          <PctCell value={dv(s.rec)} percentile={pctSrc?.rec}/>\n"
        "                        </>}\n"
        "                        {(pos==='WR'||pos==='TE') && <>\n"
        "                          <PctCell value={dv(s.targets)} percentile={pctSrc?.targets}/>\n"
        "                          <PctCell value={dv(s.rec)} percentile={pctSrc?.rec}/>\n"
        "                          <PctCell value={dv(s.rush_att)} percentile={pctSrc?.rush_att}/>\n"
        "                        </>}\n"
        "                        <td>{fmt(s.fumbles_lost)||'\u2014'}</td>\n"
        "                      </tr>\n"
        "                    )})}\n"
        "                  </tbody>\n"
        "                </table>\n"
        "\n"
        "                <h3 className=\"pp-career-subheading\">Analytics</h3>"
    )
    jsx = apply_or_die(jsx, OLD_ANCHOR, NEW_ANCHOR, "add Full Stats table")

    PLAYER_PAGE.write_text(jsx, encoding="utf-8")
    print("\nPatch applied. Next: npm run build")

if __name__ == "__main__":
    main()
