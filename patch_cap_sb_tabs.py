#!/usr/bin/env python3
"""
Patch — Cap Sheet + Signing Bonus as real in-page tabs
1. "Cap Sheet" button becomes a real tab (was a navigate()-away link) so
   people can toggle between it and other team info without leaving the page.
2. New "Signing Bonus" tab, positioned between Cap Sheet and Injuries.

Run from ~/Downloads/sickos-v2
    python3 patch_cap_sb_tabs.py
"""
import sys
from pathlib import Path

TEAM_PAGE = Path.cwd() / "src" / "pages" / "TeamPage.jsx"


def apply_patch(old, new, label):
    text = TEAM_PAGE.read_text()
    count = text.count(old)
    if count != 1:
        print(f"FAILED — expected exactly 1 match for [{label}], found {count}.")
        sys.exit(1)
    TEAM_PAGE.write_text(text.replace(old, new, 1))
    print(f"OK — patched [{label}]")


IMPORT_OLD = "import PlayerLink from '../components/PlayerCard/PlayerLink'"
IMPORT_NEW = """import PlayerLink from '../components/PlayerCard/PlayerLink'
import CapSheetPage from './CapSheetPage'
import SBTab from './SBTab'"""

TABS_OLD = """          <button className="tp-tab" onClick={() => navigate(`/team/${abbrev}/cap`)}>Cap Sheet</button>
          <button className={`tp-tab ${activeTab==='injuries'?'tp-tab--active':''}`} onClick={() => setActiveTab('injuries')}>"""
TABS_NEW = """          <button className={`tp-tab ${activeTab==='cap'?'tp-tab--active':''}`} onClick={() => setActiveTab('cap')}>Cap Sheet</button>
          <button className={`tp-tab ${activeTab==='signingbonus'?'tp-tab--active':''}`} onClick={() => setActiveTab('signingbonus')}>Signing Bonus</button>
          <button className={`tp-tab ${activeTab==='injuries'?'tp-tab--active':''}`} onClick={() => setActiveTab('injuries')}>"""

CONTENT_OLD = """      <div className="tp-content">

        {activeTab === 'roster' && ("""
CONTENT_NEW = """      <div className="tp-content">

        {activeTab === 'cap' && <CapSheetPage />}

        {activeTab === 'signingbonus' && <SBTab abbrev={abbrev} />}

        {activeTab === 'roster' && ("""


def main():
    apply_patch(IMPORT_OLD, IMPORT_NEW, "import CapSheetPage + SBTab")
    apply_patch(TABS_OLD, TABS_NEW, "Cap Sheet -> real tab, add Signing Bonus tab")
    apply_patch(CONTENT_OLD, CONTENT_NEW, "render CapSheetPage + SBTab content")
    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
