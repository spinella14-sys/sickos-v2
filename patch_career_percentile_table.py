#!/usr/bin/env python3
"""
Patch -- Career tab rebuild: percentile heatmap + Total/Per-Game toggle
Fetches /position-ranks once per season present in career data, merges
with the existing raw per-season totals, and renders each stat as a
colored percentile badge (CTG-style diverging blue-low/orange-high scale)
next to the raw value. Analytics rate columns (catch rate, EPA, etc.) are
a planned fast-follow, not included in this pass.

Run from ~/Downloads/sickos-v2
    python3 patch_career_percentile_table.py
"""
import sys
from pathlib import Path

PLAYER_PAGE = Path.cwd() / "src" / "pages" / "PlayerPage.jsx"
PLAYER_CSS  = Path.cwd() / "src" / "pages" / "PlayerPage.css"


def apply_or_die(text, old, new, label):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}], expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)


def main():
    jsx = PLAYER_PAGE.read_text(encoding="utf-8")

    # 1. New state + per-season ranks fetch, right after the existing career fetch effect
    OLD_EFFECT = (
        "  useEffect(() => {\n"
        "    if (activeTab !== 'career' || career || !id) return\n"
        "    setCareerLoading(true)\n"
        "    fetch(`${API_BASE}/stats/player/${id}/career`)\n"
        "      .then(r => r.ok ? r.json() : [])\n"
        "      .then(data => { setCareer(data); setCareerLoading(false) })\n"
        "      .catch(() => setCareerLoading(false))\n"
        "  }, [activeTab, player?.sleeper_id])"
    )
    NEW_EFFECT = (
        "  const [careerViewMode, setCareerViewMode] = useState('total') // 'total' | 'perGame'\n"
        "  const [careerRanks,    setCareerRanks]    = useState({}) // { [season]: position-ranks response }\n"
        "\n"
        "  useEffect(() => {\n"
        "    if (activeTab !== 'career' || career || !id) return\n"
        "    setCareerLoading(true)\n"
        "    fetch(`${API_BASE}/stats/player/${id}/career`)\n"
        "      .then(r => r.ok ? r.json() : [])\n"
        "      .then(data => { setCareer(data); setCareerLoading(false) })\n"
        "      .catch(() => setCareerLoading(false))\n"
        "  }, [activeTab, player?.sleeper_id])\n"
        "\n"
        "  // Fetch position-ranks (rank + percentile) once per season present in career data\n"
        "  useEffect(() => {\n"
        "    if (!career || !career.length || !id) return\n"
        "    const seasonsNeeded = career.map(s => s.season).filter(s => !careerRanks[s])\n"
        "    if (!seasonsNeeded.length) return\n"
        "    Promise.all(seasonsNeeded.map(s =>\n"
        "      fetch(`${API_BASE}/stats/player/${id}/position-ranks?season=${s}`)\n"
        "        .then(r => r.ok ? r.json() : null)\n"
        "        .then(data => ({ season: s, data }))\n"
        "        .catch(() => ({ season: s, data: null }))\n"
        "    )).then(results => {\n"
        "      setCareerRanks(prev => {\n"
        "        const next = { ...prev }\n"
        "        results.forEach(r => { next[r.season] = r.data })\n"
        "        return next\n"
        "      })\n"
        "    })\n"
        "  }, [career, id])\n"
        "\n"
        "  // CTG-style diverging percentile color: low = blue, mid = near-white, high = orange\n"
        "  function percentileColor(pct) {\n"
        "    if (pct == null) return null\n"
        "    if (pct < 50) {\n"
        "      const t = pct / 50\n"
        "      const r = Math.round(70 + t * (255 - 70))\n"
        "      const g = Math.round(130 + t * (255 - 130))\n"
        "      const b = Math.round(220 + t * (255 - 220))\n"
        "      return `rgb(${r},${g},${b})`\n"
        "    }\n"
        "    const t = (pct - 50) / 50\n"
        "    const r = 255\n"
        "    const g = Math.round(255 - t * (255 - 140))\n"
        "    const b = Math.round(255 - t * (255 - 40))\n"
        "    return `rgb(${r},${g},${b})`\n"
        "  }\n"
        "\n"
        "  function PctCell({ value, percentile }) {\n"
        "    const bg = percentileColor(percentile)\n"
        "    return (\n"
        "      <td className=\"pp-career-pct-cell\">\n"
        "        {percentile != null && (\n"
        "          <span className=\"pp-career-pct-badge\" style={{ background: bg }}>{percentile}</span>\n"
        "        )}\n"
        "        <span className=\"pp-career-pct-val\">{value}</span>\n"
        "      </td>\n"
        "    )\n"
        "  }"
    )
    jsx = apply_or_die(jsx, OLD_EFFECT, NEW_EFFECT, "add per-season ranks fetch + percentile color helper + PctCell")

    # 2. Rebuild the table render itself
    OLD_TABLE = (
        "              <div className=\"pp-career-wrap\">\n"
        "                <table className=\"pp-career-table\">\n"
        "                  <thead>\n"
        "                    <tr>\n"
        "                      <th>YEAR</th><th>G</th><th>PTS</th><th>PTS/G</th>\n"
        "                      {(pos==='QB'||career.some(s=>s.pass_yd>0))&&<th>PASS YD</th>}\n"
        "                      {(pos==='QB'||career.some(s=>s.pass_td>0))&&<th>PASS TD</th>}\n"
        "                      {(pos==='QB'||career.some(s=>s.pass_int>0))&&<th>INT</th>}\n"
        "                      {(pos!=='QB'||career.some(s=>s.rush_yd>0))&&<th>RUSH YD</th>}\n"
        "                      <th>RUSH TD</th>\n"
        "                      {(pos!=='QB'||career.some(s=>s.rec_yd>0))&&<th>REC YD</th>}\n"
        "                      <th>REC TD</th>\n"
        "                    </tr>\n"
        "                  </thead>\n"
        "                  <tbody>\n"
        "                    {career.map(s => (\n"
        "                      <tr key={s.season} className={`pp-career-row ${s.season===CURRENT_SEASON?'pp-career-row--current':''}`}>\n"
        "                        <td className=\"pp-career-year\">{s.season}</td>\n"
        "                        <td>{s.games}</td>\n"
        "                        <td style={{color:accentColor,fontWeight:700}}>{fmt(calcFantasyPts(s,pos),1)}</td>\n"
        "                        <td>{s.games?fmt(calcFantasyPts(s,pos)/s.games,1):'\u2014'}</td>\n"
        "                        {(pos==='QB'||career.some(c=>c.pass_yd>0))&&<td>{fmt(s.pass_yd)||'\u2014'}</td>}\n"
        "                        {(pos==='QB'||career.some(c=>c.pass_td>0))&&<td>{fmt(s.pass_td)||'\u2014'}</td>}\n"
        "                        {(pos==='QB'||career.some(c=>c.pass_int>0))&&<td>{fmt(s.pass_int)||'\u2014'}</td>}\n"
        "                        {(pos!=='QB'||career.some(c=>c.rush_yd>0))&&<td>{fmt(s.rush_yd)||'\u2014'}</td>}\n"
        "                        <td>{fmt(s.rush_td)||'\u2014'}</td>\n"
        "                        {(pos!=='QB'||career.some(c=>c.rec_yd>0))&&<td>{fmt(s.rec_yd)||'\u2014'}</td>}\n"
        "                        <td>{fmt(s.rec_td)||'\u2014'}</td>\n"
        "                      </tr>\n"
        "                    ))}\n"
        "                  </tbody>\n"
        "                </table>\n"
        "                <div className=\"pp-career-note\">Stats reflect seasons with recorded data in the Sickos Only database.</div>\n"
        "              </div>"
    )
    NEW_TABLE = (
        "              <div className=\"pp-career-wrap\">\n"
        "                <div className=\"pp-career-toggle\">\n"
        "                  <button className={careerViewMode==='total'?'pp-toggle-btn pp-toggle-btn--active':'pp-toggle-btn'} onClick={()=>setCareerViewMode('total')}>Total</button>\n"
        "                  <button className={careerViewMode==='perGame'?'pp-toggle-btn pp-toggle-btn--active':'pp-toggle-btn'} onClick={()=>setCareerViewMode('perGame')}>Per Game</button>\n"
        "                </div>\n"
        "                <table className=\"pp-career-table pp-career-table--pct\">\n"
        "                  <thead>\n"
        "                    <tr>\n"
        "                      <th>YEAR</th><th>G</th><th>PTS</th><th>PTS/G</th>\n"
        "                      {(pos==='QB'||career.some(s=>s.pass_yd>0))&&<th>PASS YD</th>}\n"
        "                      {(pos==='QB'||career.some(s=>s.pass_td>0))&&<th>PASS TD</th>}\n"
        "                      {(pos==='QB'||career.some(s=>s.pass_int>0))&&<th>INT</th>}\n"
        "                      {(pos!=='QB'||career.some(s=>s.rush_yd>0))&&<th>RUSH YD</th>}\n"
        "                      <th>RUSH TD</th>\n"
        "                      {(pos!=='QB'||career.some(s=>s.rec_yd>0))&&<th>REC YD</th>}\n"
        "                      <th>REC TD</th>\n"
        "                    </tr>\n"
        "                  </thead>\n"
        "                  <tbody>\n"
        "                    {career.map(s => {\n"
        "                      const ranks = careerRanks[s.season]\n"
        "                      const pctSrc = careerViewMode==='perGame' ? ranks?.perGame_percentile : ranks?.total_percentile\n"
        "                      const divisor = careerViewMode==='perGame' && s.games ? s.games : 1\n"
        "                      const dispVal = (raw) => raw==null ? '\u2014' : fmt(divisor>1 ? raw/divisor : raw, divisor>1?1:0)\n"
        "                      return (\n"
        "                      <tr key={s.season} className={`pp-career-row ${s.season===CURRENT_SEASON?'pp-career-row--current':''}`}>\n"
        "                        <td className=\"pp-career-year\">{s.season}</td>\n"
        "                        <td>{s.games}</td>\n"
        "                        <td style={{color:accentColor,fontWeight:700}}>{fmt(calcFantasyPts(s,pos),1)}</td>\n"
        "                        <td>{s.games?fmt(calcFantasyPts(s,pos)/s.games,1):'\u2014'}</td>\n"
        "                        {(pos==='QB'||career.some(c=>c.pass_yd>0))&&<PctCell value={dispVal(s.pass_yd)} percentile={pctSrc?.pass_yd}/>}\n"
        "                        {(pos==='QB'||career.some(c=>c.pass_td>0))&&<PctCell value={dispVal(s.pass_td)} percentile={pctSrc?.pass_td}/>}\n"
        "                        {(pos==='QB'||career.some(c=>c.pass_int>0))&&<PctCell value={dispVal(s.pass_int)} percentile={pctSrc?.pass_int}/>}\n"
        "                        {(pos!=='QB'||career.some(c=>c.rush_yd>0))&&<PctCell value={dispVal(s.rush_yd)} percentile={pctSrc?.rush_yd}/>}\n"
        "                        <PctCell value={dispVal(s.rush_td)} percentile={pctSrc?.rush_td}/>\n"
        "                        {(pos!=='QB'||career.some(c=>c.rec_yd>0))&&<PctCell value={dispVal(s.rec_yd)} percentile={pctSrc?.rec_yd}/>}\n"
        "                        <PctCell value={dispVal(s.rec_td)} percentile={pctSrc?.rec_td}/>\n"
        "                      </tr>\n"
        "                    )})}\n"
        "                  </tbody>\n"
        "                </table>\n"
        "                <div className=\"pp-career-note\">Colored badges show percentile rank vs. same-position players that season. Stats reflect seasons with recorded data in the Sickos Only database.</div>\n"
        "              </div>"
    )
    jsx = apply_or_die(jsx, OLD_TABLE, NEW_TABLE, "rebuild career table with percentile badges + toggle")

    PLAYER_PAGE.write_text(jsx, encoding="utf-8")

    # 3. CSS for the toggle + percentile badge cells
    css = PLAYER_CSS.read_text(encoding="utf-8")
    APPEND_CSS = (
        "\n\n/* ---- Career tab: percentile heatmap ---- */\n"
        ".pp-career-toggle { display: flex; gap: 6px; margin-bottom: 12px; }\n"
        ".pp-toggle-btn {\n"
        "  font-family: var(--font-ui); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;\n"
        "  padding: 6px 14px; border-radius: 5px; border: 1px solid var(--border);\n"
        "  background: transparent; color: var(--text-muted); cursor: pointer;\n"
        "}\n"
        ".pp-toggle-btn--active { background: var(--orange); color: #000; border-color: var(--orange); }\n"
        ".pp-career-table--pct .pp-career-pct-cell { padding: 4px 8px; text-align: center; }\n"
        ".pp-career-pct-badge {\n"
        "  display: inline-block; min-width: 26px; padding: 2px 6px; border-radius: 4px;\n"
        "  font-family: var(--font-ui); font-size: 12px; font-weight: 800; color: #1a1a2e; margin-right: 6px;\n"
        "}\n"
        ".pp-career-pct-val { font-family: var(--font-ui); font-size: 13px; color: var(--text-primary); }\n"
    )
    css = css + APPEND_CSS
    PLAYER_CSS.write_text(css, encoding="utf-8")
    print("OK -- appended CSS for toggle + percentile badges")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
