// ─── API CLIENT ──────────────────────────────────────────────────────────────
// Talks to the Express backend (Drop 2).
// Falls back to static data if backend is unreachable (for local dev without backend).

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    })
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
    return res.json()
  } catch (e) {
    console.warn(`[api] ${path} failed:`, e.message)
    return null
  }
}

// ─── TEAMS ───────────────────────────────────────────────────────────────────
export async function fetchTeams() {
  return apiFetch('/teams')
}

export async function fetchTeam(abbrev) {
  return apiFetch(`/teams/${abbrev}`)
}

// ─── PLAYERS ─────────────────────────────────────────────────────────────────
export async function fetchPlayer(sleeperId) {
  return apiFetch(`/players/${sleeperId}`)
}

export async function fetchPlayers({ position, team, search, page = 1, limit = 100 } = {}) {
  const params = new URLSearchParams()
  if (position && position !== 'All') params.set('position', position)
  if (team && team !== 'All')         params.set('team', team)
  if (search)                         params.set('search', search)
  params.set('page', page)
  params.set('limit', limit)
  return apiFetch(`/players?${params}`)
}

export async function fetchPlayerWeekly(sleeperId, season = 2025) {
  return apiFetch(`/players/${sleeperId}/weekly?season=${season}`)
}

// ─── SCOREBOARD ──────────────────────────────────────────────────────────────
export async function fetchScoreboard(week, season = 2025) {
  return apiFetch(`/scoreboard/week/${week}?season=${season}`)
}

// ─── TRANSACTIONS ────────────────────────────────────────────────────────────
export async function fetchTransactions({ limit = 50, type, team } = {}) {
  const params = new URLSearchParams({ limit })
  if (type) params.set('type', type)
  if (team) params.set('team', team)
  return apiFetch(`/transactions?${params}`)
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────
export async function adminSyncScores(week, password) {
  return apiFetch('/admin/sync-scores', {
    method: 'POST',
    headers: { 'x-admin-password': password },
    body: JSON.stringify({ week }),
  })
}

export async function adminSyncPlayers(password) {
  return apiFetch('/admin/sync-players', {
    method: 'POST',
    headers: { 'x-admin-password': password },
  })
}

export async function adminProcessTrade(tradeData, password) {
  return apiFetch('/admin/trade', {
    method: 'POST',
    headers: { 'x-admin-password': password },
    body: JSON.stringify(tradeData),
  })
}

export async function adminSignPlayer(contractData, password) {
  return apiFetch('/contracts', {
    method: 'POST',
    headers: { 'x-admin-password': password },
    body: JSON.stringify(contractData),
  })
}

export async function adminReleasePlayer(contractId, password) {
  return apiFetch(`/contracts/${contractId}`, {
    method: 'DELETE',
    headers: { 'x-admin-password': password },
  })
}

export async function fetchHealth() {
  return apiFetch('/health')
}

export async function fetchPlayerSeasons(sleeperId) {
  return apiFetch(`/players/${sleeperId}/seasons`)
}

export async function submitFABid(bidData) {
  return apiFetch('/bids', {
    method: 'POST',
    body: JSON.stringify(bidData),
  })
}

export async function fetchBids({ team, status } = {}) {
  const params = new URLSearchParams()
  if (team)   params.set('team', team)
  if (status) params.set('status', status)
  return apiFetch(`/bids?${params}`)
}

export async function processBid(bidId, status, adminNotes, password) {
  return apiFetch(`/bids/${bidId}`, {
    method: 'PATCH',
    headers: { 'x-admin-password': password },
    body: JSON.stringify({ status, admin_notes: adminNotes }),
  })
}
