import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { fetchTeams, fetchTransactions, fetchScoreboard } from '../utils/api'

// ─── CONTEXT ─────────────────────────────────────────────────────────────────
const AppDataContext = createContext(null)

export function useAppData() {
  return useContext(AppDataContext)
}

// ─── PROVIDER ────────────────────────────────────────────────────────────────
export function AppDataProvider({ children, onProgress }) {
  const [teams,        setTeams]        = useState(null)
  const [transactions, setTransactions] = useState(null)
  const [scoreboard,   setScoreboard]   = useState(null)
  const [playerCache,  setPlayerCache]  = useState({})
  const [ready,        setReady]        = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    async function preload() {
      // Step 1 — teams (fast, small)
      onProgress(15, 'Connecting to league database')
      const teamsData = await fetchTeams()
      if (teamsData) setTeams(teamsData)

      // Step 2 — scoreboard current week
      onProgress(35, 'Loading all 16 teams')
      const sbData = await fetchScoreboard(14, 2025)
      if (sbData) setScoreboard(sbData)

      // Step 3 — transactions
      onProgress(58, 'Syncing player universe')
      const txnData = await fetchTransactions({ limit: 100 })
      if (txnData) setTransactions(txnData)

      // Step 4 — prime the player cache with a batch lookup
      // We fetch the top ~50 relevant players from the DB so
      // clicking any common player is instant
      onProgress(75, 'Loading transactions & history')
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
        const r = await fetch(`${API_BASE}/players?limit=200&position=QB`)
        if (r.ok) {
          const data = await r.json()
          const map = {}
          ;(data.players || []).forEach(p => {
            map[p.sleeper_id] = {
              full_name: p.full_name, first_name: p.first_name, last_name: p.last_name,
              position: p.position, team: p.nfl_team, number: p.jersey_number,
              height: p.height, weight: p.weight, age: p.age,
              college: p.college, injury_status: p.injury_status,
            }
          })
          setPlayerCache(prev => ({ ...prev, ...map }))
        }
      } catch (_) {}

      // Step 5 — RBs/WRs/TEs
      onProgress(88, 'Building scoreboard')
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
        for (const pos of ['RB', 'WR', 'TE']) {
          const r = await fetch(`${API_BASE}/players?limit=200&position=${pos}`)
          if (r.ok) {
            const data = await r.json()
            const map = {}
            ;(data.players || []).forEach(p => {
              map[p.sleeper_id] = {
                full_name: p.full_name, first_name: p.first_name, last_name: p.last_name,
                position: p.position, team: p.nfl_team, number: p.jersey_number,
                height: p.height, weight: p.weight, age: p.age,
                college: p.college, injury_status: p.injury_status,
              }
            })
            setPlayerCache(prev => ({ ...prev, ...map }))
          }
        }
      } catch (_) {}

      // Done
      onProgress(100, 'Ready')
      setTimeout(() => setReady(true), 800)
    }

    preload()
  }, [])

  const value = {
    teams:        teams        || [],
    transactions: transactions || [],
    scoreboard:   scoreboard   || [],
    playerCache,
    ready,
    // Helper to look up a cached player
    getCachedPlayer: (id) => playerCache[id] || null,
  }

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  )
}
