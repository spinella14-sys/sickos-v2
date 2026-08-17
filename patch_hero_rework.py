#!/usr/bin/env python3
"""
Patch -- UFA/RFA hero bar full rework
1. Fixes the actual overlap bug: .rfa-hero had a hardcoded height:72px that
   didn't fit its own 3-line content stacks on both sides.
2. Makes the countdown clock the dominant visual anchor (larger, more
   breathing room).
3. Tightens the wave-info stack.
4. Adds team logo/name context to both hero bars.
5. Fixes the broken /trade-machine route (real route is /trade) and
   removes the "SOON" badge since the destination is a real, working page
   today -- the in-draft popup trade tool remains a separate, deferred
   future build.

Run from ~/Downloads/sickos-v2
    python3 patch_hero_rework.py
"""
import sys
from pathlib import Path

CSS = Path.cwd() / "src" / "pages" / "draft" / "RFADraft.css"
UFA_HERO = Path.cwd() / "src" / "components" / "ufa" / "UFAHero.jsx"
RFA_HERO = Path.cwd() / "src" / "components" / "rfa" / "RFAHero.jsx"


def apply_or_die(text, old, new, label, path_name):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}] in {path_name}, expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)


def main():
    # ---- CSS rework ----
    css_text = CSS.read_text(encoding="utf-8")

    CSS_OLD = """.rfa-hero {
  height: 72px;
  background: var(--draft-surface);
  border-bottom: 2px solid var(--draft-amber);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 24px;
  flex-shrink: 0;
  z-index: 10;
}

.rfa-hero__wave {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 160px;
}

.rfa-hero__wave-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--draft-text-muted);
  text-transform: uppercase;
}

.rfa-hero__wave-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--draft-amber);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.rfa-hero__center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.rfa-hero__status {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--draft-text-muted);
  text-transform: uppercase;
}

.rfa-hero__clock {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
  color: var(--draft-text);
}

.rfa-hero__clock.warning { color: var(--draft-amber); }
.rfa-hero__clock.urgent {
  color: var(--draft-red);
  animation: pulse-red 1s ease-in-out infinite;
}

.rfa-hero__clock-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--draft-text-muted);
  text-transform: uppercase;
}

.rfa-hero__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
  justify-content: flex-end;
}"""

    CSS_NEW = """.rfa-hero {
  min-height: 92px;
  background: var(--draft-surface);
  border-bottom: 2px solid var(--draft-amber);
  display: flex;
  align-items: center;
  padding: 14px 24px;
  gap: 20px;
  flex-shrink: 0;
  z-index: 10;
}

.rfa-hero__team {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.rfa-hero__team-logo {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid var(--draft-border);
}

.rfa-hero__team-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--draft-text);
  line-height: 1.2;
}

.rfa-hero__wave {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 170px;
}

.rfa-hero__wave-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--draft-text-muted);
  text-transform: uppercase;
}

.rfa-hero__wave-name {
  font-size: 16px;
  font-weight: 800;
  color: var(--draft-amber);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  line-height: 1.2;
}

.rfa-hero__wave-caption {
  font-size: 10px;
  color: var(--draft-text-muted);
  line-height: 1.3;
}

.rfa-hero__center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.rfa-hero__status {
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--draft-text-muted);
  text-transform: uppercase;
}

.rfa-hero__clock {
  font-size: 38px;
  font-weight: 800;
  letter-spacing: 0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--draft-text);
  line-height: 1.1;
}

.rfa-hero__clock.warning { color: var(--draft-amber); }
.rfa-hero__clock.urgent {
  color: var(--draft-red);
  animation: pulse-red 1s ease-in-out infinite;
}

.rfa-hero__clock-label {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--draft-text-muted);
  text-transform: uppercase;
}

.rfa-hero__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
  justify-content: flex-end;
}"""

    css_text = apply_or_die(css_text, CSS_OLD, CSS_NEW, "CSS hero rework", "RFADraft.css")
    CSS.write_text(css_text, encoding="utf-8")

    # ---- UFAHero.jsx ----
    ufa_text = UFA_HERO.read_text(encoding="utf-8")

    UFA_IMPORT_OLD = "import { useNavigate } from 'react-router-dom';"
    UFA_IMPORT_NEW = "import { useNavigate } from 'react-router-dom';\nimport { TEAMS, LOGOS } from '../../data/league';"
    ufa_text = apply_or_die(ufa_text, UFA_IMPORT_OLD, UFA_IMPORT_NEW, "add TEAMS/LOGOS import", "UFAHero.jsx")

    UFA_OPEN_OLD = """  return (
    <div className="rfa-hero">
      {/* Left: Wave + tier info */}
      <div className="rfa-hero__wave">
        <span className="rfa-hero__wave-label">UFA Draft — 2026 · Wave {wave} of 9</span>
        <span className="rfa-hero__wave-name">{TIER_NAMES[tier]}</span>
        <span style={{ fontSize: 10, color: 'var(--draft-text-muted)' }}>
          Wave {WAVE_IN_TIER(wave)} of 3 in this tier · Min offer: {TIER_MINS[tier]}
        </span>
      </div>"""
    UFA_OPEN_NEW = """  const teamInfo = TEAMS.find(t => t.abbrev === currentTeam);

  return (
    <div className="rfa-hero">
      <div className="rfa-hero__team">
        {LOGOS[currentTeam] && <img className="rfa-hero__team-logo" src={LOGOS[currentTeam]} alt={currentTeam} />}
        <span className="rfa-hero__team-name">{teamInfo?.name || currentTeam}</span>
      </div>

      {/* Left: Wave + tier info */}
      <div className="rfa-hero__wave">
        <span className="rfa-hero__wave-label">UFA Draft — 2026 · Wave {wave} of 9</span>
        <span className="rfa-hero__wave-name">{TIER_NAMES[tier]}</span>
        <span className="rfa-hero__wave-caption">
          Wave {WAVE_IN_TIER(wave)} of 3 in this tier · Min offer: {TIER_MINS[tier]}
        </span>
      </div>"""
    ufa_text = apply_or_die(ufa_text, UFA_OPEN_OLD, UFA_OPEN_NEW, "add team badge to UFA hero", "UFAHero.jsx")

    UFA_BTN_OLD = """        <button
          className="rfa-hero__trade-btn"
          onClick={() => navigate('/trade-machine')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          TRADE MACHINE
          <span className="rfa-hero__trade-badge">SOON</span>
        </button>"""
    UFA_BTN_NEW = """        <button
          className="rfa-hero__trade-btn"
          onClick={() => navigate('/trade')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          TRADE MACHINE
        </button>"""
    ufa_text = apply_or_die(ufa_text, UFA_BTN_OLD, UFA_BTN_NEW, "fix route + remove SOON badge", "UFAHero.jsx")
    UFA_HERO.write_text(ufa_text, encoding="utf-8")

    # ---- RFAHero.jsx ----
    rfa_text = RFA_HERO.read_text(encoding="utf-8")

    RFA_OPEN_OLD = """  return (
    <div className="rfa-hero">
      {/* Left: Wave info */}
      <div className="rfa-hero__wave">
        <span className="rfa-hero__wave-label">RFA Draft — 2026</span>
        <span className="rfa-hero__wave-name">{WAVE_NAMES[wave]}</span>
        <span style={{ fontSize: '10px', color: 'var(--draft-text-muted)' }}>
          {WAVE_DESCRIPTIONS[wave]}
        </span>
      </div>"""
    RFA_OPEN_NEW = """  return (
    <div className="rfa-hero">
      <div className="rfa-hero__team">
        {getTeamLogo?.(currentTeam) && <img className="rfa-hero__team-logo" src={getTeamLogo(currentTeam)} alt={currentTeam} />}
        <span className="rfa-hero__team-name">{getTeamName?.(currentTeam) || currentTeam}</span>
      </div>

      {/* Left: Wave info */}
      <div className="rfa-hero__wave">
        <span className="rfa-hero__wave-label">RFA Draft — 2026</span>
        <span className="rfa-hero__wave-name">{WAVE_NAMES[wave]}</span>
        <span className="rfa-hero__wave-caption">
          {WAVE_DESCRIPTIONS[wave]}
        </span>
      </div>"""
    rfa_text = apply_or_die(rfa_text, RFA_OPEN_OLD, RFA_OPEN_NEW, "add team badge to RFA hero", "RFAHero.jsx")

    RFA_BTN_OLD = """        <button
          className="rfa-hero__trade-btn"
          onClick={() => navigate('/trade-machine')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          TRADE MACHINE
          <span className="rfa-hero__trade-badge">SOON</span>
        </button>"""
    RFA_BTN_NEW = """        <button
          className="rfa-hero__trade-btn"
          onClick={() => navigate('/trade')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          TRADE MACHINE
        </button>"""
    rfa_text = apply_or_die(rfa_text, RFA_BTN_OLD, RFA_BTN_NEW, "fix route + remove SOON badge", "RFAHero.jsx")
    RFA_HERO.write_text(rfa_text, encoding="utf-8")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
