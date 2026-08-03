#!/usr/bin/env python3
"""
Patches src/pages/FABidPage.jsx: adds a release-method selector
(straight/frontload/stretch) that appears when a manager specifies a
conditional drop player, and includes it in the bid submission payload.

Run from the sickos-v2 directory:
    python3 patch_fabid_release_method.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/FABidPage.jsx")

OLD_STATE = """  const [dropPlayer, setDropPlayer] = useState('')
  const [dropName,   setDropName]   = useState('')"""

NEW_STATE = """  const [dropPlayer, setDropPlayer] = useState('')
  const [dropName,   setDropName]   = useState('')
  const [dropReleaseMethod, setDropReleaseMethod] = useState('straight')"""

OLD_SELECT = """            <option value="">— None —</option>
            {roster.map(r => {
              const sid  = r.players?.sleeper_id || r.sleeper_id
              const name = r.players?.full_name  || r.full_name || sid
              return <option key={sid} value={sid}>{name}</option>
            })}
          </select>
        </div>"""

NEW_SELECT = """            <option value="">— None —</option>
            {roster.map(r => {
              const sid  = r.players?.sleeper_id || r.sleeper_id
              const name = r.players?.full_name  || r.full_name || sid
              return <option key={sid} value={sid}>{name}</option>
            })}
          </select>
        </div>

        {dropPlayer && (
          <div className="fab-field">
            <label className="fab-label">Release method for {dropName}</label>
            <select
              className="fab-select"
              value={dropReleaseMethod}
              onChange={e => setDropReleaseMethod(e.target.value)}
            >
              <option value="straight">Straight — dead cap mirrors original guaranteed schedule</option>
              <option value="frontload">Frontload — all guaranteed money hits this season</option>
              <option value="stretch">Stretch — spread evenly across (guaranteed years × 2) + 1 seasons</option>
            </select>
          </div>
        )}"""

OLD_PAYLOAD = """        drop_player:   dropPlayer || null,
        drop_name:     dropName   || null,"""

NEW_PAYLOAD = """        drop_player:   dropPlayer || null,
        drop_name:     dropName   || null,
        drop_release_method: dropPlayer ? dropReleaseMethod : null,"""


def apply(text, old, new, label):
    count = text.count(old)
    if count == 0:
        print(f"ERROR: Could not find block for step '{label}'. No changes made.")
        sys.exit(1)
    if count > 1:
        print(f"ERROR: Block for step '{label}' appears {count} times, expected 1. Aborting.")
        sys.exit(1)
    return text.replace(old, new, 1)


def main():
    if not TARGET.exists():
        print(f"ERROR: {TARGET} not found. Run this from the sickos-v2 directory.")
        sys.exit(1)

    text = TARGET.read_text()
    text = apply(text, OLD_STATE, NEW_STATE, "add dropReleaseMethod state")
    text = apply(text, OLD_SELECT, NEW_SELECT, "add release-method selector UI")
    text = apply(text, OLD_PAYLOAD, NEW_PAYLOAD, "include drop_release_method in submission payload")

    TARGET.write_text(text)
    print("✓ Patched src/pages/FABidPage.jsx — release-method selector added for conditional drops.")


if __name__ == "__main__":
    main()
