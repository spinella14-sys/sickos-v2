// ─── Sickos Only Scoring Rules ────────────────────────────────────────────────
// Single source of truth for fantasy point calculation.
// Used by PlayerCardPortal, PlayerPage, RulesPage, and any future stat views.

export const SCORING_RULES = {
  pass_yd:      0.06,
  pass_cmp:     1.0,
  pass_td:      10.0,
  pass_int:    -5.0,
  pass_sack:   -1.0,
  pass_2pt:     2.0,
  rush_yd:      0.4,
  rush_td:      10.0,
  rush_2pt:     2.0,
  rec_td:       10.0,
  rec_2pt:      2.0,
  fumbles_lost: -2.0,
}

const QB_RB_POSITIONS = new Set(['QB', 'RB'])

export function calcFantasyPts(s, pos = 'WR') {
  if (!s) return 0
  const recYdRate = QB_RB_POSITIONS.has(pos) ? 0.2 : 0.3
  const pts =
    (s.pass_yd      || 0) * SCORING_RULES.pass_yd   +
    (s.pass_cmp     || 0) * SCORING_RULES.pass_cmp  +
    (s.pass_td      || 0) * SCORING_RULES.pass_td   +
    (s.pass_int     || 0) * SCORING_RULES.pass_int  +
    (s.pass_sack    || 0) * SCORING_RULES.pass_sack +
    (s.pass_2pt     || 0) * SCORING_RULES.pass_2pt  +
    (s.rush_yd      || 0) * SCORING_RULES.rush_yd   +
    (s.rush_td      || 0) * SCORING_RULES.rush_td   +
    (s.rush_2pt     || 0) * SCORING_RULES.rush_2pt  +
    (s.rec          || 0) * 1.0                      +
    (s.rec_yd       || 0) * recYdRate                +
    (s.rec_td       || 0) * SCORING_RULES.rec_td     +
    (s.rec_2pt      || 0) * SCORING_RULES.rec_2pt    +
    (s.fumbles_lost || 0) * SCORING_RULES.fumbles_lost
  return parseFloat(pts.toFixed(2))
}

export function applyCorrectScoring(weeks, pos) {
  return weeks.map(w => ({ ...w, fantasy_pts: calcFantasyPts(w, pos) }))
}

export function calcTotalsFromWeeks(weeks, pos) {
  const totals = weeks.reduce((acc, w) => {
    for (const key of [
      'pass_yd','pass_cmp','pass_att','pass_td','pass_int','pass_sack','pass_2pt',
      'rush_yd','rush_att','rush_td','rush_2pt',
      'rec','targets','rec_yd','rec_td','rec_2pt',
      'fumbles_lost',
    ]) {
      acc[key] = (acc[key] || 0) + (w[key] || 0)
    }
    return acc
  }, {})
  totals.fantasy_pts = calcFantasyPts(totals, pos)
  return totals
}

// ─── Trend & variance helpers ─────────────────────────────────────────────────
export function calcTrend(weekly) {
  if (!weekly || weekly.length < 4) return null
  const sorted   = [...weekly].sort((a, b) => b.week - a.week)
  const last3    = sorted.slice(0, 3)
  const rest     = sorted.slice(3)
  if (!rest.length) return null
  const last3Avg = last3.reduce((s, w) => s + (w.fantasy_pts || 0), 0) / last3.length
  const restAvg  = rest.reduce((s, w)  => s + (w.fantasy_pts || 0), 0) / rest.length
  if (!restAvg) return null
  const delta = (last3Avg - restAvg) / restAvg
  if (delta >= 0.20)  return 'rising'
  if (delta <= -0.20) return 'falling'
  return null
}

export function calcBoomBust(weekly) {
  if (!weekly || weekly.length < 4) return false
  const pts      = weekly.map(w => w.fantasy_pts || 0)
  const mean     = pts.reduce((a, b) => a + b, 0) / pts.length
  const variance = pts.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / pts.length
  return Math.sqrt(variance) > 8
}

// ─── Season-total benchmarks ──────────────────────────────────────────────────
// p50 = median full-season starter; p90 = elite season threshold
export const BENCHMARKS = {
  QB: {
    pass_yd:      { p50: 3800, p90: 5000, label: 'Pass Yds' },
    pass_cmp:     { p50: 310,  p90: 400,  label: 'Comp'     },
    pass_att:     { p50: 500,  p90: 640,  label: 'Att'      },
    _cpct:        { p50: 63,   p90: 71,   label: 'Cmp%'     },
    pass_td:      { p50: 26,   p90: 40,   label: 'Pass TD'  },
    pass_int:     { p50: 11,   p90: 4,    label: 'INT',      invert: true },
    pass_sack:    { p50: 32,   p90: 15,   label: 'Sacks',    invert: true },
    fumbles_lost: { p50: 5,    p90: 2,    label: 'FUM',      invert: true },
    rush_yd:      { p50: 280,  p90: 700,  label: 'Rush Yds' },
    rush_td:      { p50: 3,    p90: 10,   label: 'Rush TD'  },
  },
  RB: {
    rush_att:     { p50: 180,  p90: 280,  label: 'Carries'  },
    rush_yd:      { p50: 850,  p90: 1400, label: 'Rush Yds' },
    _ypc:         { p50: 4.2,  p90: 5.0,  label: 'YPC'      },
    rush_td:      { p50: 7,    p90: 14,   label: 'Rush TD'  },
    fumbles_lost: { p50: 3,    p90: 1,    label: 'FUM',      invert: true },
    targets:      { p50: 55,   p90: 100,  label: 'Targets'  },
    rec:          { p50: 42,   p90: 80,   label: 'Rec'      },
    rec_yd:       { p50: 380,  p90: 700,  label: 'Rec Yds'  },
    _ypr:         { p50: 8.5,  p90: 11,   label: 'YPR'      },
    rec_td:       { p50: 3,    p90: 7,    label: 'Rec TD'   },
  },
  WR: {
    targets:      { p50: 95,   p90: 150,  label: 'Targets'  },
    rec:          { p50: 65,   p90: 110,  label: 'Rec'      },
    rec_yd:       { p50: 850,  p90: 1400, label: 'Rec Yds'  },
    _ypr:         { p50: 12,   p90: 15,   label: 'YPR'      },
    rec_td:       { p50: 6,    p90: 12,   label: 'Rec TD'   },
    fumbles_lost: { p50: 2,    p90: 0.5,  label: 'FUM',      invert: true },
    rush_yd:      { p50: 80,   p90: 300,  label: 'Rush Yds' },
    rush_td:      { p50: 1,    p90: 4,    label: 'Rush TD'  },
  },
  TE: {
    targets:      { p50: 65,   p90: 120,  label: 'Targets'  },
    rec:          { p50: 48,   p90: 90,   label: 'Rec'      },
    rec_yd:       { p50: 520,  p90: 1000, label: 'Rec Yds'  },
    _ypr:         { p50: 10,   p90: 13,   label: 'YPR'      },
    rec_td:       { p50: 5,    p90: 10,   label: 'Rec TD'   },
    fumbles_lost: { p50: 2,    p90: 0.5,  label: 'FUM',      invert: true },
  },
}

// ─── Per-game benchmarks ──────────────────────────────────────────────────────
// Rate stats (_cpct, _ypc, _ypr) are identical — they don't scale with games.
// Counting stats are divided by 16 (typical starter games).
export const BENCHMARKS_PG = {
  QB: {
    pass_yd:      { p50: 237,  p90: 312,  label: 'Pass Yds' },
    pass_cmp:     { p50: 19.4, p90: 25.0, label: 'Comp'     },
    pass_att:     { p50: 31.3, p90: 40.0, label: 'Att'      },
    _cpct:        { p50: 63,   p90: 71,   label: 'Cmp%'     },
    pass_td:      { p50: 1.6,  p90: 2.5,  label: 'Pass TD'  },
    pass_int:     { p50: 0.7,  p90: 0.25, label: 'INT',      invert: true },
    pass_sack:    { p50: 2.0,  p90: 0.9,  label: 'Sacks',    invert: true },
    fumbles_lost: { p50: 0.3,  p90: 0.1,  label: 'FUM',      invert: true },
    rush_yd:      { p50: 17.5, p90: 43.8, label: 'Rush Yds' },
    rush_td:      { p50: 0.19, p90: 0.63, label: 'Rush TD'  },
  },
  RB: {
    rush_att:     { p50: 11.3, p90: 17.5, label: 'Carries'  },
    rush_yd:      { p50: 53.1, p90: 87.5, label: 'Rush Yds' },
    _ypc:         { p50: 4.2,  p90: 5.0,  label: 'YPC'      },
    rush_td:      { p50: 0.44, p90: 0.88, label: 'Rush TD'  },
    fumbles_lost: { p50: 0.19, p90: 0.06, label: 'FUM',      invert: true },
    targets:      { p50: 3.4,  p90: 6.3,  label: 'Targets'  },
    rec:          { p50: 2.6,  p90: 5.0,  label: 'Rec'      },
    rec_yd:       { p50: 23.8, p90: 43.8, label: 'Rec Yds'  },
    _ypr:         { p50: 8.5,  p90: 11,   label: 'YPR'      },
    rec_td:       { p50: 0.19, p90: 0.44, label: 'Rec TD'   },
  },
  WR: {
    targets:      { p50: 5.9,  p90: 9.4,  label: 'Targets'  },
    rec:          { p50: 4.1,  p90: 6.9,  label: 'Rec'      },
    rec_yd:       { p50: 53.1, p90: 87.5, label: 'Rec Yds'  },
    _ypr:         { p50: 12,   p90: 15,   label: 'YPR'      },
    rec_td:       { p50: 0.38, p90: 0.75, label: 'Rec TD'   },
    fumbles_lost: { p50: 0.13, p90: 0.03, label: 'FUM',      invert: true },
    rush_yd:      { p50: 5.0,  p90: 18.8, label: 'Rush Yds' },
    rush_td:      { p50: 0.06, p90: 0.25, label: 'Rush TD'  },
  },
  TE: {
    targets:      { p50: 4.1,  p90: 7.5,  label: 'Targets'  },
    rec:          { p50: 3.0,  p90: 5.6,  label: 'Rec'      },
    rec_yd:       { p50: 32.5, p90: 62.5, label: 'Rec Yds'  },
    _ypr:         { p50: 10,   p90: 13,   label: 'YPR'      },
    rec_td:       { p50: 0.31, p90: 0.63, label: 'Rec TD'   },
    fumbles_lost: { p50: 0.13, p90: 0.03, label: 'FUM',      invert: true },
  },
}

// ─── Computed stat value from totals ──────────────────────────────────────────
export function getComputedStat(key, totals, games, viewMode) {
  if (key === '_cpct') {
    return totals.pass_att > 0 ? (totals.pass_cmp / totals.pass_att) * 100 : 0
  }
  if (key === '_ypc') {
    return totals.rush_att > 0 ? totals.rush_yd / totals.rush_att : 0
  }
  if (key === '_ypr') {
    return totals.rec > 0 ? totals.rec_yd / totals.rec : 0
  }
  // Regular counting stat
  const raw = totals[key] || 0
  return viewMode === 'perGame' && games > 0 ? raw / games : raw
}

// ─── Percentile calculation ───────────────────────────────────────────────────
// viewMode: 'total' | 'perGame'
export function calcPercentile(key, value, pos, invert = false, viewMode = 'total') {
  const benchSet = viewMode === 'perGame' ? BENCHMARKS_PG : BENCHMARKS
  const bench    = benchSet[pos]?.[key]
  if (!bench || value === null || value === undefined) return 0

  const { p50, p90 } = bench
  let pct

  if (!invert) {
    if (value <= 0)        pct = 0
    else if (value >= p90) pct = 95
    else if (value >= p50) pct = 50 + ((value - p50) / (p90 - p50)) * 45
    else                   pct = Math.max(5, (value / p50) * 50)
  } else {
    // Lower is better
    if (value <= p90)      pct = 95
    else if (value <= p50) pct = 50 + ((p50 - value) / (p50 - p90)) * 45
    else                   pct = Math.max(5, 50 - ((value - p50) / p50) * 50)
  }

  return Math.round(Math.min(95, Math.max(5, pct)))
}

export function pctBarColor(pct) {
  if (pct >= 75) return '#3dba6e'
  if (pct >= 50) return '#e8822a'
  if (pct >= 25) return '#d4a843'
  return '#d94f4f'
}

// ─── Regular season date check ────────────────────────────────────────────────
export function isRegularSeason() {
  const now   = new Date()
  const month = now.getMonth() + 1
  const day   = now.getDate()
  if (month >= 9) return true
  if (month === 1 && day <= 15) return true
  return false
}
