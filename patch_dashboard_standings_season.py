#!/usr/bin/env python3
"""
Patches src/pages/DashboardPage.jsx: the StandingsWidget's underlying fetch
was hardcoded to CURRENT_SEASON always, same bug as StandingsPage.jsx.
Fixes it to follow season_mode (offseason -> last year's final standings,
regular season -> current year's live standings).

Run from the sickos-v2 directory:
    python3 patch_dashboard_standings_season.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/DashboardPage.jsx")

OLD_BLOCK = """  // Standings widget state
  const [standings,      setStandings]      = useState([])
  const [standingsView,  setStandingsView]  = useState('division')
  const [standingsLoaded,setStandingsLoaded]= useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/standings?season=${CURRENT_SEASON}`)
      .then(r => r.ok ? r.json() : { standings: [] })
      .then(d => { setStandings(d.standings || []); setStandingsLoaded(true) })
      .catch(() => setStandingsLoaded(true))
  }, [])"""

NEW_BLOCK = """  // Standings widget state -- season follows season_mode (offseason shows
  // last year's final standings since this year has no games yet; regular
  // season shows this year's live standings). Was previously hardcoded to
  // CURRENT_SEASON always.
  const [standings,      setStandings]      = useState([])
  const [standingsView,  setStandingsView]  = useState('division')
  const [standingsLoaded,setStandingsLoaded]= useState(false)
  const [standingsSeason,setStandingsSeason]= useState(CURRENT_SEASON)

  useEffect(() => {
    fetch(`${API_BASE}/system/season-mode`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.season_mode === 'offseason') setStandingsSeason(CURRENT_SEASON - 1)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/standings?season=${standingsSeason}`)
      .then(r => r.ok ? r.json() : { standings: [] })
      .then(d => { setStandings(d.standings || []); setStandingsLoaded(true) })
      .catch(() => setStandingsLoaded(true))
  }, [standingsSeason])"""


def main():
    if not TARGET.exists():
        print(f"ERROR: {TARGET} not found. Run this from the sickos-v2 directory.")
        sys.exit(1)

    text = TARGET.read_text()
    count = text.count(OLD_BLOCK)

    if count == 0:
        print("ERROR: Could not find the exact block to replace. No changes made.")
        sys.exit(1)
    if count > 1:
        print(f"ERROR: Found {count} matches, expected exactly 1. Aborting.")
        sys.exit(1)

    new_text = text.replace(OLD_BLOCK, NEW_BLOCK, 1)
    TARGET.write_text(new_text)
    print("✓ Patched src/pages/DashboardPage.jsx — StandingsWidget season now follows season_mode.")


if __name__ == "__main__":
    main()
