#!/usr/bin/env python3
"""
Patch -- Full Stats section rebuild: PFR-style Passing/Rushing/Receiving
Replaces the single condensed table with three properly labeled
sub-tables, each shown independently based on whether the player has real
data in that category (not gated purely by primary position -- a mobile
QB gets both Passing and Rushing tables, a pass-catching RB gets both
Rushing and Receiving, etc). FUM (fumbles_lost) is a single aggregate stat
in our data, shown in every relevant section per the spec, matching how
PFR itself repeats total fumbles across tables.

Run from ~/Downloads/sickos-v2
    python3 patch_full_stats_expand.py
"""
import sys
from pathlib import Path

PLAYER_PAGE = Path.cwd() / "src" / "pages" / "PlayerPage.jsx"

OLD = (
    '                <h3 className="pp-career-subheading">Full Stats</h3>\n'
    '                <table className="pp-career-table pp-career-table--pct">\n'
    '                  <thead>\n'
    '                    <tr>\n'
    '                      <th>YEAR</th>\n'
    "                      {pos==='QB' && <><th>CMP</th><th>ATT</th><th>CMP%</th><th>SACK</th></>}\n"
    "                      {pos==='RB' && <><th>RUSH ATT</th><th>TGT</th><th>REC</th></>}\n"
    "                      {(pos==='WR'||pos==='TE') && <><th>TGT</th><th>REC</th><th>RUSH ATT</th></>}\n"
    '                      <th>FUM LOST</th>\n'
    '                    </tr>\n'
    '                  </thead>\n'
    '                  <tbody>\n'
    '                    {career.map(s => {\n'
    '                      const ranks = careerRanks[s.season]\n'
    "                      const pctSrc = careerViewMode==='perGame' ? ranks?.perGame_percentile : ranks?.total_percentile\n"
    "                      const divisor = careerViewMode==='perGame' && s.games ? s.games : 1\n"
    "                      const dv = (raw) => raw==null ? '\u2014' : fmt(divisor>1 ? raw/divisor : raw, divisor>1?1:0)\n"
    "                      const cmpPct = s.pass_att ? fmt((s.pass_cmp/s.pass_att)*100, 1) + '%' : '\u2014'\n"
    '                      return (\n'
    "                      <tr key={s.season} className={`pp-career-row ${s.season===CURRENT_SEASON?'pp-career-row--current':''}`}>\n"
    '                        <td className="pp-career-year">{s.season}</td>\n'
    "                        {pos==='QB' && <>\n"
    '                          <PctCell value={dv(s.pass_cmp)} percentile={pctSrc?.pass_cmp}/>\n'
    '                          <PctCell value={dv(s.pass_att)} percentile={pctSrc?.pass_att}/>\n'
    '                          <td>{cmpPct}</td>\n'
    '                          <PctCell value={dv(s.pass_sack)} percentile={pctSrc?.pass_sack}/>\n'
    '                        </>}\n'
    "                        {pos==='RB' && <>\n"
    '                          <PctCell value={dv(s.rush_att)} percentile={pctSrc?.rush_att}/>\n'
    '                          <PctCell value={dv(s.targets)} percentile={pctSrc?.targets}/>\n'
    '                          <PctCell value={dv(s.rec)} percentile={pctSrc?.rec}/>\n'
    '                        </>}\n'
    "                        {(pos==='WR'||pos==='TE') && <>\n"
    '                          <PctCell value={dv(s.targets)} percentile={pctSrc?.targets}/>\n'
    '                          <PctCell value={dv(s.rec)} percentile={pctSrc?.rec}/>\n'
    '                          <PctCell value={dv(s.rush_att)} percentile={pctSrc?.rush_att}/>\n'
    '                        </>}\n'
    "                        <td>{fmt(s.fumbles_lost)||'\u2014'}</td>\n"
    '                      </tr>\n'
    '                    )})}\n'
    '                  </tbody>\n'
    '                </table>\n'
)

NEW = r'''                <h3 className="pp-career-subheading">Full Stats</h3>

                {(pos==='QB' || career.some(s=>s.pass_att>0)) && (
                <>
                  <div className="pp-career-group-label">Passing</div>
                  <table className="pp-career-table pp-career-table--pct">
                    <thead>
                      <tr>
                        <th>YEAR</th><th>GM</th><th>CMP-ATT</th><th>%</th><th>YDS</th><th>TD</th><th>INT</th><th>FUM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {career.map(s => {
                        const ranks = careerRanks[s.season]
                        const pctSrc = careerViewMode==='perGame' ? ranks?.perGame_percentile : ranks?.total_percentile
                        const divisor = careerViewMode==='perGame' && s.games ? s.games : 1
                        const dv = (raw) => raw==null ? '—' : fmt(divisor>1 ? raw/divisor : raw, divisor>1?1:0)
                        const cmpPct = s.pass_att ? fmt((s.pass_cmp/s.pass_att)*100, 1) + '%' : '—'
                        return (
                        <tr key={s.season} className={`pp-career-row ${s.season===CURRENT_SEASON?'pp-career-row--current':''}`}>
                          <td className="pp-career-year">{s.season}</td>
                          <td>{s.games}</td>
                          <td>{s.pass_cmp||0}-{s.pass_att||0}</td>
                          <td>{cmpPct}</td>
                          <PctCell value={dv(s.pass_yd)} percentile={pctSrc?.pass_yd}/>
                          <PctCell value={dv(s.pass_td)} percentile={pctSrc?.pass_td}/>
                          <PctCell value={dv(s.pass_int)} percentile={pctSrc?.pass_int}/>
                          <td>{fmt(s.fumbles_lost)||'—'}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </>
                )}

                {(pos!=='WR' || career.some(s=>s.rush_att>0)) && career.some(s=>s.rush_att>0) && (
                <>
                  <div className="pp-career-group-label">Rushing</div>
                  <table className="pp-career-table pp-career-table--pct">
                    <thead>
                      <tr>
                        <th>YEAR</th><th>GM</th><th>RUSH</th><th>YDS</th><th>YPC</th><th>TD</th><th>FUM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {career.map(s => {
                        const ranks = careerRanks[s.season]
                        const pctSrc = careerViewMode==='perGame' ? ranks?.perGame_percentile : ranks?.total_percentile
                        const divisor = careerViewMode==='perGame' && s.games ? s.games : 1
                        const dv = (raw) => raw==null ? '—' : fmt(divisor>1 ? raw/divisor : raw, divisor>1?1:0)
                        const ypc = s.rush_att ? fmt(s.rush_yd/s.rush_att, 1) : '—'
                        return (
                        <tr key={s.season} className={`pp-career-row ${s.season===CURRENT_SEASON?'pp-career-row--current':''}`}>
                          <td className="pp-career-year">{s.season}</td>
                          <td>{s.games}</td>
                          <PctCell value={dv(s.rush_att)} percentile={pctSrc?.rush_att}/>
                          <PctCell value={dv(s.rush_yd)} percentile={pctSrc?.rush_yd}/>
                          <td>{ypc}</td>
                          <PctCell value={dv(s.rush_td)} percentile={pctSrc?.rush_td}/>
                          <td>{fmt(s.fumbles_lost)||'—'}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </>
                )}

                {(pos!=='QB' || career.some(s=>s.targets>0)) && career.some(s=>s.targets>0 || s.rec>0) && (
                <>
                  <div className="pp-career-group-label">Receiving</div>
                  <table className="pp-career-table pp-career-table--pct">
                    <thead>
                      <tr>
                        <th>YEAR</th><th>GM</th><th>TAR</th><th>REC</th><th>YDS</th><th>YPC</th><th>TD</th><th>FUM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {career.map(s => {
                        const ranks = careerRanks[s.season]
                        const pctSrc = careerViewMode==='perGame' ? ranks?.perGame_percentile : ranks?.total_percentile
                        const divisor = careerViewMode==='perGame' && s.games ? s.games : 1
                        const dv = (raw) => raw==null ? '—' : fmt(divisor>1 ? raw/divisor : raw, divisor>1?1:0)
                        const ypc = s.rec ? fmt(s.rec_yd/s.rec, 1) : '—'
                        return (
                        <tr key={s.season} className={`pp-career-row ${s.season===CURRENT_SEASON?'pp-career-row--current':''}`}>
                          <td className="pp-career-year">{s.season}</td>
                          <td>{s.games}</td>
                          <PctCell value={dv(s.targets)} percentile={pctSrc?.targets}/>
                          <PctCell value={dv(s.rec)} percentile={pctSrc?.rec}/>
                          <PctCell value={dv(s.rec_yd)} percentile={pctSrc?.rec_yd}/>
                          <td>{ypc}</td>
                          <PctCell value={dv(s.rec_td)} percentile={pctSrc?.rec_td}/>
                          <td>{fmt(s.fumbles_lost)||'—'}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </>
                )}
'''

PLAYER_CSS = Path.cwd() / "src" / "pages" / "PlayerPage.css"

def main():
    text = PLAYER_PAGE.read_text(encoding="utf-8")
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED -- expected exactly 1 match, found {count}. Aborting, nothing written.")
        sys.exit(1)
    text = text.replace(OLD, NEW, 1)
    PLAYER_PAGE.write_text(text, encoding="utf-8")
    print("OK -- rebuilt Full Stats as Passing/Rushing/Receiving sub-tables")

    css = PLAYER_CSS.read_text(encoding="utf-8")
    css_addition = "\n\n.pp-career-group-label {\n  font-family: var(--font-ui); font-size: 11px; font-weight: 800; letter-spacing: 0.1em;\n  text-transform: uppercase; color: var(--text-muted); margin: 14px 0 6px;\n}\n"
    css = css + css_addition
    PLAYER_CSS.write_text(css, encoding="utf-8")
    print("OK -- appended .pp-career-group-label CSS")
    print("Next: npm run build")

if __name__ == "__main__":
    main()
