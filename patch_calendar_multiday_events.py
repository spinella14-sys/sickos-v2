#!/usr/bin/env python3
"""
Patch -- Expand multi-day events across their full date range on the calendar
eventsByDate previously only placed an event on its event_date. Now expands
across event_date through end_date (inclusive) when end_date is present,
so a week marker shows on every day it's actually open (e.g. Thu-Mon).

Run from ~/Downloads/sickos-v2
    python3 patch_calendar_multiday_events.py
"""
import sys
from pathlib import Path

CALENDAR_PAGE = Path.cwd() / "src" / "pages" / "CalendarPage.jsx"

OLD = """  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(e => {
      if (!map[e.event_date]) map[e.event_date] = []
      map[e.event_date].push(e)
    })
    return map
  }, [events])"""

NEW = """  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(e => {
      // Multi-day events (end_date set, later than event_date) show on
      // every day in their range, not just the start day.
      if (e.end_date && e.end_date > e.event_date) {
        let cursor = new Date(e.event_date + 'T00:00:00')
        const end = new Date(e.end_date + 'T00:00:00')
        while (cursor <= end) {
          const key = cursor.toISOString().split('T')[0]
          if (!map[key]) map[key] = []
          map[key].push(e)
          cursor.setDate(cursor.getDate() + 1)
        }
      } else {
        if (!map[e.event_date]) map[e.event_date] = []
        map[e.event_date].push(e)
      }
    })
    return map
  }, [events])"""

def main():
    text = CALENDAR_PAGE.read_text(encoding="utf-8")
    count = text.count(OLD)
    if count != 1:
        print(f"FAILED -- expected exactly 1 match, found {count}. Aborting, nothing written.")
        sys.exit(1)
    text = text.replace(OLD, NEW, 1)
    CALENDAR_PAGE.write_text(text, encoding="utf-8")
    print("OK -- multi-day events now expand across their full date range")
    print("Next: npm run build")

if __name__ == "__main__":
    main()
