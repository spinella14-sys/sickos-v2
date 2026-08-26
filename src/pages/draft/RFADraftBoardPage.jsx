import { useState, useEffect, useCallback, useMemo } from 'react'
import RFAContractOfferModal from '../../components/rfa/RFAContractOfferModal'
import RFAPoolBrowserModal from '../../components/rfa/RFAPoolBrowserModal'
import PlayerLink from '../../components/PlayerCard/PlayerLink'
import './RFADraftBoardPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()
const WAVES = [2, 3, 4, 5]
const SLOTS_PER_WAVE = 3

export default function RFADraftBoardPage({ currentTeam }) {
  const [myPlayers, setMyPlayers] = useState([])   // Wave 1 targets: own incumbent RFAs
  const [poolPlayers, setPoolPlayers] = useState([]) // Waves 2-5 targets: everyone else's RFAs
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // rankings[1] = { [sleeper_id]: terms } for Wave 1 tenders (not slot-based)
  // rankings[2..5] = [terms|null, terms|null, terms|null] -- 3 fixed slots
  const [rankings, setRankings] = useState({ 1: {}, 2: [null, null, null], 3: [null, null, null], 4: [null, null, null], 5: [null, null, null] })

  const [modalTarget, setModalTarget] = useState(null) // { player, wave, slotIndex, existingTerms } | null
  const [browserWave, setBrowserWave] = useState(null)   // which wave's pool-browser popup is open
  const [browserSlot, setBrowserSlot] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [poolRes, rankingsRes] = await Promise.all([
        fetch(`${API}/rfa/pool-stats?season=${SEASON}`).then(r => r.ok ? r.json() : null),
        fetch(`${API}/rfa/autodraft/rankings?team=${currentTeam}`).then(r => r.ok ? r.json() : []),
      ])
      const allPlayers = poolRes?.players || []
      setMyPlayers(allPlayers.filter(p => p.incumbent_team === currentTeam))
      setPoolPlayers(allPlayers.filter(p => p.incumbent_team !== currentTeam))

      const next = { 1: {}, 2: [null, null, null], 3: [null, null, null], 4: [null, null, null], 5: [null, null, null] }
      ;(rankingsRes || []).forEach(r => {
        const terms = {
          y1_salary: r.y1_salary, guaranteed_years: r.guaranteed_years,
          signing_bonus: r.signing_bonus, years: r.years, structure: r.structure,
          non_guaranteed_final: r.non_guaranteed_final,
        }
        if (r.wave === 1) {
          next[1][r.sleeper_id] = terms
        } else if (WAVES.includes(r.wave)) {
          const slotIdx = (r.rank || 1) - 1
          if (slotIdx >= 0 && slotIdx < SLOTS_PER_WAVE) {
            next[r.wave][slotIdx] = { ...terms, sleeper_id: r.sleeper_id }
          }
        }
      })
      setRankings(next)
    } catch (e) {
      console.error('RFA Draft Board load error', e)
    } finally {
      setLoading(false)
    }
  }, [currentTeam])

  useEffect(() => { load() }, [load])

  // Every sleeper_id currently occupying a Wave 2-5 slot, across all waves --
  // used to prevent adding the same target to more than one slot.
  const usedSleeperIds = useMemo(() => {
    const ids = new Set()
    WAVES.forEach(w => {
      rankings[w].forEach(slot => { if (slot) ids.add(slot.sleeper_id) })
    })
    return ids
  }, [rankings])

  const playerById = useMemo(() => {
    const map = {}
    ;[...myPlayers, ...poolPlayers].forEach(p => { map[p.sleeper_id] = p })
    return map
  }, [myPlayers, poolPlayers])

  function openWave1Modal(player) {
    setModalTarget({ player, wave: 1, slotIndex: null, existingTerms: rankings[1][player.sleeper_id] })
  }

  function openSlotModal(wave, slotIndex, player) {
    setModalTarget({ player, wave, slotIndex, existingTerms: rankings[wave][slotIndex] })
    setSearchWave(null)
    setSearchSlot(null)
  }

  function handleModalSave(terms) {
    const { wave, slotIndex } = modalTarget
    setRankings(prev => {
      const next = { ...prev }
      if (wave === 1) {
        next[1] = { ...next[1], [terms.sleeper_id]: terms }
      } else {
        const arr = [...next[wave]]
        arr[slotIndex] = terms
        next[wave] = arr
      }
      return next
    })
    setModalTarget(null)
  }

  function removeSlot(wave, slotIndex) {
    setRankings(prev => {
      const next = { ...prev }
      const arr = [...next[wave]]
      arr[slotIndex] = null
      next[wave] = arr
      return next
    })
  }

  function removeTender(sleeperId) {
    setRankings(prev => {
      const next = { ...prev }
      const w1 = { ...next[1] }
      delete w1[sleeperId]
      next[1] = w1
      return next
    })
  }

  async function handleSaveAll() {
    setSaving(true)
    setSaveMessage('')
    try {
      const payload = []
      Object.entries(rankings[1]).forEach(([sleeperId, terms]) => {
        payload.push({ sleeper_id: sleeperId, wave: 1, rank: 1, ...terms })
      })
      WAVES.forEach(w => {
        rankings[w].forEach((slot, i) => {
          if (slot) payload.push({ sleeper_id: slot.sleeper_id, wave: w, rank: i + 1, ...slot })
        })
      })
      const res = await fetch(`${API}/rfa/autodraft/rankings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_abbrev: currentTeam, rankings: payload }),
      })
      setSaveMessage(res.ok ? 'Saved' : 'Save failed')
      if (res.ok) setTimeout(() => setSaveMessage(''), 2500)
    } catch (e) {
      setSaveMessage('Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="rfa-pool"><div className="rfa-pool__empty"><div className="rfa-pool__empty-title">Loading…</div></div></main>
  }

  return (
    <main className="rfa-draft-board">
      <div className="rfa-pool__header">
        <div className="rfa-pool__title-row">
          <span className="rfa-pool__title">RFA Draft Board</span>
          <button onClick={handleSaveAll} disabled={saving} className="draft-board-save-btn">
            {saving ? 'Saving…' : saveMessage || 'Save Board'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--draft-text-muted)', margin: '4px 0 0' }}>
          Set your tenders and pre-rank challenge targets for each wave. If you can't make the
          live draft, the system will submit these offers in priority order on your behalf.
        </p>
      </div>

      {/* ── Wave 1: Tender your own players ─────────────────────────────── */}
      <section className="rfa-draft-board__wave-section">
        <div className="rfa-draft-board__wave-header">Wave 1 — Tender Your Own Players</div>
        <div className="rfa-draft-board__wave-1-list">
          {myPlayers.length === 0 && (
            <div style={{ padding: 16, color: 'var(--draft-text-muted)', fontSize: 13 }}>No tender-eligible players on your roster.</div>
          )}
          {myPlayers.map(player => {
            const tendered = rankings[1][player.sleeper_id]
            return (
              <div key={player.sleeper_id} className="rfa-draft-board__slot-row">
                <div className="rfa-draft-board__slot-player">
                  <PlayerLink playerId={player.sleeper_id} style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>
                    {player.full_name}
                  </PlayerLink>
                  <span style={{ fontSize: 11, color: 'var(--draft-text-muted)', marginLeft: 8 }}>{player.position}</span>
                </div>
                {tendered ? (
                  <div className="rfa-draft-board__slot-terms">
                    3yr · Y1 ${tendered.y1_salary?.toFixed(2)} · Fully Guaranteed
                    {tendered.signing_bonus > 0 && ` · SB $${tendered.signing_bonus.toFixed(2)}`}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--draft-text-muted)' }}>Not tendered</div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="rfa-draft-board__btn-add" onClick={() => openWave1Modal(player)}>
                    {tendered ? 'EDIT' : 'SET TENDER'}
                  </button>
                  {tendered && (
                    <button className="rfa-draft-board__btn-remove" onClick={() => removeTender(player.sleeper_id)}>REMOVE</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Waves 2-5: challenge offer slots ────────────────────────────── */}
      {WAVES.map(wave => (
        <section key={wave} className="rfa-draft-board__wave-section">
          <div className="rfa-draft-board__wave-header">Wave {wave} — 3 Ranked Slots</div>
          <div className="rfa-draft-board__slots-grid">
            {rankings[wave].map((slot, slotIndex) => {
              const player = slot ? playerById[slot.sleeper_id] : null
              return (
                <div key={slotIndex} className="rfa-draft-board__slot-card">
                  <div className="rfa-draft-board__slot-rank">#{slotIndex + 1}</div>
                  {slot && player ? (
                    <>
                      <div className="rfa-draft-board__slot-player">
                        <PlayerLink playerId={player.sleeper_id} style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>
                          {player.full_name}
                        </PlayerLink>
                        <span style={{ fontSize: 11, color: 'var(--draft-text-muted)', marginLeft: 6 }}>{player.position}</span>
                      </div>
                      <div className="rfa-draft-board__slot-terms">
                        {slot.guaranteed_years}yr gtd · Y1 ${slot.y1_salary?.toFixed(2)}
                        {slot.signing_bonus > 0 && ` · SB $${slot.signing_bonus.toFixed(2)}`}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="rfa-draft-board__btn-add" onClick={() => openSlotModal(wave, slotIndex, player)}>EDIT</button>
                        <button className="rfa-draft-board__btn-remove" onClick={() => removeSlot(wave, slotIndex)}>REMOVE</button>
                      </div>
                    </>
                  ) : (
                    <button className="rfa-draft-board__btn-add-slot"
                      onClick={() => { setBrowserWave(wave); setBrowserSlot(slotIndex) }}>
                      + Add Player
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {browserWave != null && (
        <RFAPoolBrowserModal
          players={poolPlayers.filter(p => !usedSleeperIds.has(p.sleeper_id))}
          onSelect={p => { openSlotModal(browserWave, browserSlot, p) }}
          onClose={() => { setBrowserWave(null); setBrowserSlot(null) }}
        />
      )}

      {modalTarget && (
        <RFAContractOfferModal
          player={modalTarget.player}
          wave={modalTarget.wave}
          currentTeam={currentTeam}
          existingTerms={modalTarget.existingTerms}
          onSave={handleModalSave}
          onClose={() => setModalTarget(null)}
        />
      )}
    </main>
  )
}
