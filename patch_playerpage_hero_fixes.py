#!/usr/bin/env python3
"""
Patch -- PlayerPage hero bar fixes
1. Contrast fix: wraps the bio text block with the already-computed
   teamColor.text (luminance-based -- exists in useTeamColors but was never
   applied), converts the relevant CSS from hardcoded white to
   color:inherit + opacity so it correctly follows whatever text color gets
   applied, and fixes the watchlist button the same way.
2. Removes the jersey number line entirely.
3. Removes the two vertical rank bars (pp-ranks) that visually conflict
   with the fantasy team logo.

Run from ~/Downloads/sickos-v2
    python3 patch_playerpage_hero_fixes.py
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

    OLD_BIO_OPEN = '            <div className="pp-bio">'
    NEW_BIO_OPEN = "            <div className=\"pp-bio\" style={{ color: teamColor?.text || '#fff' }}>"
    jsx = apply_or_die(jsx, OLD_BIO_OPEN, NEW_BIO_OPEN, "wrap bio block with computed text color")

    OLD_JERSEY = (
        '              <div className="pp-meta-row">\n'
        "                <span className=\"pp-nfl-team\">{nflTeam || 'FA'}</span>\n"
        '                <span className="pp-dot">\u00b7</span>\n'
        "                <span className=\"pp-detail\">#{player.number || '\u2014'}</span>\n"
        '              </div>'
    )
    NEW_JERSEY = (
        '              <div className="pp-meta-row">\n'
        "                <span className=\"pp-nfl-team\">{nflTeam || 'FA'}</span>\n"
        '              </div>'
    )
    jsx = apply_or_die(jsx, OLD_JERSEY, NEW_JERSEY, "remove jersey number")

    OLD_RANKS = (
        '          <div className="pp-ranks">\n'
        "            <VertBar value={games > 0 ? `#${posRank}` : '\u2014'} label=\"POS RANK\"\n"
        '              pct={games > 0 ? Math.max(0, 100 - (posRank / 80) * 100) : 0} color={accentColor}/>\n'
        "            <VertBar value={games > 0 ? ptsPerG.toFixed(1) : '\u2014'} label=\"PTS/GAME\"\n"
        '              pct={games > 0 ? Math.min(100, (ptsPerG / 40) * 100) : 0} color="#3a9fd4"/>\n'
        '          </div>\n'
    )
    NEW_RANKS = ''
    jsx = apply_or_die(jsx, OLD_RANKS, NEW_RANKS, "remove vertical rank bars")

    OLD_WATCHLIST_1 = (
        "                      <button className={`pp-watchlist-btn-sm ${onWatchlist ? 'pp-watchlist-btn-sm--active' : ''}`}\n"
        '                        onClick={toggleWatchlist} disabled={watchlistLoading}>\n'
        "                        {watchlistLoading ? '\u2026' : onWatchlist ? '\u2605 Watchlist' : '\u2606 Watch'}\n"
        '                      </button>\n'
        '                    )}\n'
        '                    {!isMyPlayer && ('
    )
    NEW_WATCHLIST_1 = (
        "                      <button className={`pp-watchlist-btn-sm ${onWatchlist ? 'pp-watchlist-btn-sm--active' : ''}`}\n"
        '                        style={!onWatchlist && teamColor ? { color: teamColor.text, borderColor: `${teamColor.text}33` } : {}}\n'
        '                        onClick={toggleWatchlist} disabled={watchlistLoading}>\n'
        "                        {watchlistLoading ? '\u2026' : onWatchlist ? '\u2605 Watchlist' : '\u2606 Watch'}\n"
        '                      </button>\n'
        '                    )}\n'
        '                    {!isMyPlayer && ('
    )
    jsx = apply_or_die(jsx, OLD_WATCHLIST_1, NEW_WATCHLIST_1, "watchlist button dynamic color (contract branch)")

    PLAYER_PAGE.write_text(jsx, encoding="utf-8")

    css = PLAYER_CSS.read_text(encoding="utf-8")

    OLD_NAME = (
        '.pp-name {\n'
        '  font-family: var(--font-display); font-size: 40px; font-weight: 900;\n'
        '  letter-spacing: 0.02em; text-transform: uppercase; color: #fff; line-height: 1;\n'
        '}\n'
        '.pp-meta-row { display: flex; align-items: center; gap: 8px; font-family: var(--font-ui); font-size: 13px; color: rgba(255,255,255,0.65); }\n'
        '.pp-nfl-team { font-weight: 700; color: rgba(255,255,255,0.85); letter-spacing: 0.06em; }\n'
        '.pp-dot { opacity: 0.35; }\n'
        '.pp-detail { color: rgba(255,255,255,0.55); }'
    )
    NEW_NAME = (
        '.pp-name {\n'
        '  font-family: var(--font-display); font-size: 40px; font-weight: 900;\n'
        '  letter-spacing: 0.02em; text-transform: uppercase; color: inherit; line-height: 1;\n'
        '}\n'
        '.pp-meta-row { display: flex; align-items: center; gap: 8px; font-family: var(--font-ui); font-size: 13px; color: inherit; opacity: 0.75; }\n'
        '.pp-nfl-team { font-weight: 700; color: inherit; opacity: 1; letter-spacing: 0.06em; }\n'
        '.pp-dot { opacity: 0.5; }\n'
        '.pp-detail { color: inherit; opacity: 0.7; }'
    )
    css = apply_or_die(css, OLD_NAME, NEW_NAME, "CSS: name/meta-row/nfl-team/detail -> inherit+opacity")

    PLAYER_CSS.write_text(css, encoding="utf-8")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
