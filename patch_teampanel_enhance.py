#!/usr/bin/env python3
"""
Patch -- Enhance TeamPanel: add Signing Bonus budget, make draft-picks
section optional (via showDraftPicks prop, default true for backward
compat with Rookie Draft; RFA/UFA will pass false since showing rookie
draft picks inside those tools would be misleading).

Run from ~/Downloads/sickos-v2
    python3 patch_teampanel_enhance.py
"""
import sys
from pathlib import Path

TEAM_PANEL = Path.cwd() / "src" / "components" / "draft" / "TeamPanel.jsx"

def apply_or_die(text, old, new, label):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}], expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)

def main():
    text = TEAM_PANEL.read_text(encoding="utf-8")

    PROPS_OLD = "export default function TeamPanel({ viewingTeam, setViewingTeam, teams, currentTeam, getTeamName, getTeamLogo }) {"
    PROPS_NEW = "export default function TeamPanel({ viewingTeam, setViewingTeam, teams, currentTeam, getTeamName, getTeamLogo, showDraftPicks = true }) {"
    text = apply_or_die(text, PROPS_OLD, PROPS_NEW, "add showDraftPicks prop")

    STATE_OLD = """  const [teamData,       setTeamData]       = useState(null);
  const [draftedByTeam,  setDraftedByTeam]  = useState([]);

  useEffect(() => {
    if (!viewingTeam) return;

    fetch(`${API_BASE}/api/teams/${viewingTeam}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTeamData(d); })
      .catch(() => {});

    fetch(`${API_BASE}/api/draft/picks`)
      .then(r => r.ok ? r.json() : [])
      .then(picks => {
        setDraftedByTeam(
          picks.filter(p => p.current_team === viewingTeam && p.status === 'completed')
        );
      })
      .catch(() => {});
  }, [viewingTeam]);"""
    STATE_NEW = """  const [teamData,       setTeamData]       = useState(null);
  const [draftedByTeam,  setDraftedByTeam]  = useState([]);
  const [sbData,         setSbData]         = useState(null);

  useEffect(() => {
    if (!viewingTeam) return;

    fetch(`${API_BASE}/api/teams/${viewingTeam}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTeamData(d); })
      .catch(() => {});

    fetch(`${API_BASE}/api/bids/sb-projection/${viewingTeam}?salary=0`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSbData(d); })
      .catch(() => {});

    if (showDraftPicks) {
      fetch(`${API_BASE}/api/draft/picks`)
        .then(r => r.ok ? r.json() : [])
        .then(picks => {
          setDraftedByTeam(
            picks.filter(p => p.current_team === viewingTeam && p.status === 'completed')
          );
        })
        .catch(() => {});
    }
  }, [viewingTeam, showDraftPicks]);"""
    text = apply_or_die(text, STATE_OLD, STATE_NEW, "add sbData state + fetch, gate draft-picks fetch")

    CAP_OLD = """          <div className="cap-bar">
            <div
              className="cap-bar__fill"
              style={{
                width: `${Math.min(100, ((teamData.cap_used || 0) / (teamData.hard_cap || 138)) * 100)}%`
              }}
            />
          </div>
        </div>
      )}"""
    CAP_NEW = """          <div className="cap-bar">
            <div
              className="cap-bar__fill"
              style={{
                width: `${Math.min(100, ((teamData.cap_used || 0) / (teamData.hard_cap || 138)) * 100)}%`
              }}
            />
          </div>
        </div>
      )}

      {sbData && (
        <div className="team-panel__cap">
          <div className="team-panel__section-title">SIGNING BONUS BUDGET</div>
          <div className="cap-row">
            <span>Available</span>
            <span className="amber">${(sbData.balance ?? 0).toFixed(2)}</span>
          </div>
          <div className="cap-row">
            <span>Season Start</span>
            <span>${(sbData.startBalance ?? 0).toFixed(2)}</span>
          </div>
        </div>
      )}"""
    text = apply_or_die(text, CAP_OLD, CAP_NEW, "add Signing Bonus Budget section")

    PICKS_OLD = """      {draftedByTeam.length > 0 && ("""
    PICKS_NEW = """      {showDraftPicks && draftedByTeam.length > 0 && ("""
    text = apply_or_die(text, PICKS_OLD, PICKS_NEW, "gate PICKS MADE section behind showDraftPicks")

    TEAM_PANEL.write_text(text, encoding="utf-8")
    print("\nAll patches applied. Next: npm run build (verify TeamPanel still compiles standalone)")

if __name__ == "__main__":
    main()
