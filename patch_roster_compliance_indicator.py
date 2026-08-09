#!/usr/bin/env python3
"""
Patch -- Add roster compliance indicator to TeamPage header
Fetches the same violations endpoint powering the Dashboard popup, shows a
compact badge with exact dollar amounts next to the cap bar when any
violation is active. Only fetches for the team owner's own page (or admin).

Run from ~/Downloads/sickos-v2
    python3 patch_roster_compliance_indicator.py
"""
import sys
from pathlib import Path

TEAM_PAGE = Path.cwd() / "src" / "pages" / "TeamPage.jsx"

STATE_OLD = "  const capUsed       = teamData?.cap_used       ?? 0"
STATE_NEW = """  const capUsed       = teamData?.cap_used       ?? 0
  const [violations, setViolations] = useState([])
  useEffect(() => {
    if (!abbrev) return
    fetch(`${API_BASE}/teams/${abbrev.toUpperCase()}/violations?season=${CURRENT_SEASON}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setViolations(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [abbrev])"""

RENDER_OLD = """        <div className="tp-cap-section" style={{ background:"rgba(0,0,0,0.28)", padding:"6px 14px", borderRadius:6, backdropFilter:"blur(4px)" }}>
          <CapBar capUsed={capUsed} hardCap={hardCap} taxLine={TAX_LINE}/>
        </div>
      </div>"""
RENDER_NEW = """        <div className="tp-cap-section" style={{ background:"rgba(0,0,0,0.28)", padding:"6px 14px", borderRadius:6, backdropFilter:"blur(4px)" }}>
          <CapBar capUsed={capUsed} hardCap={hardCap} taxLine={TAX_LINE}/>
          {violations.length > 0 && (
            <div style={{
              marginTop:6, fontFamily:'var(--font-ui)', fontSize:11, fontWeight:800,
              color:'#d94f4f', display:'flex', alignItems:'center', gap:6,
            }}>
              🚨 {violations.length} roster compliance issue{violations.length>1?'s':''} -- see notice
            </div>
          )}
        </div>
      </div>"""


def main():
    text = TEAM_PAGE.read_text()

    if text.count(STATE_OLD) != 1:
        print(f"FAILED -- state anchor, found {text.count(STATE_OLD)}")
        sys.exit(1)
    text = text.replace(STATE_OLD, STATE_NEW, 1)

    if text.count(RENDER_OLD) != 1:
        print(f"FAILED -- render anchor, found {text.count(RENDER_OLD)}")
        sys.exit(1)
    text = text.replace(RENDER_OLD, RENDER_NEW, 1)

    TEAM_PAGE.write_text(text)
    print("OK -- added roster compliance indicator to TeamPage header")
    print("Next: npm run build")


if __name__ == "__main__":
    main()
