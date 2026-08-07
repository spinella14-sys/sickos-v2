#!/usr/bin/env python3
"""
Patch — Bolder, more urgent pending-trades notify bar
Placement stays the same (queued for a future dashboard redesign) — this
just punches up the existing bar's visual weight: bigger padding/text,
stronger glow animation on the whole bar, pulsing count badge, warning icon.

Run from ~/Downloads/sickos-v2
    python3 patch_bolder_trade_widget.py
"""
import sys
from pathlib import Path

CSS_PATH = Path.cwd() / "src" / "components" / "PendingTradesWidget.css"
JSX_PATH = Path.cwd() / "src" / "components" / "PendingTradesWidget.jsx"

CSS_OLD = """.ptw-notify-bar {
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 20px;
  background: linear-gradient(90deg, rgba(232,130,42,0.18) 0%, rgba(232,130,42,0.06) 100%);
  border-bottom:1px solid rgba(232,130,42,0.3);
  border-left:3px solid var(--orange);
}
.ptw-notify-left  { display:flex; align-items:center; gap:10px; }
.ptw-notify-dot   {
  width:10px; height:10px; border-radius:50%; background:var(--orange);
  box-shadow: 0 0 0 3px rgba(232,130,42,0.25), 0 0 10px rgba(232,130,42,0.4);
  animation: ptw-pulse 2s ease-in-out infinite;
  flex-shrink:0;
}
@keyframes ptw-pulse {
  0%,100% { box-shadow:0 0 0 3px rgba(232,130,42,0.25),0 0 10px rgba(232,130,42,0.4); }
  50%      { box-shadow:0 0 0 5px rgba(232,130,42,0.1),0 0 20px rgba(232,130,42,0.6); }"""

CSS_NEW = """.ptw-notify-bar {
  display:flex; align-items:center; justify-content:space-between;
  padding:18px 24px;
  background: linear-gradient(90deg, rgba(232,130,42,0.4) 0%, rgba(232,130,42,0.15) 100%);
  border-bottom:2px solid var(--orange);
  border-left:6px solid var(--orange);
  animation: ptw-bar-glow 2.2s ease-in-out infinite;
}
@keyframes ptw-bar-glow {
  0%,100% { box-shadow: inset 0 0 16px rgba(232,130,42,0.15); }
  50%      { box-shadow: inset 0 0 32px rgba(232,130,42,0.35); }
}
.ptw-notify-left  { display:flex; align-items:center; gap:12px; }
.ptw-notify-dot   {
  width:14px; height:14px; border-radius:50%; background:var(--orange);
  box-shadow: 0 0 0 4px rgba(232,130,42,0.3), 0 0 14px rgba(232,130,42,0.5);
  animation: ptw-pulse 2s ease-in-out infinite;
  flex-shrink:0;
}
@keyframes ptw-pulse {
  0%,100% { box-shadow:0 0 0 4px rgba(232,130,42,0.3),0 0 14px rgba(232,130,42,0.5); }
  50%      { box-shadow:0 0 0 7px rgba(232,130,42,0.12),0 0 26px rgba(232,130,42,0.7); }"""

CSS_TEXT_OLD = """.ptw-notify-text  { font-family:var(--font-ui); font-size:12px; font-weight:700;
  letter-spacing:0.06em; color:var(--orange); text-transform:uppercase; }
.ptw-notify-count { font-family:var(--font-display); font-size:22px; color:var(--orange);
  font-weight:900; letter-spacing:0.02em; }"""
CSS_TEXT_NEW = """.ptw-notify-text  { font-family:var(--font-ui); font-size:14px; font-weight:900;
  letter-spacing:0.07em; color:var(--orange); text-transform:uppercase; }
.ptw-notify-count { font-family:var(--font-display); font-size:30px; color:var(--orange);
  font-weight:900; letter-spacing:0.02em; animation: ptw-count-pulse 2s ease-in-out infinite; }
@keyframes ptw-count-pulse {
  0%,100% { transform: scale(1); }
  50%      { transform: scale(1.15); }
}"""

JSX_OLD = """            {trades.length === 1
              ? 'You have 1 pending trade offer'
              : trades.length > 0
                ? `You have ${trades.length} pending trade offer${trades.length>1?'s':''}`
                : waitingTrades.length > 0
                  ? `${waitingTrades.length} trade proposal${waitingTrades.length>1?'s':''} awaiting response`
                  : 'No pending trades'}"""
JSX_NEW = """            {trades.length === 1
              ? '⚠️ You have 1 pending trade offer — action needed'
              : trades.length > 0
                ? `⚠️ You have ${trades.length} pending trade offer${trades.length>1?'s':''} — action needed`
                : waitingTrades.length > 0
                  ? `${waitingTrades.length} trade proposal${waitingTrades.length>1?'s':''} awaiting response`
                  : 'No pending trades'}"""


def apply_patch(path, old, new, label):
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        print(f"FAILED — expected exactly 1 match for [{label}], found {count}.")
        sys.exit(1)
    path.write_text(text.replace(old, new, 1))
    print(f"OK — patched [{label}]")


def main():
    apply_patch(CSS_PATH, CSS_OLD, CSS_NEW, "notify bar + dot: bolder, glowing")
    apply_patch(CSS_PATH, CSS_TEXT_OLD, CSS_TEXT_NEW, "text + count: bigger, pulsing count")
    apply_patch(JSX_PATH, JSX_OLD, JSX_NEW, "add urgency wording + warning icon")
    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
