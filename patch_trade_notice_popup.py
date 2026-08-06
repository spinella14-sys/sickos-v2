#!/usr/bin/env python3
"""
Patch — Trade-request in-app popup (frontend)
Mirrors the existing payment-notice popup exactly — same visual style, same
fixed-overlay pattern, same fetch-on-mount + acknowledge-on-dismiss flow.

Run from ~/Downloads/sickos-v2
    python3 patch_trade_notice_popup.py
"""
import sys
from pathlib import Path

DASHBOARD = Path.cwd() / "src" / "pages" / "DashboardPage.jsx"

STATE_OLD = """  // Buy-in payment notice — shows once when the admin marks this team paid
  const [paymentNotice, setPaymentNotice] = useState(false)
  useEffect(() => {
    if (!abbrev) return
    fetch(`${API_BASE}/payouts/${CURRENT_SEASON}/notice/${abbrev}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.show) setPaymentNotice(true) })
      .catch(() => {})
  }, [abbrev])

  const acknowledgePaymentNotice = () => {
    setPaymentNotice(false)
    fetch(`${API_BASE}/payouts/${CURRENT_SEASON}/notice/${abbrev}/acknowledge`, { method: 'POST' }).catch(() => {})
  }"""

STATE_NEW = """  // Buy-in payment notice — shows once when the admin marks this team paid
  const [paymentNotice, setPaymentNotice] = useState(false)
  useEffect(() => {
    if (!abbrev) return
    fetch(`${API_BASE}/payouts/${CURRENT_SEASON}/notice/${abbrev}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.show) setPaymentNotice(true) })
      .catch(() => {})
  }, [abbrev])

  const acknowledgePaymentNotice = () => {
    setPaymentNotice(false)
    fetch(`${API_BASE}/payouts/${CURRENT_SEASON}/notice/${abbrev}/acknowledge`, { method: 'POST' }).catch(() => {})
  }

  // Trade-request notice — shows once per pending, unacknowledged trade offer
  const [tradeNotice,      setTradeNotice]      = useState(false)
  const [tradeNoticeCount, setTradeNoticeCount] = useState(0)
  useEffect(() => {
    if (!abbrev) return
    fetch(`${API_BASE}/trades/notice/${abbrev}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.show) { setTradeNotice(true); setTradeNoticeCount(d.count || 0) } })
      .catch(() => {})
  }, [abbrev])

  const acknowledgeTradeNotice = () => {
    setTradeNotice(false)
    fetch(`${API_BASE}/trades/notice/${abbrev}/acknowledge`, { method: 'POST' }).catch(() => {})
  }"""

RENDER_OLD = """      {paymentNotice && ("""
RENDER_NEW = """      {tradeNotice && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
        }}>
          <div style={{
            background: '#14171c', borderRadius: 12, padding: 24,
            maxWidth: 420, width: '92%', border: '1px solid rgba(232,130,42,0.4)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔄</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {tradeNoticeCount > 1 ? `${tradeNoticeCount} New Trade Offers` : 'New Trade Offer'}
            </div>
            <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 20 }}>
              You have {tradeNoticeCount > 1 ? 'pending trade proposals' : 'a pending trade proposal'} waiting for your response. Review it from your inbox or the Trade page.
            </div>
            <button onClick={acknowledgeTradeNotice} style={{
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
              background: 'var(--draft-amber, #f0b429)', color: '#000', fontWeight: 700, cursor: 'pointer',
            }}>
              Got it
            </button>
          </div>
        </div>
      )}

      {paymentNotice && ("""


def main():
    text = DASHBOARD.read_text()

    if text.count(STATE_OLD) != 1:
        print(f"FAILED — expected 1 match for state anchor, found {text.count(STATE_OLD)}")
        sys.exit(1)
    text = text.replace(STATE_OLD, STATE_NEW, 1)

    if text.count(RENDER_OLD) != 1:
        print(f"FAILED — expected 1 match for render anchor, found {text.count(RENDER_OLD)}")
        sys.exit(1)
    text = text.replace(RENDER_OLD, RENDER_NEW, 1)

    DASHBOARD.write_text(text)
    print("OK — patched DashboardPage.jsx with trade-notice popup")
    print("Next: npm run build")


if __name__ == "__main__":
    main()
