#!/usr/bin/env python3
"""
Patch — Wire logging for sb_budget trade legs (frontend half)
AssetRow currently only branches on isPick vs "assume it's a player" — an
sb_budget row would fall into the player branch and show "Unknown" instead
of a clear "SB Budget" label. The SB column already correctly shows the
amount via the existing sign_bonus logic, no change needed there.

Run from ~/Downloads/sickos-v2
    python3 patch_sb_budget_wire_render.py
"""
import sys
from pathlib import Path

TXN_PAGE = Path.cwd() / "src" / "pages" / "TransactionsPage.jsx"

OLD = """function AssetRow({ txn, asset, isSubRow = false }) {
  const meta = TYPE_META[txn.type] || { label: txn.type, color: 'var(--text-muted)' }
  const isPick = asset.asset_type === 'pick'
  const yearCells = isPick ? [] : toYearCells(asset.contract_years)
  const total = isPick ? null : contractTotal(asset.contract_years)"""
NEW = """function AssetRow({ txn, asset, isSubRow = false }) {
  const meta = TYPE_META[txn.type] || { label: txn.type, color: 'var(--text-muted)' }
  const isPick = asset.asset_type === 'pick'
  const isSb   = asset.asset_type === 'sb_budget'
  const yearCells = (isPick || isSb) ? [] : toYearCells(asset.contract_years)
  const total = (isPick || isSb) ? null : contractTotal(asset.contract_years)"""

OLD2 = """      <td className="wire-td-player">
        {isPick ? (
          <span className="wire-pick">{asset.pick_year} Rd {asset.pick_round} Pick</span>
        ) : asset.player ? (
          <PlayerLink playerId={asset.player.sleeper_id} className="wire-player-link">
            {asset.player.full_name || asset.player.sleeper_id}
          </PlayerLink>
        ) : (
          <span className="wire-player-unlinked">Unknown</span>
        )}
      </td>
      <td className="wire-td-pos">{!isPick && asset.player?.position ? asset.player.position : '—'}</td>
      <td className="wire-td-total">{isPick ? '—' : fmtMoney(total)}</td>
      <td className="wire-td-years">{isPick ? '—' : (yearCells.length || '—')}</td>"""
NEW2 = """      <td className="wire-td-player">
        {isPick ? (
          <span className="wire-pick">{asset.pick_year} Rd {asset.pick_round} Pick</span>
        ) : isSb ? (
          <span className="wire-sb-budget">SB Budget</span>
        ) : asset.player ? (
          <PlayerLink playerId={asset.player.sleeper_id} className="wire-player-link">
            {asset.player.full_name || asset.player.sleeper_id}
          </PlayerLink>
        ) : (
          <span className="wire-player-unlinked">Unknown</span>
        )}
      </td>
      <td className="wire-td-pos">{!isPick && !isSb && asset.player?.position ? asset.player.position : '—'}</td>
      <td className="wire-td-total">{(isPick || isSb) ? '—' : fmtMoney(total)}</td>
      <td className="wire-td-years">{(isPick || isSb) ? '—' : (yearCells.length || '—')}</td>"""


def main():
    text = TXN_PAGE.read_text()

    count = text.count(OLD)
    if count != 1:
        print(f"FAILED — expected exactly 1 match for [signature block], found {count}.")
        sys.exit(1)
    text = text.replace(OLD, NEW, 1)

    count2 = text.count(OLD2)
    if count2 != 1:
        print(f"FAILED — expected exactly 1 match for [render block], found {count2}.")
        sys.exit(1)
    text = text.replace(OLD2, NEW2, 1)

    TXN_PAGE.write_text(text)
    print("OK — patched AssetRow to render sb_budget legs properly")
    print("Next: npm run build")


if __name__ == "__main__":
    main()
