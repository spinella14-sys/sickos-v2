#!/usr/bin/env python3
"""
Patches src/pages/StandingsPage.jsx: the season shown was hardcoded to
CURRENT_SEASON always, despite the original design (offseason -> show last
year's final standings, regular season -> show current year's live
standings, switching automatically when season_mode flips). Adds a fetch
of GET /api/system/season-mode on mount to set the correct season.

Run from the sickos-v2 directory:
    python3 patch_standings_season_mode.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/StandingsPage.jsx")

OLD_BLOCK = """  const [season,      setSeason]      = useState(CURRENT_SEASON)
  const [view,        setView]        = useState('league')  // 'league' | 'division'
  const [standings,   setStandings]   = useState([])
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [odds,        setOdds]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [oddsLoading, setOddsLoading] = useState(true)

  useEffect(() => {"""

NEW_BLOCK = """  const [season,      setSeason]      = useState(CURRENT_SEASON)
  const [view,        setView]        = useState('league')  // 'league' | 'division'
  const [standings,   setStandings]   = useState([])
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [odds,        setOdds]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [oddsLoading, setOddsLoading] = useState(true)

  // During offseason, show last year's FINAL standings (this year has no
  // games yet); once season_mode flips to regular_season, switch to this
  // year's live standings. This was the original design but was never
  // actually wired -- season stayed hardcoded to CURRENT_SEASON always.
  useEffect(() => {
    fetch(`${API_BASE}/system/season-mode`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.season_mode === 'offseason') setSeason(CURRENT_SEASON - 1)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {"""


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
    print("✓ Patched src/pages/StandingsPage.jsx — season now follows season_mode (offseason = last year, regular season = current year).")


if __name__ == "__main__":
    main()
