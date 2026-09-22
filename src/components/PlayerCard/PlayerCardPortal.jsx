import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { usePlayerCard } from './PlayerCardContext'
import DefenseRankBadge, { OppRankCell } from '../DefenseRankBadge'
import { normalizeTeamAbbrev } from '../../utils/defenseRankUtils'
import '../DefenseRankBadge.css'
import NewsCard from '../NewsCard'
import '../NewsCard.css'
import { useAuth } from '../../context/AuthContext'
import {
  calcFantasyPts,
  calcPercentile,
  getComputedStat,
  pctBarColor,
  isRegularSeason,
  calcBoomBust,
} from '../../utils/scoringUtils'
import { LOGOS } from '../../data/league'
import './PlayerCardPortal.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '') + '/api'
const CURRENT_SEASON = new Date().getFullYear()
const NAV_HEIGHT = 64
const CARD_W     = 360
const CARD_H_EST = 640

const POS_COLOR = { QB: '#e8822a', RB: '#3dba6e', WR: '#3a9fd4', TE: '#d4a843' }

// Per-game benchmarks calibrated to Sickos scoring
// (10pt TDs, 1pt/cmp, 0.06/yd passing, 0.4/yd rushing, 0.2-0.3/yd receiving)
const FPTS_BENCHMARKS = {
  QB: { p50: 42, p90: 65 },  // Josh Allen ~66 PPG = elite
  RB: { p50: 18, p90: 34 },
  WR: { p50: 14, p90: 26 },
  TE: { p50: 11, p90: 22 },
}
function fptsPct(ppg, pos) {
  const b = FPTS_BENCHMARKS[pos]
  if (!b || !ppg || ppg <= 0) return 0
  if (ppg >= b.p90) return 95
  if (ppg < b.p50)  return Math.max(5, (ppg / b.p50) * 50)
  return 50 + ((ppg - b.p50) / (b.p90 - b.p50)) * 45
}

const TB_META = {
  available:   { label: 'On the Block',  color: '#3dba6e' },
  listening:   { label: 'Will Listen',   color: '#d4a843' },
  untouchable: { label: 'Untouchable',   color: '#d94f4f' },
}

// All box-score-relevant stats per position
const STAT_GROUPS = {
  QB: [
    {
      label: 'PASSING',
      stats: [
        { key: 'pass_cmp',     label: 'CMP'  },
        { key: 'pass_att',     label: 'ATT'  },
        { key: '_cpct',        label: 'CMP%' },
        { key: 'pass_yd',      label: 'YDS'  },
        { key: 'pass_td',      label: 'TD'   },
        { key: 'pass_int',     label: 'INT',  invert: true },
        { key: 'pass_sack',    label: 'SCK',  invert: true },
        { key: 'fumbles_lost', label: 'FUM',  invert: true },
      ],
    },
    {
      label: 'RUSHING',
      stats: [
        { key: 'rush_yd',      label: 'YDS' },
        { key: '_ypc',         label: 'YPC' },
        { key: 'rush_td',      label: 'TD'  },
      ],
    },
  ],
  RB: [
    {
      label: 'RUSHING',
      stats: [
        { key: 'rush_yd',      label: 'YDS' },
        { key: '_ypc',         label: 'YPC' },
        { key: 'rush_td',      label: 'TD'  },
        { key: 'fumbles_lost', label: 'FUM', invert: true },
      ],
    },
    {
      label: 'RECEIVING',
      stats: [
        { key: 'targets',      label: 'TAR' },
        { key: 'rec',          label: 'REC' },
        { key: 'rec_yd',       label: 'YDS' },
        { key: '_ypr',         label: 'YPR' },
        { key: 'rec_td',       label: 'TD'  },
      ],
    },
  ],
  WR: [
    {
      label: 'RECEIVING',
      stats: [
        { key: 'targets',      label: 'TAR' },
        { key: 'rec',          label: 'REC' },
        { key: 'rec_yd',       label: 'YDS' },
        { key: '_ypr',         label: 'YPR' },
        { key: 'rec_td',       label: 'TD'  },
        { key: 'fumbles_lost', label: 'FUM', invert: true },
      ],
    },
  ],
  TE: [
    {
      label: 'RECEIVING',
      stats: [
        { key: 'targets',      label: 'TAR' },
        { key: 'rec',          label: 'REC' },
        { key: 'rec_yd',       label: 'YDS' },
        { key: '_ypr',         label: 'YPR' },
        { key: 'rec_td',       label: 'TD'  },
        { key: 'fumbles_lost', label: 'FUM', invert: true },
      ],
    },
  ],
}

function fmtStat(val, key) {
  if (!val || val === 0) return '—'
  if (key === '_cpct') return val.toFixed(1) + '%'
  if (key === '_ypc' || key === '_ypr') return val.toFixed(1)
  if (Number.isInteger(val)) return val.toLocaleString()
  return parseFloat(val.toFixed(1)).toLocaleString()
}

function headshotUrl(id) {
  return `https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`
}

function ptColor(pts) {
  if (pts >= 25) return '#3dba6e'
  if (pts >= 15) return '#e8822a'
  if (pts >= 5)  return '#d4a843'
  return '#d94f4f'
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

// Columns per position: primary stats, then secondary after a divider.
const WEEK_COLS = {
  QB: {
    primary:   [['CMP-ATT', w => `${w.pass_cmp ?? 0}-${w.pass_att ?? 0}`],
                ['YDS',     w => w.pass_yd ?? 0],
                ['TD',      w => w.pass_td ?? 0],
                ['INT',     w => w.pass_int ?? 0]],
    secondary: [['CAR',     w => w.rush_att ?? 0],
                ['YDS',     w => w.rush_yd ?? 0],
                ['TD',      w => w.rush_td ?? 0]],
  },
  RB: {
    primary:   [['CAR',     w => w.rush_att ?? 0],
                ['YDS',     w => w.rush_yd ?? 0],
                ['TD',      w => w.rush_td ?? 0]],
    secondary: [['TGT',     w => w.targets ?? 0],
                ['REC',     w => w.rec ?? 0],
                ['YDS',     w => w.rec_yd ?? 0],
                ['TD',      w => w.rec_td ?? 0]],
  },
  WR: {
    primary:   [['TGT',     w => w.targets ?? 0],
                ['REC',     w => w.rec ?? 0],
                ['YDS',     w => w.rec_yd ?? 0],
                ['TD',      w => w.rec_td ?? 0]],
    secondary: [['CAR',     w => w.rush_att ?? 0],
                ['YDS',     w => w.rush_yd ?? 0],
                ['TD',      w => w.rush_td ?? 0]],
  },
}
WEEK_COLS.TE = WEEK_COLS.WR

function RecentWeeks({ weekly, schedule, projByWeek, pos, currentWeek }) {
  const cols = WEEK_COLS[pos]
  if (!cols || !schedule?.length) return null

  const statByWeek = {}
  for (const w of (weekly || [])) statByWeek[w.week] = w

  // Walk back from the current week. The schedule runs the full season, so
  // weeks that have not happened are skipped rather than shown as blanks.
  const played = schedule
    .filter(g => g.week <= currentWeek)
    .sort((a, b) => b.week - a.week)

  const byeWeeks = []
  const weeksInRange = []
  const maxWeek = Math.max(...schedule.map(g => g.week), 0)
  for (let wk = currentWeek; wk >= 1 && weeksInRange.length < 5; wk--) {
    const game = schedule.find(g => g.week === wk)
    weeksInRange.push({ week: wk, game: game || null })
    if (!game) byeWeeks.push(wk)
  }

  const rows = weeksInRange.reverse()
  const allCols = [...cols.primary, ...cols.secondary]
  const divideAt = cols.primary.length

  return (
    <div className="pc-weeks">
      <table className="pc-weeks-tbl">
        <thead>
          <tr>
            <th>WK</th>
            <th>OPP</th>
            <th className="pc-weeks-pts">FPTS</th>
            <th>PROJ</th>
            {allCols.map(([label], i) => (
              <th key={i} className={i === divideAt ? 'pc-weeks-divide' : ''}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ week, game }) => {
            const stat = statByWeek[week]
            const proj = projByWeek?.[week]
            const isBye = !game
            const isDnp = !isBye && !stat

            return (
              <tr key={week} className={isBye || isDnp ? 'pc-weeks-row--none' : ''}>
                <td>{week}</td>
                <td>
                  {isBye ? 'BYE' : `${game.is_home ? '' : '@'}${game.opponent}`}
                </td>
                <td className="pc-weeks-pts">
                  {isBye ? '—' : isDnp ? 'DNP' : (stat.fantasy_pts ?? 0).toFixed(1)}
                </td>
                <td>{isBye ? '—' : (proj != null ? proj.toFixed(1) : '—')}</td>
                {allCols.map(([, get], i) => (
                  <td key={i} className={i === divideAt ? 'pc-weeks-divide' : ''}>
                    {isBye || isDnp ? '—' : get(stat)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Sparkline({ weeks }) {
  if (!weeks?.length) return null
  const last8  = [...weeks].sort((a, b) => a.week - b.week).slice(-8)
  const maxPts = Math.max(...last8.map(w => w.fantasy_pts || 0), 1)
  const W = 312; const H = 44
  const BAR_W = Math.floor((W - (last8.length - 1) * 4) / last8.length)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
      {last8.map((w, i) => {
        const pts  = w.fantasy_pts || 0
        const barH = Math.max(3, (pts / maxPts) * (H - 2))
        const x    = i * (BAR_W + 4)
        const y    = H - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={barH} rx={2} fill={ptColor(pts)} opacity={0.85} />
            <title>Wk {w.week}: {pts.toFixed(1)} pts</title>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Stat vertical bar ────────────────────────────────────────────────────────
// Mapping from stat key → posRanks field (null = no rank for derived stats)
const STAT_RANK_KEY = {
  pass_cmp: 'pass_cmp', pass_att: 'pass_att', pass_yd: 'pass_yd',
  pass_td:  'pass_td',  pass_int: 'pass_int',  pass_sack: 'pass_sack',
  rush_yd:  'rush_yd',  rush_att: 'rush_att',  rush_td: 'rush_td',
  targets:  'targets',  rec: 'rec', rec_yd: 'rec_yd', rec_td: 'rec_td',
  _cpct: null, _ypc: null, _ypr: null, fumbles_lost: null,
}

function StatBar({ label, value, pct, tooltip, posRank }) {
  const color = pctBarColor(pct)
  const fillH = Math.max(4, Math.min(100, pct))
  return (
    <div className="pc-statbar" title={tooltip || undefined}>
      <div className="pc-statbar-posrank" style={{ color: posRank ? color : 'transparent' }}>{posRank || ''}</div>
      <div className="pc-statbar-pct" style={{ color }}>{pct > 0 ? `${pct}` : '—'}</div>
      <div className="pc-statbar-track">
        <div className="pc-statbar-fill" style={{ height: `${fillH}%`, background: color }} />
      </div>
      <div className="pc-statbar-lbl">{label}</div>
      <div className="pc-statbar-val">{value}</div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

// ── Analytics helpers ──────────────────────────────────────────────────────
const A_BM = {
  sack_rate:       { good: 5,   ok: 8,   lower: true  },
  to_rate_pass:    { good: 2,   ok: 4,   lower: true  },
  td_rate_pass:    { good: 6,   ok: 4,   lower: false },
  yds_per_att:     { good: 8,   ok: 6.5, lower: false },
  yds_per_cmp:     { good: 12,  ok: 9.5, lower: false },
  rsh_share:       { good: 60,  ok: 35,  lower: false },
  rsh_td_share:    { good: 40,  ok: 20,  lower: false },
  carry_rate:      { good: 45,  ok: 25,  lower: false },
  to_rate_rush:    { good: 1,   ok: 3,   lower: true  },
  td_rate_rush:    { good: 6,   ok: 3,   lower: false },
  tar_share:       { good: 22,  ok: 12,  lower: false },
  rec_share:       { good: 20,  ok: 10,  lower: false },
  rec_td_share:    { good: 30,  ok: 15,  lower: false },
  catch_rate:      { good: 68,  ok: 55,  lower: false },
  yds_per_target:  { good: 9,   ok: 7,   lower: false },
  target_rate:     { good: 20,  ok: 12,  lower: false },
  td_rate_rec:     { good: 8,   ok: 4,   lower: false },
}

function aPctCard(val, key) {
  const bm = A_BM[key]
  if (!bm || val == null) return 0
  const { good, ok, lower } = bm
  if (lower) {
    if (val <= 0)    return 99
    if (val <= good) return Math.min(99, 85 + ((good - val) / good) * 14)
    if (val <= ok)   return 50 + ((ok - val) / (ok - good)) * 35
    return Math.max(5, 50 - ((val - ok) / ok) * 45)
  } else {
    if (val <= 0)    return 5
    if (val >= good) return Math.min(99, 85 + ((val - good) / good) * 14)
    if (val >= ok)   return 50 + ((val - ok) / (good - ok)) * 35
    return Math.max(5, (val / ok) * 50)
  }
}

function afC(val, suffix = '%') {
  if (val == null) return '—'
  return val.toFixed(1) + suffix
}

// Uses the card's native StatBar (pc-statbar class) — identical format to stats above
const ANALYTICS_RANK_KEY = {
  catch_rate: 'catch_rate', yds_per_target: 'yds_per_target', td_rate_rec: 'td_rate_rec',
  target_rate: 'target_rate', carry_rate: 'carry_rate', td_rate_rush: 'td_rate_rush',
  yds_per_att: 'yds_per_att', td_rate_pass: 'td_rate_pass', sack_rate: 'sack_rate', epa_total: 'epa_total',
}

function ARow({ bars, analyticsRanks, playerPos }) {
  const visible = bars.filter(Boolean)
  if (!visible.length) return null
  return (
    <div className="pc-statbars-row">
      {visible.map((b, i) => {
        const rf = b.rankKey ? ANALYTICS_RANK_KEY[b.rankKey] : null
        const rn = rf && analyticsRanks ? analyticsRanks[rf] : null
        const pl = rn && playerPos ? `${playerPos}${rn}` : null
        return (
          <StatBar
            key={i}
            label={b.label}
            value={b.display}
            pct={b.raw != null ? Math.round(aPctCard(b.raw, b.bk)) : 0}
            tooltip={b.tip}
            posRank={pl}
          />
        )
      })}
    </div>
  )
}

function AnalyticsSection({ analytics, pos, analyticsRanks }) {
  if (!analytics) return null
  const { passing: qb, rushing: ru, receiving: re } = analytics

  return (
    <div className="pc-section">
      <div className="pc-section-hd">
        <span className="pc-section-label">ANALYTICS</span>
        <span style={{ fontSize:9, color:'var(--text-muted)' }}>Hover bars for formula</span>
      </div>

      {/* ── QB ── */}
      {pos === 'QB' && qb && (
        <>
          <div className="pc-stat-group-label">PASSING EFFICIENCY</div>
          <ARow analyticsRanks={analyticsRanks} playerPos={pos} bars={[
            { label:'DRK/G',  raw: qb.dropbacks_pg,  display: afC(qb.dropbacks_pg, ''), bk: null,           tip: 'Dropbacks per game (Pass ATT + Sacks)', rankKey: null },
            { label:'SACK%',  raw: qb.sack_rate,     display: afC(qb.sack_rate),        bk: 'sack_rate',    tip: 'Sack Rate = Sacks ÷ Dropbacks', rankKey: 'sack_rate' },
            { label:'TO%',    raw: qb.to_rate,       display: afC(qb.to_rate),           bk: 'to_rate_pass', tip: 'Turnover Rate = (INT + Fumbles) ÷ Dropbacks', rankKey: null },
            { label:'TD%',    raw: qb.td_rate,       display: afC(qb.td_rate),           bk: 'td_rate_pass', tip: 'TD Rate = Pass TDs ÷ Pass ATT', rankKey: 'td_rate_pass' },
            { label:'YD/ATT', raw: qb.yds_per_att,   display: afC(qb.yds_per_att, ''),  bk: 'yds_per_att',  tip: 'Yards per Attempt', rankKey: 'yds_per_att' },
          ]} />
          <ARow analyticsRanks={analyticsRanks} playerPos={pos} bars={[
            { label:'YD/CMP', raw: qb.yds_per_cmp,   display: afC(qb.yds_per_cmp, ''),  bk: 'yds_per_cmp',  tip: 'Yards per Completion' },
            { label:'RU/PS%', raw: qb.rush_to_pass,  display: afC(qb.rush_to_pass),      bk: null,           tip: 'Rush pts as % of Passing pts', rankKey: null },
            { label:'EPA',    raw: qb.epa,            display: qb.epa  != null ? `${qb.epa > 0?'+':''}${afC(qb.epa, '')}` : '—', bk: null, tip: 'Expected Points Added' },
          ]} />
        </>
      )}

      {/* ── RB ── */}
      {pos === 'RB' && (
        <>
          {ru && (
            <>
              <div className="pc-stat-group-label">RUSHING</div>
              <ARow analyticsRanks={analyticsRanks} playerPos={pos} bars={[
                { label:'CAR/SN',  raw: ru.carry_rate,   display: afC(ru.carry_rate),   bk: 'carry_rate',   tip: 'Carry Rate = Carries ÷ Snaps', rankKey: 'carry_rate' },
                { label:'RSH SH',  raw: ru.rsh_share,    display: afC(ru.rsh_share),    bk: 'rsh_share',    tip: 'Rush Share = Player Carries ÷ Team Carries' },
                { label:'RSH TD%', raw: ru.rsh_td_share, display: afC(ru.rsh_td_share), bk: 'rsh_td_share', tip: 'Rush TD Share = Player Rush TDs ÷ Team Rush TDs' },
                { label:'TD RT',   raw: ru.td_rate,      display: afC(ru.td_rate),      bk: 'td_rate_rush', tip: 'TD Rate = Rush TDs ÷ Carries', rankKey: 'td_rate_rush' },
                { label:'TO RT',   raw: ru.to_rate,      display: afC(ru.to_rate),      bk: 'to_rate_rush', tip: 'Turnover Rate = Fumbles ÷ Carries' },
              ]} />
              <ARow analyticsRanks={analyticsRanks} playerPos={pos} bars={[
                { label:'RU/RC',  raw: ru.rush_to_rec,     display: ru.rush_to_rec != null ? afC(ru.rush_to_rec, '') : '—', bk: null, tip: 'Rush pts ÷ Receiving pts' },
                { label:'1D/G',   raw: ru.first_downs_pg,  display: afC(ru.first_downs_pg, ''), bk: null, tip: 'First Downs per game (needs DB migration)' },
                { label:'EPA',    raw: ru.epa,             display: ru.epa != null ? `${ru.epa > 0?'+':''}${afC(ru.epa, '')}` : '—', bk: null, tip: 'Expected Points Added (needs DB migration)' },
              ]} />
            </>
          )}
          {re && (
            <>
              <div className="pc-stat-group-label" style={{ marginTop:6 }}>RECEIVING</div>
              <ARow analyticsRanks={analyticsRanks} playerPos={pos} bars={[
                { label:'TGT/SN', raw: re.target_rate,    display: afC(re.target_rate),    bk: 'target_rate',   tip: 'Target Rate = Targets ÷ Snaps' },
                { label:'TAR SH', raw: re.tar_share,      display: afC(re.tar_share),      bk: 'tar_share',     tip: 'Target Share = Player Targets ÷ Team Targets' },
                { label:'CATCH%', raw: re.catch_rate,     display: afC(re.catch_rate),     bk: 'catch_rate',    tip: 'Catch Rate = Receptions ÷ Targets' },
                { label:'REC SH', raw: re.rec_share,      display: afC(re.rec_share),      bk: 'rec_share',     tip: 'Rec Share = Player Receptions ÷ Team Receptions' },
                { label:'TD SH',  raw: re.rec_td_share,   display: afC(re.rec_td_share),   bk: 'rec_td_share',  tip: 'Rec TD Share = Player Rec TDs ÷ Team Rec TDs' },
              ]} />
            </>
          )}
        </>
      )}

      {/* ── WR / TE ── */}
      {(pos === 'WR' || pos === 'TE') && re && (
        <>
          <div className="pc-stat-group-label">TARGET SHARE</div>
          <ARow analyticsRanks={analyticsRanks} playerPos={pos} bars={[
            { label:'TAR SH', raw: re.tar_share,    display: afC(re.tar_share),    bk: 'tar_share',    tip: 'Target Share = Player Targets ÷ Team Targets' },
            { label:'REC SH', raw: re.rec_share,    display: afC(re.rec_share),    bk: 'rec_share',    tip: 'Rec Share = Player Receptions ÷ Team Receptions' },
            { label:'TD SH',  raw: re.rec_td_share, display: afC(re.rec_td_share), bk: 'rec_td_share', tip: 'Rec TD Share = Player Rec TDs ÷ Team Rec TDs' },
            { label:'TGT/SN', raw: re.target_rate,  display: afC(re.target_rate),  bk: 'target_rate',  tip: 'Target Rate = Targets ÷ Snaps', rankKey: 'target_rate' },
          ]} />
          <div className="pc-stat-group-label" style={{ marginTop:6 }}>EFFICIENCY</div>
          <ARow analyticsRanks={analyticsRanks} playerPos={pos} bars={[
            { label:'CATCH%', raw: re.catch_rate,       display: afC(re.catch_rate),         bk: 'catch_rate',     tip: 'Catch Rate = Receptions ÷ Targets', rankKey: 'catch_rate' },
            { label:'YD/TGT', raw: re.yds_per_target,   display: afC(re.yds_per_target, ''), bk: 'yds_per_target', tip: 'Yards per Target', rankKey: 'yds_per_target' },
            { label:'TD RT',  raw: re.td_rate,          display: afC(re.td_rate),            bk: 'td_rate_rec',    tip: 'TD Rate = Rec TDs ÷ Receptions', rankKey: 'td_rate_rec' },
            { label:'AIR%',   raw: re.pct_yds_in_air,   display: afC(re.pct_yds_in_air),     bk: null,             tip: 'Air Yards as % of Receiving Yards (needs DB migration)' },
            { label:'1D/G',   raw: re.first_downs_pg,   display: afC(re.first_downs_pg, ''), bk: null,             tip: 'First Downs per game (needs DB migration)' },
          ]} />
        </>
      )}
    </div>
  )
}


function PlayerCard({ playerId, anchorRect }) {
  const { closeCard }    = usePlayerCard()
  const { manager }      = useAuth()
  const cardRef          = useRef(null)

  const [player,        setPlayer]        = useState(null)
  const [contract,      setContract]      = useState(null)
  const [weekly,        setWeekly]        = useState([])
  const [totals,        setTotals]        = useState({})
  const [games,         setGames]         = useState(0)
  const [ownership,     setOwnership]     = useState(null)
  const [tradeBlock,    setTradeBlock]    = useState(null)
  const [onWatchlist,   setOnWatchlist]   = useState(false)
  const [statSeason,    setStatSeason]    = useState(CURRENT_SEASON)
  const [loading,       setLoading]       = useState(true)
  // Per-game by default. A season total mostly reports who has been available;
  // the per-game number is what tells you about the player.
  const [viewMode,      setViewMode]      = useState('perGame')
  // This week's projection. The card never had one -- the old PROJ bar was an
  // empty placeholder labelled "season".
  const [projPts,       setProjPts]       = useState(null)
  const [watchlistBusy, setWatchlistBusy] = useState(false)
  const [analytics,     setAnalytics]     = useState(null)
  const [availableSeasons, setAvailableSeasons] = useState([])
  const [statsLoading,  setStatsLoading]  = useState(false)
  const [posRanks,      setPosRanks]      = useState(null)
  const [teamSchedule, setTeamSchedule] = useState([])
  const [projByWeek,   setProjByWeek]   = useState({})
  const [schedDefRanks, setSchedDefRanks] = useState(null)
  const [schedCurWeek, setSchedCurWeek] = useState(null)
  const [showNewsCard, setShowNewsCard] = useState(false)
  const [newsCardTab,  setNewsCardTab]  = useState('health')
  const [miniNews,     setMiniNews]     = useState([])
  const [hasTransNews, setHasTransNews] = useState(false)

  const teamAbbrev = manager?.team_abbrev
  const inSeason   = isRegularSeason()

  // Upcoming NFL schedule — isolated effect, depends only on the player's NFL
  // team. Never touches player/stats/contract state to avoid race conditions.
  useEffect(() => {
    const nflTeam = normalizeTeamAbbrev(player?.nfl_team)
    if (!nflTeam) { setTeamSchedule([]); return }
    let cancelled = false

    fetch(`${API_BASE}/schedule/current-week`)
      .then(r => r.json())
      .then(({ season, week }) => {
        if (cancelled) return
        setSchedCurWeek(week)
        fetch(`${API_BASE}/stats/player/${playerId}/projections?season=${season}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (!cancelled) setProjByWeek(d?.by_week || {}) })
          .catch(() => {})
        return Promise.all([
          fetch(`${API_BASE}/schedule/team/${nflTeam}?season=${season}`).then(r => r.ok ? r.json() : []),
          fetch(`${API_BASE}/schedule/defense-rankings?season=${season}`).then(r => r.ok ? r.json() : null),
        ])
      })
      .then(result => {
        if (cancelled || !result) return
        const [sched, defRanks] = result
        setTeamSchedule(sched || [])
        setSchedDefRanks(defRanks?.rankings || null)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [player?.nfl_team])

  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    setLoading(true)
    setPlayer(null); setContract(null); setWeekly([]); setTotals({})
    setGames(0); setOwnership(null); setTradeBlock(null); setOnWatchlist(false)

    fetch(`${API_BASE}/players/${playerId}`)
      .then(r => r.ok ? r.json() : null)
      .then(async bio => {
        if (cancelled || !bio) return
        const p = bio.player || bio
        setPlayer(p)
        setContract(bio.contract || null)
        // Mini news feed — top 3 items across both categories
        fetch(`${API_BASE}/news/player/${playerId}`)
          .then(r => r.ok ? r.json() : [])
          .then(items => setMiniNews((items || []).slice(0, 3)))
          .catch(() => {})
        // Check if this player has recent transaction news (drives newspaper icon elsewhere)
        fetch(`${API_BASE}/news/player/${playerId}?category=transaction`)
          .then(r => r.ok ? r.json() : [])
          .then(items => setHasTransNews((items || []).some(i => {
            const days = (Date.now() - new Date(i.created_at).getTime()) / 86400000
            return days <= 14
          })))
          .catch(() => {})
        const season = bio.latest_season || CURRENT_SEASON
        setStatSeason(season)
        const pos = p?.position || 'WR'

        const [statsRes, ownRes, tbRes, wlRes, analyticsRes, seasonsRes, ranksRes] = await Promise.all([
          fetch(`${API_BASE}/stats/player/${playerId}?season=${season}`).then(r => r.ok ? r.json() : null),
          fetch(`${API_BASE}/stats/player/${playerId}/ownership`).then(r => r.ok ? r.json() : null),
          fetch(`${API_BASE}/trade-block`).then(r => r.ok ? r.json() : []),
          teamAbbrev
            ? fetch(`${API_BASE}/watchlist`, { headers: { 'x-team-abbrev': teamAbbrev } }).then(r => r.ok ? r.json() : [])
            : Promise.resolve([]),
          fetch(`${API_BASE}/stats/player/${playerId}/analytics?season=${season}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API_BASE}/stats/player/${playerId}/seasons`).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`${API_BASE}/stats/player/${playerId}/position-ranks?season=${season}`).then(r => r.ok ? r.json() : null).catch(() => null),
        ])

        if (cancelled) return

        const rawWeekly = statsRes?.weekly || []
        setWeekly(rawWeekly.map(w => ({ ...w, fantasy_pts: calcFantasyPts(w, pos) })))
        setTotals(statsRes?.totals || {})
        setGames(statsRes?.games || 0)
        setOwnership(ownRes)
        setAnalytics(analyticsRes)
        setAvailableSeasons(seasonsRes || [])
        setPosRanks(ranksRes || null)

        const blocks  = Array.isArray(tbRes) ? tbRes : []
        const myBlock = blocks.find(b => b.sleeper_id === playerId && b.asset_type === 'player')
        setTradeBlock(myBlock || null)

        const wl = Array.isArray(wlRes) ? wlRes : []
        setOnWatchlist(wl.some(e => e.sleeper_id === playerId))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [playerId, teamAbbrev])

  // Season change — direct async callback, no useEffect, no race conditions.
  // Only changes stats/analytics; leaves player, contract, ownership, etc. untouched.
  const handleSeasonChange = async (newSeason) => {
    if (newSeason === statSeason || !playerId) return
    setStatSeason(newSeason)
    setStatsLoading(true)
    setWeekly([]); setTotals({}); setGames(0); setAnalytics(null)
    try {
      const pos = player?.position || 'WR'
      const [statsRes, analyticsRes, ranksRes2] = await Promise.all([
        fetch(`${API_BASE}/stats/player/${playerId}?season=${newSeason}`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/stats/player/${playerId}/analytics?season=${newSeason}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/stats/player/${playerId}/position-ranks?season=${newSeason}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      const rawWeekly = statsRes?.weekly || []
      setWeekly(rawWeekly.map(w => ({ ...w, fantasy_pts: calcFantasyPts(w, pos) })))
      setTotals(statsRes?.totals || {})
      setGames(statsRes?.games || 0)
      setAnalytics(analyticsRes)
      setPosRanks(ranksRes2 || null)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') closeCard() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeCard])

  useEffect(() => {
    let t
    const onDown = e => {
      if (cardRef.current && !cardRef.current.contains(e.target)) closeCard()
    }
    t = setTimeout(() => document.addEventListener('mousedown', onDown), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown) }
  }, [closeCard])

  // Position: right of anchor, top pinned below nav bar
  const posStyle = useMemo(() => {
    if (!anchorRect) return { top: NAV_HEIGHT + 8, left: 80 }
    const VW = window.innerWidth
    const VH = window.innerHeight
    let left = anchorRect.right + 12
    let top  = Math.max(NAV_HEIGHT + 8, anchorRect.top)
    if (left + CARD_W > VW - 8) left = anchorRect.left - CARD_W - 12
    left = Math.max(8, left)
    if (top + CARD_H_EST > VH - 8) top = Math.max(NAV_HEIGHT + 8, VH - CARD_H_EST - 8)
    return { top, left }
  }, [anchorRect])

  const pos        = player?.position || 'WR'
  const posColor   = POS_COLOR[pos]   || '#e8822a'
  const ptsTotal   = calcFantasyPts(totals, pos)
  const ptsPerG    = games > 0 ? ptsTotal / games : null
  const isBoomBust = useMemo(() => calcBoomBust(weekly), [weekly])
  const tbInfo     = tradeBlock ? TB_META[tradeBlock.status] : null
  const statGroups = STAT_GROUPS[pos] || STAT_GROUPS['WR']

  // Compute stat value for current viewMode
  function statVal(key) {
    return getComputedStat(key, totals, games, viewMode)
  }

  // Compute percentile using viewMode-appropriate benchmarks
  function statPct(key, invert = false) {
    const val = getComputedStat(key, totals, games, viewMode)
    return calcPercentile(key, val, pos, invert, viewMode)
  }

  async function toggleWatchlist() {
    if (!teamAbbrev || watchlistBusy) return
    setWatchlistBusy(true)
    try {
      if (onWatchlist) {
        await fetch(`${API_BASE}/watchlist/${playerId}`, {
          method: 'DELETE',
          headers: { 'x-team-abbrev': teamAbbrev },
        })
        setOnWatchlist(false)
      } else {
        await fetch(`${API_BASE}/watchlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-team-abbrev': teamAbbrev },
          body: JSON.stringify({ sleeper_id: playerId }),
        })
        setOnWatchlist(true)
      }
    } catch { /* ignore */ }
    setWatchlistBusy(false)
  }

  return (
    <div className="pc-overlay" ref={cardRef} style={posStyle}>

      {loading && (
        <div className="pc-loading">
          <div className="pc-spinner" />
          <span>Loading player…</span>
        </div>
      )}

      {!loading && !player && (
        <div className="pc-loading"><span>Player not found.</span></div>
      )}

      {!loading && player && (
        <>
          {/* ── Team color header (always shown, colored when on a team) ── */}
          <div className="pc-team-header" style={{
            background: contract?.teams?.abbrev
              ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
              : '#f5f4f2',
            borderBottom: contract?.teams?.abbrev ? 'none' : '1px solid #e0ddd8',
          }}>
            {contract?.teams?.abbrev ? (
              <>
                <img
                  src={LOGOS[contract.teams.abbrev]}
                  alt={contract.teams.name}
                  className="pc-team-logo"
                  onError={e => e.target.style.opacity = 0}
                />
                <span className="pc-team-header-name">{contract.teams.name}</span>
              </>
            ) : (
              <span className="pc-team-header-fa">Free Agent</span>
            )}
            <button className="pc-close" onClick={closeCard} aria-label="Close"
              style={{ color: contract?.teams?.abbrev ? 'rgba(255,255,255,0.7)' : '#999' }}>×</button>
          </div>

          {/* ── Player bio ── */}
          <div className="pc-header">
            <div className="pc-headshot-wrap">
              <img
                src={headshotUrl(playerId)}
                alt={player.full_name}
                className="pc-headshot"
                onError={e => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.full_name || 'P')}&background=ddd8d2&color=666&size=128`
                }}
              />
            </div>
            <div className="pc-bio">
              <div className="pc-bio-main">
                <div>
                  <div className="pc-name-row">
                    <span className="pc-name">{player.full_name}</span>
                    <span className="pc-pos-badge" style={{ background: posColor }}>{pos}</span>
                  </div>
                  <div className="pc-meta-line">
                    <span className="pc-nfl-team">{player.nfl_team || 'FA'}</span>
                    {player.age && <><span className="pc-sep">·</span><span>Age {player.age}</span></>}
                    {player.bye_week && (
                      <><span className="pc-sep">·</span>
                      <span className="pc-bye-chip">Bye {player.bye_week}</span></>
                    )}
                  </div>
                  {inSeason && ownership?.pct_owned != null && (
                    <div className="pc-owned">{ownership.pct_owned}% owned</div>
                  )}
                  {contract ? (
                    <div className="pc-contract-line">
                      <span className="pc-salary">${contract.salary}M / {contract.years}yr</span>
                    </div>
                  ) : null}
                  {!contract && <span className="pc-fa-chip">FREE AGENT</span>}
                </div>

                {/* Three plain figures rather than two bars. The bars spent
                    most of their space on a track and a percentile nobody asked
                    for, and the PROJ one was empty. */}
                <div className="pc-bio-stats">
                  <div className="pc-bio-stat">
                    <span className="pc-bio-stat-lbl">POS RK</span>
                    <span className="pc-bio-stat-val" style={{ color: pctBarColor(fptsPct(ptsPerG, pos)) }}>
                      {posRanks?.fpts_pg && pos ? `${pos}${posRanks.fpts_pg}` : '—'}
                    </span>
                  </div>
                  <div className="pc-bio-stat">
                    <span className="pc-bio-stat-lbl">PPG</span>
                    <span className="pc-bio-stat-val pc-bio-stat-val--hl">
                      {ptsPerG != null ? ptsPerG.toFixed(1) : '—'}
                    </span>
                  </div>
                  <div className="pc-bio-stat">
                    <span className="pc-bio-stat-lbl">PROJ</span>
                    <span className="pc-bio-stat-val">
                      {projPts != null ? Number(projPts).toFixed(1) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>



          {/* ── Badges ── */}
          {(player.injury_status || tbInfo || isBoomBust) && (
            <div className="pc-badges">
              {player.injury_status && (
                <span
                  className="pc-badge pc-badge--injury"
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setNewsCardTab('health'); setShowNewsCard(true) }}
                  title="Click for injury history"
                >🏥 {player.injury_status}</span>
              )}
              {tbInfo && (
                <span className="pc-badge" style={{
                  color: tbInfo.color,
                  borderColor: `${tbInfo.color}44`,
                  background: `${tbInfo.color}12`,
                }}>⇄ {tbInfo.label}</span>
              )}
              {isBoomBust          && <span className="pc-badge pc-badge--boom">💥 Boom/Bust</span>}
            </div>
          )}

          {/* ── Stats section ── */}
          <div className="pc-section">
            <div className="pc-section-hd">
              {availableSeasons.length > 1 && (
                <div className="pc-season-toggle">
                  {availableSeasons.map(yr => (
                    <button
                      key={yr}
                      className={`pc-season-btn${statSeason === yr ? ' pc-season-btn--active' : ''}`}
                      onClick={() => handleSeasonChange(yr)}
                      disabled={statsLoading}
                    >{yr}</button>
                  ))}
                </div>
              )}
              {/* The games chip and PTS/G repeated what the header now shows
                  as its own column, so the row carries the season label and the
                  toggle alone. */}
              <span className="pc-section-label">{statSeason} SEASON</span>
              <div className="pc-view-toggle">
                <button
                  className={`pc-toggle-btn ${viewMode === 'total' ? 'pc-toggle-btn--active' : ''}`}
                  onClick={() => setViewMode('total')}
                >Total</button>
                <button
                  className={`pc-toggle-btn ${viewMode === 'perGame' ? 'pc-toggle-btn--active' : ''}`}
                  onClick={() => setViewMode('perGame')}
                >Per G</button>
              </div>
                {/* Sits beside the toggle rather than taking a row of its
                    own -- it is a one-tap action, not a section. */}
                {teamAbbrev && (
                  <button
                    className={`pc-watchlist-btn ${onWatchlist ? 'pc-watchlist-btn--active' : ''}`}
                    onClick={toggleWatchlist}
                    disabled={watchlistBusy}
                  >
                    {watchlistBusy ? '…' : onWatchlist ? '★ Watching' : '☆ Watch'}
                  </button>
                )}
            </div>



            {games > 0 ? (
              <div className="pc-stat-groups">
                {statGroups.map(group => (
                  <div key={group.label} className="pc-stat-group">
                    <div className="pc-stat-group-label">{group.label}</div>
                    <div className="pc-statbars-row">
                      {group.stats.map(s => {
                        const rankField  = STAT_RANK_KEY[s.key]
                        const rankSource = viewMode === 'perGame' ? posRanks?.perGame : posRanks?.total
                        const rankNum    = rankField && rankSource ? rankSource[rankField] : null
                        const posLabel   = rankNum && pos ? `${pos}${rankNum}` : null
                        return (
                          <StatBar
                            key={s.key}
                            label={s.label}
                            value={fmtStat(statVal(s.key), s.key)}
                            pct={statPct(s.key, s.invert)}
                            posRank={posLabel}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pc-no-stats">No stats recorded for {statSeason}.</div>
            )}
          </div>

          {/* ── Recent weeks ── */}
          {teamSchedule.length > 0 && (
            <div className="pc-section">
              <div className="pc-section-hd">
                <span className="pc-section-label">RECENT WEEKS</span>
              </div>
              <RecentWeeks
                weekly={weekly}
                schedule={teamSchedule}
                projByWeek={projByWeek}
                pos={pos}
                currentWeek={schedCurWeek}
              />
            </div>
          )}

          {/* ── Analytics ── */}
          {analytics && games > 0 && (
            <AnalyticsSection analytics={analytics} pos={pos} analyticsRanks={posRanks?.analytics} />
          )}

          {/* ── Recent News (compact mini-feed) ── */}
          {miniNews.length > 0 && (
            <div className="pc-section">
              <div className="pc-section-hd">
                <span className="pc-section-label">RECENT NEWS</span>
                <button
                  className="pc-news-viewall"
                  onClick={() => { setNewsCardTab(miniNews[0]?.category || 'health'); setShowNewsCard(true) }}
                >View All →</button>
              </div>
              <div className="pc-mini-news-list">
                {miniNews.map((item, i) => (
                  <div key={i} className="pc-mini-news-item">
                    {item.type === 'late_scratch' && <span className="pc-mini-news-urgent">⚠</span>}
                    <span className="pc-mini-news-text">{item.headline}</span>
                    {item.is_new && <span className="pc-mini-news-new">NEW</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Upcoming Schedule ── */}
          {teamSchedule.length > 0 && (
            <div className="pc-section">
              <div className="pc-section-hd">
                <span className="pc-section-label">UPCOMING SCHEDULE</span>
              </div>
              <div className="pc-schedule-list">
                {teamSchedule
                  .filter(g => schedCurWeek == null || g.week >= schedCurWeek)
                  .slice(0, 5)
                  .map(g => (
                    <div key={g.week} className="pc-sched-row">
                      <span className="pc-sched-wk">WK {g.week}</span>
                      {g.opponent ? (
                        <>
                          <span className="pc-sched-vs">{g.is_home ? 'vs' : '@'}</span>
                          <DefenseRankBadge opponent={g.opponent} rankings={schedDefRanks} />
                          <OppRankCell opponent={g.opponent} position={pos} rankings={schedDefRanks} />
                        </>
                      ) : (
                        <span className="pc-sched-bye">BYE</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="pc-footer">
            <Link to={`/player/${playerId}`} className="pc-view-btn" onClick={closeCard}>
              View Full Profile →
            </Link>
          </div>
        </>
      )}

      {showNewsCard && (
        <NewsCard
          sleeperId={playerId}
          playerName={player?.full_name}
          defaultTab={newsCardTab}
          onClose={() => setShowNewsCard(false)}
        />
      )}
    </div>
  )
}

export default function PlayerCardPortal() {
  const { card } = usePlayerCard()
  if (!card) return null
  return createPortal(
    <PlayerCard playerId={card.playerId} anchorRect={card.anchorRect} />,
    document.body
  )
}
