import { useState, useEffect } from 'react'
import { fetchPlayer, fetchPlayerWeekly } from '../utils/api'
import { usePlayer as useSleeperPlayer, usePlayerWeeklyStats } from './useSleeper'

/**
 * usePlayerData — tries backend API first, falls back to Sleeper direct.
 * This means the player page works in both states:
 *   - Drop 1 (no backend): uses Sleeper API directly
 *   - Drop 2+ (backend running): uses richer backend data with contract info
 */
export function usePlayerData(sleeperId) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [source, setSource]   = useState('loading') // 'api' | 'sleeper'

  // Fallback: Sleeper direct (always available)
  const { player: sleeperPlayer, loading: sleeperLoading } = useSleeperPlayer(sleeperId)
  const { stats: sleeperStats,   loading: statsLoading }   = usePlayerWeeklyStats(sleeperId)

  useEffect(() => {
    if (!sleeperId) return

    async function load() {
      setLoading(true)

      // Try backend first
      const apiData = await fetchPlayer(sleeperId)

      if (apiData && apiData.sleeper_id) {
        // Backend is live — use rich data
        setData({
          player: {
            full_name:     apiData.full_name,
            position:      apiData.position,
            team:          apiData.nfl_team,
            number:        apiData.jersey_number,
            height:        apiData.height,
            weight:        apiData.weight,
            age:           apiData.age,
            college:       apiData.college,
            injury_status: apiData.injury_status,
          },
          weeklyStats:  apiData.weekly_stats?.map(w => ({
            week: w.week,
            pts:  w.fantasy_pts,
            raw:  w,
          })) || [],
          seasonTotals: apiData.season_totals || {},
          gamesPlayed:  apiData.games_played  || 0,
          ptsPerGame:   apiData.pts_per_game  || 0,
          totalPts:     apiData.total_pts     || 0,
          contract:     apiData.contract      || null,
        })
        setSource('api')
      } else {
        // Backend not available — Sleeper fallback handled by hooks above
        setSource('sleeper')
      }

      setLoading(false)
    }

    load()
  }, [sleeperId])

  // If backend responded, use that
  if (source === 'api' && data) {
    return { ...data, loading, source }
  }

  // Sleeper fallback
  return {
    player:       sleeperPlayer,
    weeklyStats:  sleeperStats,
    seasonTotals: {},
    gamesPlayed:  sleeperStats?.length || 0,
    ptsPerGame:   sleeperStats?.length
      ? +(sleeperStats.reduce((a,w) => a + w.pts, 0) / sleeperStats.length).toFixed(2)
      : 0,
    totalPts:     sleeperStats?.reduce((a,w) => a + w.pts, 0) || 0,
    contract:     null,
    loading:      source === 'loading' ? loading : (sleeperLoading || statsLoading),
    source:       'sleeper',
  }
}

/**
 * useTeamsData — fetches teams from backend, falls back to static league.js
 */
export function useTeamsData() {
  const [teams,   setTeams]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('../utils/api').then(({ fetchTeams }) => {
      fetchTeams().then(data => {
        if (data && Array.isArray(data)) {
          setTeams(data)
        }
        setLoading(false)
      })
    })
  }, [])

  return { teams, loading }
}
