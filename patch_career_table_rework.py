#!/usr/bin/env python3
"""
Patch -- Career table rework
1. Red/yellow/green percentile color scale (was blue/white/orange)
2. Heatmap toggle: normal mode shows value + percentile stacked and
   centered; heatmap mode shades the cell background instead
3. PTS/PTS-G get a POS-rank sub-label (e.g. "QB1") using the new
   fpts_total/fpts_pg rank fields, view-mode-aware
4. Centered column alignment throughout

Run from ~/Downloads/sickos-v2
    python3 patch_career_table_rework.py
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

    OLD_COLOR = (
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
    NEW_COLOR = (
        "  const [heatmapMode, setHeatmapMode] = useState(false)\n"
        "\n"
        "  // Red (bad) -> Yellow (neutral) -> Green (good)\n"
        "  function percentileColor(pctile) {\n"
        "    if (pctile == null) return null\n"
        "    const RED = [217,79,79], YELLOW = [232,175,41], GREEN = [61,186,110]\n"
        "    const a = pctile <= 50 ? RED : YELLOW\n"
        "    const b = pctile <= 50 ? YELLOW : GREEN\n"
        "    const t = pctile <= 50 ? pctile/50 : (pctile-50)/50\n"
        "    const r = Math.round(a[0] + t*(b[0]-a[0]))\n"
        "    const g = Math.round(a[1] + t*(b[1]-a[1]))\n"
        "    const bl = Math.round(a[2] + t*(b[2]-a[2]))\n"
        "    return `rgb(${r},${g},${bl})`\n"
        "  }\n"
        "\n"
        "  // value: main display number. percentile: drives color. subText: optional\n"
        "  // override for the small line below the value (defaults to \"{percentile}%\").\n"
        "  function PctCell({ value, percentile, subText }) {\n"
        "    const color = percentileColor(percentile)\n"
        "    const sub = subText !== undefined ? subText : (percentile != null ? `${percentile}%` : null)\n"
        "    if (heatmapMode) {\n"
        "      return (\n"
        "        <td className=\"pp-career-pct-cell pp-career-pct-cell--heatmap\" style={{ background: color || undefined }}>\n"
        "          <span className=\"pp-career-pct-val\">{value}</span>\n"
        "        </td>\n"
        "      )\n"
        "    }\n"
        "    return (\n"
        "      <td className=\"pp-career-pct-cell\">\n"
        "        <div className=\"pp-career-pct-stack\">\n"
        "          <span className=\"pp-career-pct-val\">{value}</span>\n"
        "          {sub != null && <span className=\"pp-career-pct-sub\" style={{ color }}>{sub}</span>}\n"
        "        </div>\n"
        "      </td>\n"
        "    )\n"
        "  }"
    )
    jsx = apply_or_die(jsx, OLD_COLOR, NEW_COLOR, "rewrite color scale + PctCell (heatmap-aware, subText support)")

    OLD_TOGGLE = (
        "                <div className=\"pp-career-toggle\">\n"
        "                  <button className={careerViewMode==='total'?'pp-toggle-btn pp-toggle-btn--active':'pp-toggle-btn'} onClick={()=>setCareerViewMode('total')}>Total</button>\n"
        "                  <button className={careerViewMode==='perGame'?'pp-toggle-btn pp-toggle-btn--active':'pp-toggle-btn'} onClick={()=>setCareerViewMode('perGame')}>Per Game</button>\n"
        "                </div>"
    )
    NEW_TOGGLE = (
        "                <div className=\"pp-career-toggle\">\n"
        "                  <button className={careerViewMode==='total'?'pp-toggle-btn pp-toggle-btn--active':'pp-toggle-btn'} onClick={()=>setCareerViewMode('total')}>Total</button>\n"
        "                  <button className={careerViewMode==='perGame'?'pp-toggle-btn pp-toggle-btn--active':'pp-toggle-btn'} onClick={()=>setCareerViewMode('perGame')}>Per Game</button>\n"
        "                  <span className=\"pp-toggle-sep\"/>\n"
        "                  <button className={heatmapMode?'pp-toggle-btn pp-toggle-btn--active':'pp-toggle-btn'} onClick={()=>setHeatmapMode(m=>!m)}>Heatmap</button>\n"
        "                </div>"
    )
    jsx = apply_or_die(jsx, OLD_TOGGLE, NEW_TOGGLE, "add Heatmap toggle button")

    OLD_PTS_CELLS = (
        "                        <td className=\"pp-career-year\">{s.season}</td>\n"
        "                        <td>{s.games}</td>\n"
        "                        <td style={{color:accentColor,fontWeight:700}}>{fmt(calcFantasyPts(s,pos),1)}</td>\n"
        "                        <td>{s.games?fmt(calcFantasyPts(s,pos)/s.games,1):'\u2014'}</td>\n"
    )
    NEW_PTS_CELLS = (
        "                        <td className=\"pp-career-year\">{s.season}</td>\n"
        "                        <td>{s.games}</td>\n"
        "                        <PctCell value={fmt(calcFantasyPts(s,pos),1)}\n"
        "                          percentile={careerViewMode==='perGame' ? ranks?.fpts_pg_percentile : ranks?.fpts_total_percentile}\n"
        "                          subText={(() => { const r = careerViewMode==='perGame' ? ranks?.fpts_pg : ranks?.fpts_total; return r!=null ? `${pos}${r}` : null })()}/>\n"
        "                        <PctCell value={s.games?fmt(calcFantasyPts(s,pos)/s.games,1):'\u2014'}\n"
        "                          percentile={ranks?.fpts_pg_percentile}\n"
        "                          subText={ranks?.fpts_pg!=null ? `${pos}${ranks.fpts_pg}` : null}/>\n"
    )
    jsx = apply_or_die(jsx, OLD_PTS_CELLS, NEW_PTS_CELLS, "PTS/PTS-G get POS-rank sub-labels")

    PLAYER_PAGE.write_text(jsx, encoding="utf-8")

    css = PLAYER_CSS.read_text(encoding="utf-8")
    APPEND_CSS = (
        "\n\n/* ---- Career table: heatmap rework ---- */\n"
        ".pp-career-table th, .pp-career-table td { text-align: center; }\n"
        ".pp-career-table .pp-career-year { text-align: left; font-weight: 800; }\n"
        ".pp-toggle-sep { width: 1px; background: var(--border); margin: 2px 4px; }\n"
        ".pp-career-pct-stack { display: flex; flex-direction: column; align-items: center; gap: 1px; }\n"
        ".pp-career-pct-sub { font-family: var(--font-ui); font-size: 10px; font-weight: 800; }\n"
        ".pp-career-pct-cell--heatmap { border-radius: 4px; }\n"
        ".pp-career-pct-cell--heatmap .pp-career-pct-val { color: #1a1a2e; font-weight: 700; }\n"
    )
    css = css + APPEND_CSS
    PLAYER_CSS.write_text(css, encoding="utf-8")
    print("OK -- appended heatmap CSS")

    print("\nAll patches applied. Next: npm run build")

if __name__ == "__main__":
    main()
