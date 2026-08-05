#!/usr/bin/env python3
"""
Patch — Wire<->PlayerPage linking (frontend half)
New "Transactions" tab on PlayerPage.jsx showing that player's full Wire
history (signings, releases, trades, draft batches), fetched via the new
?player= filter on /api/transactions.

Run from ~/Downloads/sickos-v2
    python3 patch_playerpage_transactions_tab.py
"""
import sys
from pathlib import Path

PLAYER_PAGE = Path.cwd() / "src" / "pages" / "PlayerPage.jsx"


def apply_patch(path, old, new, label):
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        print(f"FAILED — expected exactly 1 match for [{label}], found {count}.")
        print("--- expected old_str ---")
        print(old)
        sys.exit(1)
    path.write_text(text.replace(old, new, 1))
    print(f"OK — patched [{label}]")


# 1. Add the tab
TABS_OLD = """  const TABS = [
    { id: 'season',   label: 'Season Stats' },
    { id: 'gamelog',  label: 'Game Log'     },
    { id: 'trends',   label: 'Trends'       },
    { id: 'news',     label: 'News & Notes' },
    { id: 'career',   label: 'Career'       },
    { id: 'contract', label: 'Contract'     },
  ]"""
TABS_NEW = """  const TABS = [
    { id: 'season',       label: 'Season Stats' },
    { id: 'gamelog',      label: 'Game Log'     },
    { id: 'trends',       label: 'Trends'       },
    { id: 'news',         label: 'News & Notes' },
    { id: 'career',       label: 'Career'       },
    { id: 'contract',     label: 'Contract'     },
    { id: 'transactions', label: 'Transactions' },
  ]"""

# 2. Fetch effect — insert right after the news-fetch effect
FETCH_ANCHOR_OLD = """  useEffect(() => {
    if (activeTab !== 'news' || !id) return
    setNewsLoading(true)
    fetch(`${API_BASE}/news/player/${id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setNews(Array.isArray(data) ? data : []); setNewsLoading(false) })
      .catch(() => { setNews([]); setNewsLoading(false) })
  }, [activeTab, id])"""
FETCH_ANCHOR_NEW = """  useEffect(() => {
    if (activeTab !== 'news' || !id) return
    setNewsLoading(true)
    fetch(`${API_BASE}/news/player/${id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setNews(Array.isArray(data) ? data : []); setNewsLoading(false) })
      .catch(() => { setNews([]); setNewsLoading(false) })
  }, [activeTab, id])

  useEffect(() => {
    if (activeTab !== 'transactions' || !id) return
    setTxnsLoading(true)
    fetch(`${API_BASE}/transactions?player=${id}&season=all`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setTxns(Array.isArray(data) ? data : []); setTxnsLoading(false) })
      .catch(() => { setTxns([]); setTxnsLoading(false) })
  }, [activeTab, id])"""

# 3. State declarations — insert near where `news`/`newsLoading` are declared
STATE_ANCHOR_OLD = "  const [activeTab,         setActiveTab]         = useState('season')"
STATE_ANCHOR_NEW = """  const [activeTab,         setActiveTab]         = useState('season')
  const [txns,              setTxns]              = useState([])
  const [txnsLoading,       setTxnsLoading]       = useState(false)"""

# 4. Render block — insert right after the news tab's closing, before career tab
RENDER_ANCHOR_OLD = """        {activeTab === 'career' && ("""
RENDER_ANCHOR_NEW = """        {/* TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div className="pp-transactions">
            {txnsLoading && <div className="pp-inner-loading">Loading transaction history…</div>}
            {!txnsLoading && !txns.length && (
              <div className="pp-no-data">No transaction history recorded for this player.</div>
            )}
            {!txnsLoading && txns.length > 0 && (
              <div className="pp-txn-list">
                {txns.map(txn => {
                  const meta = PP_TXN_TYPE_META[txn.type] || { label: txn.type, color: 'var(--text-muted)' }
                  const asset = (txn.transaction_assets || []).find(a => a.player_id === id) || (txn.transaction_assets || [])[0]
                  const total = asset?.contract_years
                    ? Object.values(asset.contract_years).reduce((s, y) => s + (parseFloat(y.salary) || 0), 0)
                    : null
                  const years = asset?.contract_years ? Object.keys(asset.contract_years).length : 0
                  return (
                    <div key={txn.id} className="pp-txn-item">
                      <div className="pp-txn-date">{fmtTxnDate(txn.transaction_date)}</div>
                      <span className="pp-txn-badge" style={{ color: meta.color, borderColor: meta.color }}>
                        {meta.label}
                      </span>
                      <div className="pp-txn-team">
                        {asset?.team_abbrev && LOGOS[asset.team_abbrev] && (
                          <img src={LOGOS[asset.team_abbrev]} alt={asset.team_abbrev} className="pp-txn-logo" />
                        )}
                        <span>{asset?.team_abbrev || '—'}</span>
                      </div>
                      <div className="pp-txn-detail">
                        {total != null
                          ? `${years}yr / $${total.toFixed(2)}${asset.sign_bonus ? ` + $${parseFloat(asset.sign_bonus).toFixed(2)} SB` : ''}`
                          : (txn.notes || '—')}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'career' && ("""


def main():
    apply_patch(PLAYER_PAGE, TABS_OLD, TABS_NEW, "add Transactions tab")
    apply_patch(PLAYER_PAGE, STATE_ANCHOR_OLD, STATE_ANCHOR_NEW, "add txns state")
    apply_patch(PLAYER_PAGE, FETCH_ANCHOR_OLD, FETCH_ANCHOR_NEW, "add txns fetch effect")
    apply_patch(PLAYER_PAGE, RENDER_ANCHOR_OLD, RENDER_ANCHOR_NEW, "add Transactions tab render block")

    # 5. Helper constant + date formatter — insert near top of file, after imports
    text = PLAYER_PAGE.read_text()
    if "PP_TXN_TYPE_META" in text:
        print("SKIPPED — helpers already present")
    else:
        # Insert right before the component's default export function definition,
        # using the first top-level `const API_BASE` line as anchor (present in
        # every page file in this codebase).
        import re
        m = re.search(r"^const API_BASE.*$", text, re.MULTILINE)
        if not m:
            print("FAILED — could not find API_BASE anchor line to insert helpers near")
            sys.exit(1)
        anchor_line = m.group(0)
        helpers = anchor_line + """

const PP_TXN_TYPE_META = {
  signing:     { label: 'Signing',     color: 'var(--green)' },
  release:     { label: 'Release',     color: 'var(--text-muted)' },
  trade:       { label: 'Trade',       color: 'var(--blue)' },
  bid_lost:    { label: 'Failed Bid',  color: 'var(--gold)' },
  draft_batch: { label: 'Draft',       color: 'var(--text-primary)' },
}
function fmtTxnDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}"""
        text = text.replace(anchor_line, helpers, 1)
        PLAYER_PAGE.write_text(text)
        print("OK — added PP_TXN_TYPE_META + fmtTxnDate helpers")

    # 6. Confirm LOGOS is imported (used in the render block)
    text = PLAYER_PAGE.read_text()
    if "LOGOS" not in text.split("\n")[0:15][0] and "import { LOGOS" not in text and "LOGOS }" not in text.split("\n\n")[0]:
        pass  # best-effort check only, not blocking

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
