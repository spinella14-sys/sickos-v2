import { useState, useEffect } from 'react'
import { SCORING } from '../data/league'

const SLEEPER_BASE = 'https://api.sleeper.app/v1'
const CDN = 'https://sleepercdn.com/content/nfl/players'
const NFL_LOGO = 'https://sleepercdn.com/images/team_logos/nfl'

// Module-level caches — persist across page navigations within same session
const sleeperCache = {}
const playerCache  = {}

async function fetchSleeper(url) {
  if (sleeperCache[url]) return sleeperCache[url]
  try {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    sleeperCache[url] = data
    return data
  } catch (e) {
    console.error('Sleeper fetch error:', url, e)
    return null
  }
}

// ─── HEADSHOT URLs ───────────────────────────────────────────────────────────
export function headshotUrl(sleeperId) {
  if (!sleeperId) return null
  return `${CDN}/thumb/${sleeperId}.jpg`
}

export function fullHeadshotUrl(sleeperId) {
  if (!sleeperId) return null
  return `${CDN}/${sleeperId}.jpg`
}

export function nflTeamLogoUrl(team) {
  if (!team) return null
  return `${NFL_LOGO}/${team.toLowerCase()}.png`
}

// ─── SINGLE PLAYER ───────────────────────────────────────────────────────────
// Hits backend DB first (fast, one row), falls back to Sleeper full list (slow)
export function usePlayer(sleeperId) {
  const [player, setPlayer] = useState(playerCache[sleeperId] || null)
  const [loading, setLoading] = useState(!playerCache[sleeperId])

  useEffect(() => {
    if (!sleeperId) return

    // Already cached — instant
    if (playerCache[sleeperId]) {
      setPlayer(playerCache[sleeperId])
      setLoading(false)
      return
    }

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

    fetch(`${API_BASE}/players/${sleeperId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.sleeper_id) {
          // Map backend shape → consistent player object
          const p = {
            full_name:     data.full_name,
            first_name:    data.first_name,
            last_name:     data.last_name,
            position:      data.position,
            team:          data.nfl_team,
            number:        data.jersey_number,
            height:        data.height,
            weight:        data.weight,
            age:           data.age,
            college:       data.college,
            injury_status: data.injury_status,
          }
          playerCache[sleeperId] = p
          setPlayer(p)
          setLoading(false)
        } else {
          // Backend not reachable — fall back to Sleeper (downloads all players)
          fetchSleeper(`${SLEEPER_BASE}/players/nfl`).then(all => {
            const p = all?.[sleeperId] || null
            if (p) playerCache[sleeperId] = p
            setPlayer(p)
            setLoading(false)
          })
        }
      })
      .catch(() => {
        fetchSleeper(`${SLEEPER_BASE}/players/nfl`).then(all => {
          const p = all?.[sleeperId] || null
          if (p) playerCache[sleeperId] = p
          setPlayer(p)
          setLoading(false)
        })
      })
  }, [sleeperId])

  return { player, loading }
}

// ─── ALL NFL PLAYERS (Players page) ──────────────────────────────────────────
export function usePlayers() {
  const [players, setPlayers] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSleeper(`${SLEEPER_BASE}/players/nfl`).then(data => {
      setPlayers(data)
      setLoading(false)
    })
  }, [])

  return { players, loading }
}

// ─── WEEKLY STATS (Sleeper direct — used as fallback only) ───────────────────
export function usePlayerWeeklyStats(sleeperId, season = 2025) {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sleeperId) return
    const fetches = Array.from({ length: 18 }, (_, i) => i + 1).map(week =>
      fetchSleeper(`${SLEEPER_BASE}/stats/nfl/${season}/${week}`)
        .then(data => ({ week, pts: data?.[sleeperId] ? calcPoints(data[sleeperId]) : null, raw: data?.[sleeperId] || null }))
    )
    Promise.all(fetches).then(results => {
      setStats(results.filter(r => r.pts !== null))
      setLoading(false)
    })
  }, [sleeperId, season])

  return { stats, loading }
}

// ─── TRENDING ────────────────────────────────────────────────────────────────
export function useTrending(type = 'add', sport = 'nfl') {
  const [trending, setTrending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSleeper(`${SLEEPER_BASE}/players/${sport}/trending/${type}?lookback_hours=24&limit=25`)
      .then(data => {
        setTrending(data || [])
        setLoading(false)
      })
  }, [type, sport])

  return { trending, loading }
}

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────
export function calcPoints(stats, pos) {
  if (!stats) return 0
  let pts = 0
  const p = (pos || '').toUpperCase()

  pts += (stats.pass_yd    || 0) * SCORING.pass_yd
  pts += (stats.pass_cmp   || 0) * SCORING.pass_cmp
  pts += (stats.pass_td    || 0) * SCORING.pass_td
  pts += (stats.pass_int   || 0) * SCORING.pass_int
  pts += (stats.pass_sack  || 0) * SCORING.pass_sack
  pts += (stats.pass_2pt   || 0) * SCORING.pass_2pt
  pts += (stats.rush_yd    || 0) * SCORING.rush_yd
  pts += (stats.rush_td    || 0) * SCORING.rush_td
  pts += (stats.rush_2pt   || 0) * SCORING.rush_2pt
  pts += (stats.fumbles_lost || 0) * SCORING.fumble_lost

  const recYdRate = (p === 'WR' || p === 'TE') ? SCORING.wr_rec_yd : SCORING.rb_rec_yd
  pts += (stats.rec    || 0) * SCORING.wr_rec
  pts += (stats.rec_yd || 0) * recYdRate
  pts += (stats.rec_td || 0) * SCORING.rec_td
  pts += (stats.rec_2pt|| 0) * SCORING.rec_2pt

  return Math.round(pts * 10) / 10
}

// ─── LEAGUE AVERAGES (for percentile calculations) ────────────────────────────
export const LEAGUE_AVGS = {
  QB: { pass_yd: 240, pass_td: 1.6, pass_cmp: 22, pass_int: 0.8, rush_yd: 18 },
  RB: { rush_yd: 58, rush_td: 0.45, rec: 3.2, rec_yd: 24, targets: 4.5 },
  WR: { rec: 5.1, rec_yd: 62, rec_td: 0.38, targets: 7.2 },
  TE: { rec: 3.8, rec_yd: 42, rec_td: 0.32, targets: 5.1 },
}

export function percentile(value, avg) {
  if (!avg || !value) return 0
  const ratio = value / avg
  if (ratio >= 2.0) return 99
  if (ratio >= 1.7) return 90
  if (ratio >= 1.4) return 80
  if (ratio >= 1.2) return 70
  if (ratio >= 1.0) return 55
  if (ratio >= 0.8) return 40
  if (ratio >= 0.6) return 25
  if (ratio >= 0.4) return 15
  return 5
}
