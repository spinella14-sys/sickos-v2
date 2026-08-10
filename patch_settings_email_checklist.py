#!/usr/bin/env python3
"""
Patch -- Email notifications Phase 2, part 5: Settings checklist UI
Replaces the single trade-offer checkbox with a real checklist of
notification types. Two are live (trade_offer, roster_compliance, bid_results
-- three, actually), two are shown but marked "coming soon" since their
underlying features (payment reminders, calendar) don't exist yet.

Run from ~/Downloads/sickos-v2
    python3 patch_settings_email_checklist.py
"""
import sys
from pathlib import Path

SETTINGS = Path.cwd() / "src" / "pages" / "SettingsPage.jsx"

STATE_OLD = """  const [emailEnabled, setEmailEnabled] = useState(!!manager?.email_notifications_enabled)
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

STATE_NEW = """  const EMAIL_NOTIFICATION_TYPES = [
    { key: 'trade_offer',       label: 'Trade offers',            desc: 'When another team sends you a trade proposal.', available: true },
    { key: 'bid_results',       label: 'Bid results',              desc: 'When a free agent bid you placed is won or lost.', available: true },
    { key: 'roster_compliance', label: 'Roster compliance alerts', desc: 'Cap violations, IR-lock issues, and roster minimum warnings.', available: true },
    { key: 'payment_reminder',  label: 'Payment reminders',        desc: 'Coming soon.', available: false },
    { key: 'calendar',          label: 'Calendar notifications',   desc: 'Coming soon.', available: false },
  ]
  const [emailTypes,  setEmailTypes]  = useState(manager?.email_notification_types || [])
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg,    setEmailMsg]    = useState(null)

  function toggleEmailType(key) {
    setEmailTypes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  async function saveEmailPref() {
    setEmailSaving(true); setEmailMsg(null)
    const r = await fetch(`${API}/admin/managers/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-team-abbrev': abbrev },
      body: JSON.stringify({ email_notification_types: emailTypes }),
    })
    const d = await r.json()
    setEmailSaving(false)
    setEmailMsg(r.ok
      ? { type:'ok', text:'Preferences saved!' }
      : { type:'err', text: d.error || 'Failed to save preferences' })
  }"""

RENDER_OLD = """        {/* ── Email Notifications ── */}
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
              {emailSaving ? 'Saving…' : 'Save Preference'}"""

RENDER_NEW = """        {/* -- Email Notifications -- */}
        <div className="settings-card">
          <div className="settings-card-title">Email Notifications</div>
          <div className="settings-card-desc">
            Choose which events email you, in addition to the in-app inbox notification.
          </div>
          {EMAIL_NOTIFICATION_TYPES.map(t => (
            <label key={t.key} className="settings-checkbox-row" style={{ opacity: t.available ? 1 : 0.5 }}>
              <input
                type="checkbox"
                checked={emailTypes.includes(t.key)}
                disabled={!t.available}
                onChange={() => toggleEmailType(t.key)}
              />
              <span>
                {t.label}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div>
              </span>
            </label>
          ))}
          <div className="settings-actions">
            <button className="settings-btn settings-btn--primary" onClick={saveEmailPref} disabled={emailSaving}>
              {emailSaving ? 'Saving…' : 'Save Preferences'}"""


def main():
    text = SETTINGS.read_text()

    if text.count(STATE_OLD) != 1:
        print(f"FAILED -- state anchor, found {text.count(STATE_OLD)}")
        sys.exit(1)
    text = text.replace(STATE_OLD, STATE_NEW, 1)

    if text.count(RENDER_OLD) != 1:
        print(f"FAILED -- render anchor, found {text.count(RENDER_OLD)}")
        sys.exit(1)
    text = text.replace(RENDER_OLD, RENDER_NEW, 1)

    SETTINGS.write_text(text)
    print("OK -- rebuilt Email Notifications as a real checklist")
    print("Next: npm run build")


if __name__ == "__main__":
    main()
