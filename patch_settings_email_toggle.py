#!/usr/bin/env python3
"""
Patch — Email notifications v1, frontend (Settings page toggle)
New "Email Notifications" card on the Team Settings page — a checkbox opt-in
for trade-offer emails, saved via the new self-service /admin/managers/me
endpoint.

Run from ~/Downloads/sickos-v2
    python3 patch_settings_email_toggle.py
"""
import sys
from pathlib import Path

SETTINGS_PAGE = Path.cwd() / "src" / "pages" / "SettingsPage.jsx"
SETTINGS_CSS  = Path.cwd() / "src" / "pages" / "SettingsPage.css"

STATE_OLD = "  const [pwSaving,  setPwSaving]  = useState(false)\n  const [pwMsg,     setPwMsg]     = useState(null)"
STATE_NEW = """  const [pwSaving,  setPwSaving]  = useState(false)
  const [pwMsg,     setPwMsg]     = useState(null)

  // ── Email notifications ──────────────────────────────────────────────────
  const [emailEnabled, setEmailEnabled] = useState(!!manager?.email_notifications_enabled)
  const [emailSaving,  setEmailSaving]  = useState(false)
  const [emailMsg,     setEmailMsg]     = useState(null)

  async function saveEmailPref() {
    setEmailSaving(true); setEmailMsg(null)
    const r = await fetch(`${API}/admin/managers/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-team-abbrev': abbrev },
      body: JSON.stringify({ email_notifications_enabled: emailEnabled }),
    })
    const d = await r.json()
    setEmailSaving(false)
    setEmailMsg(r.ok
      ? { type:'ok', text:'Preference saved!' }
      : { type:'err', text: d.error || 'Failed to save preference' })
  }"""

RENDER_OLD = """        {/* ── Password ── */}
        <div className="settings-card">
          <div className="settings-card-title">Change Password</div>"""
RENDER_NEW = """        {/* ── Email Notifications ── */}
        <div className="settings-card">
          <div className="settings-card-title">Email Notifications</div>
          <div className="settings-card-desc">
            Get emailed when you receive a trade offer, in addition to the in-app inbox notification.
            More notification types coming soon.
          </div>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={e => setEmailEnabled(e.target.checked)}
            />
            <span>Email me about trade offers</span>
          </label>
          <div className="settings-actions">
            <button className="settings-btn settings-btn--primary" onClick={saveEmailPref} disabled={emailSaving}>
              {emailSaving ? 'Saving…' : 'Save Preference'}
            </button>
          </div>
          {emailMsg && <div className={`settings-msg settings-msg--${emailMsg.type}`}>{emailMsg.text}</div>}
        </div>

        {/* ── Password ── */}
        <div className="settings-card">
          <div className="settings-card-title">Change Password</div>"""


def main():
    text = SETTINGS_PAGE.read_text()

    if text.count(STATE_OLD) != 1:
        print(f"FAILED — expected 1 match for state anchor, found {text.count(STATE_OLD)}")
        sys.exit(1)
    text = text.replace(STATE_OLD, STATE_NEW, 1)

    if text.count(RENDER_OLD) != 1:
        print(f"FAILED — expected 1 match for render anchor, found {text.count(RENDER_OLD)}")
        sys.exit(1)
    text = text.replace(RENDER_OLD, RENDER_NEW, 1)

    SETTINGS_PAGE.write_text(text)
    print("OK — patched SettingsPage.jsx")

    css = SETTINGS_CSS.read_text()
    if ".settings-checkbox-row" not in css:
        css = css.rstrip() + "\n\n.settings-checkbox-row { display: flex; align-items: center; gap: 8px; margin: 10px 0; font-family: var(--font-ui); font-size: 13px; color: var(--text-primary); cursor: pointer; }\n.settings-checkbox-row input { width: 16px; height: 16px; cursor: pointer; }\n"
        SETTINGS_CSS.write_text(css)
        print("OK — appended checkbox CSS")
    else:
        print("SKIPPED — checkbox CSS already present")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
