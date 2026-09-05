import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import PlayerLink from '../../components/PlayerCard/PlayerLink'
import ContractOfferModal from '../../components/contracts/ContractOfferModal'
import {
  TOTAL_WAVES, TIER_FOR_WAVE, TIER_NAMES, TIER_SHORT,
  minBidForTier, tierMinLabel, isMaxTier,
} from '../../constants/ufaTiers'
import './UFADraftBoardPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SLOTS_PER_WAVE = 3
const ALL_WAVES = Array.from({ length: TOTAL_WAVES }, (_, i) => i + 1)
const POS_COLOR = { QB:'#E74C3C', RB:'#27AE60', WR:'#3498DB', TE:'#9B59B6' }

const emptyBoard = () => {
  const b = {}
  ALL_WAVES.forEach(w => { b[w] = Array(SLOTS_PER_WAVE).fill(null) })
  return b
}

export default function UFADraftBoardPage({ currentTeam }) {
  const [pool, setPool]           = useState([])
  const [board, setBoard]         = useState(emptyBoard)
  const [currentWave, setCurrentWave] = useState(1)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // Self-imposed ceiling on TOTAL committed salary. A bid that would push the
  // team past this is skipped at award time and the player falls to the next
  // bidder -- it behaves like a personal hard cap.
  const [salaryCeiling, setSalaryCeiling] = useState('')
  const [optedIn, setOptedIn]     = useState(false)
  const [capData, setCapData]     = useState(null)

  // Two-step slot editing, matching the RFA board: pick a player, then set
  // terms in the shared ContractOfferModal.
  const [picking, setPicking]     = useState(null)  // { wave, slotIndex }
  const [offering, setOffering]   = useState(null)  // { wave, slotIndex, player, existing }

  const [expandedWaves, setExpandedWaves] = useState(() => {
    const init = {}
    ALL_WAVES.forEach(w => { init[w] = false })
    return init
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [poolRes, rankingsRes, optinRes, stateRes, capRes] = await Promise.all([
        fetch(`${API}/ufa/pool`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/ufa/autodraft/rankings?team=${currentTeam}`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/ufa/autodraft/opt-in?team=${currentTeam}`).then(r => r.ok ? r.json() : {}),
        fetch(`${API}/ufa/state`).then(r => r.ok ? r.json() : null),
        fetch(`${API}/ufa/cap/${currentTeam}`).then(r => r.ok ? r.json() : null),
      ])

      setPool(Array.isArray(poolRes) ? poolRes : [])
      setCapData(capRes)

      const wave = stateRes?.current_wave || 1
      setCurrentWave(wave)
      setExpandedWaves(prev => ({ ...prev, [wave]: true }))

      const next = emptyBoard()
      ;(rankingsRes || []).forEach(r => {
        if (!next[r.wave]) return
        const idx = (r.rank || 1) - 1
        if (idx < 0 || idx >= SLOTS_PER_WAVE) return
        next[r.wave][idx] = {
          sleeper_id: r.sleeper_id,
          y1_salary: r.y1_salary,
          signing_bonus: r.signing_bonus || 0,
          years: r.years || 3,
          guaranteed_years: r.guaranteed_years,
          non_guaranteed_final: r.guaranteed_years < (r.years || 3),
          structure: r.structure || 'ascending',
          withdraw_if_higher_wins: !!r.withdraw_if_higher_wins,
          conditional_on_cap: !!r.conditional_on_cap,
          no_carry_over: !!r.no_carry_over,
          is_max_bid: !!r.is_max_bid,
        }
      })
      setBoard(next)

      setOptedIn(!!optinRes?.opted_in)
      setSalaryCeiling(optinRes?.salary_ceiling != null ? String(optinRes.salary_ceiling) : '')
    } catch (e) {
      console.error('UFA Draft Board load error', e)
    } finally {
      setLoading(false)
    }
  }, [currentTeam])

  useEffect(() => { load() }, [load])

  // If a new wave opens while the board is mounted, expand it without
  // collapsing anything the manager already opened.
  const lastAutoExpandedRef = useRef(null)
  useEffect(() => {
    if (currentWave !== lastAutoExpandedRef.current) {
      setExpandedWaves(prev => ({ ...prev, [currentWave]: true }))
      lastAutoExpandedRef.current = currentWave
    }
  }, [currentWave])

  const playerById = useMemo(() => {
    const m = {}
    pool.forEach(p => { m[p.sleeper_id] = p })
    return m
  }, [pool])

  // A player may only occupy one slot across the entire board.
  const usedSleeperIds = useMemo(() => {
    const ids = new Set()
    ALL_WAVES.forEach(w => board[w].forEach(s => { if (s) ids.add(s.sleeper_id) }))
    return ids
  }, [board])

  const filledCount = useMemo(
    () => ALL_WAVES.reduce((n, w) => n + board[w].filter(Boolean).length, 0),
    [board]
  )

  const toggleWave = (w) => setExpandedWaves(prev => ({ ...prev, [w]: !prev[w] }))

  function setSlot(wave, slotIndex, terms) {
    setBoard(prev => {
      const next = { ...prev }
      const arr = [...next[wave]]
      arr[slotIndex] = terms
      next[wave] = arr
      return next
    })
  }

  async function saveBoard() {
    setSaving(true)
    setSaveMessage('')
    try {
      const rankings = []
      ALL_WAVES.forEach(w => {
        board[w].forEach((slot, i) => {
          if (!slot) return
          rankings.push({ ...slot, wave: w, rank: i + 1 })
        })
      })

      const rankRes = await fetch(`${API}/ufa/autodraft/rankings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_abbrev: currentTeam, rankings }),
      })
      if (!rankRes.ok) throw new Error((await rankRes.json().catch(() => ({}))).error || 'Failed to save board')

      const ceilingVal = salaryCeiling.trim() === '' ? null : parseFloat(salaryCeiling)
      if (ceilingVal != null && (Number.isNaN(ceilingVal) || ceilingVal < 0)) {
        throw new Error('Salary ceiling must be a non-negative number')
      }
      const optRes = await fetch(`${API}/ufa/autodraft/opt-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_abbrev: currentTeam, opted_in: optedIn, salary_ceiling: ceilingVal }),
      })
      if (!optRes.ok) throw new Error((await optRes.json().catch(() => ({}))).error || 'Failed to save settings')

      setSaveMessage(`Saved ${rankings.length} target${rankings.length === 1 ? '' : 's'}`)
      setTimeout(() => setSaveMessage(''), 4000)
    } catch (e) {
      setSaveMessage(e.message || 'Save failed')
      setTimeout(() => setSaveMessage(''), 6000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="ufab-loading">Loading draft board...</div>

  const offeringTier = offering ? TIER_FOR_WAVE(offering.wave) : null

  return (
    <div className="ufab">
      <div className="ufab__header">
        <div>
          <h1 className="ufab__title">UFA Draft Board</h1>
          <p className="ufab__sub">
            Targets you save here are submitted automatically when each wave opens, whether or not
            you're in the draft room. A target is skipped -- never repriced -- if it's under the wave's
            minimum, you can't afford it, or you've already won a player that wave.
          </p>
        </div>
        <div className="ufab__header-actions">
          <span className="ufab__filled">{filledCount} / {TOTAL_WAVES * SLOTS_PER_WAVE} slots</span>
          <button className="ufab__save" onClick={saveBoard} disabled={saving}>
            {saving ? 'Saving...' : 'Save Board'}
          </button>
        </div>
      </div>

      {saveMessage && <div className="ufab__save-msg">{saveMessage}</div>}

      <div className="ufab__settings">
        <label className="ufab__setting">
          <span className="ufab__setting-label">Walkaway salary ceiling</span>
          <div className="ufab__setting-input">
            <span>$</span>
            <input
              type="number" step="0.01" min="0" placeholder="none"
              value={salaryCeiling}
              onChange={e => setSalaryCeiling(e.target.value)}
            />
          </div>
          <span className="ufab__setting-hint">
            Acts as your own hard cap. Any bid that would push your total committed salary past this
            is skipped and the player goes to the next bidder. Leave blank for no ceiling.
            {capData && <> Currently committed: <strong>${Number(capData.cap_used).toFixed(2)}</strong>.</>}
          </span>
        </label>

        <label className="ufab__setting ufab__setting--toggle">
          <input type="checkbox" checked={optedIn} onChange={e => setOptedIn(e.target.checked)} />
          <span>
            <span className="ufab__setting-label">Auto-mark me ready each wave</span>
            <span className="ufab__setting-hint">
              Lets a wave close early once everyone is ready. Your saved targets are submitted
              either way -- this only affects wave timing.
            </span>
          </span>
        </label>
      </div>

      <div className="ufab__waves">
        {ALL_WAVES.map(w => {
          const tier = TIER_FOR_WAVE(w)
          const slots = board[w]
          const filled = slots.filter(Boolean).length
          const isOpen = !!expandedWaves[w]
          return (
            <div key={w} className="ufab__wave-section">
              <button className="ufab__wave-header" onClick={() => toggleWave(w)}>
                <span className="ufab__wave-name">
                  {isOpen ? String.fromCharCode(9662) : String.fromCharCode(9656)} Wave {w}{w === currentWave ? ' (current)' : ''}
                  <span className="ufab__wave-tier"> &middot; {TIER_SHORT[tier]}</span>
                </span>
                <span className="ufab__wave-count">{filled}/{SLOTS_PER_WAVE}</span>
              </button>

              {isOpen && (
                <div className="ufab__wave-body">
                  <div className="ufab__wave-note">
                    {isMaxTier(tier)
                      ? 'Wave 1 requires a max contract -- the salary is fixed by position. Compete on signing bonus, years, and guarantees.'
                      : `Minimum offer this wave: ${tierMinLabel(tier)}`}
                  </div>
                  {slots.map((slot, i) => (
                    <SlotRow
                      key={i}
                      tier={tier} slotIndex={i} slot={slot}
                      player={slot ? playerById[slot.sleeper_id] : null}
                      onEdit={() => {
                        if (slot) {
                          setOffering({
                            wave: w, slotIndex: i,
                            player: playerById[slot.sleeper_id],
                            existing: slot,
                          })
                        } else {
                          setPicking({ wave: w, slotIndex: i })
                        }
                      }}
                      onClear={() => setSlot(w, i, null)}
                      onToggleCarry={() => setSlot(w, i, { ...slot, no_carry_over: !slot.no_carry_over })}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {picking && (
        <PlayerPickerModal
          wave={picking.wave}
          pool={pool}
          usedSleeperIds={usedSleeperIds}
          onClose={() => setPicking(null)}
          onPick={player => {
            setOffering({ wave: picking.wave, slotIndex: picking.slotIndex, player, existing: null })
            setPicking(null)
          }}
        />
      )}

      {offering && offering.player && (
        <ContractOfferModal
          player={offering.player}
          currentTeam={currentTeam}
          existingTerms={offering.existing}
          title={`Wave ${offering.wave} Target`}
          subtitle={TIER_NAMES[offeringTier]}
          floor={isMaxTier(offeringTier) ? null : minBidForTier(offeringTier, offering.player.position)}
          floorMode="y1"
          salaryFixed={isMaxTier(offeringTier)}
          yearsOptions={[1, 2, 3, 4]}
          structureOptions={['ascending', 'flat', 'descending']}
          showWithdrawIfHigher
          showCarryOver
          saveLabel="Save Target"
          onClose={() => setOffering(null)}
          onSave={terms => {
            setSlot(offering.wave, offering.slotIndex, {
              ...terms,
              conditional_on_cap: false,
              is_max_bid: isMaxTier(offeringTier),
            })
            setOffering(null)
          }}
        />
      )}
    </div>
  )
}

// -- One slot in a wave ------------------------------------------------------
function SlotRow({ tier, slotIndex, slot, player, onEdit, onClear, onToggleCarry }) {
  if (!slot) {
    return (
      <button className="ufab__slot ufab__slot--empty" onClick={onEdit}>
        <span className="ufab__slot-rank">{slotIndex + 1}</span>
        <span className="ufab__slot-add">+ Add target</span>
      </button>
    )
  }

  const name = player?.full_name || slot.sleeper_id
  const pos  = player?.position

  return (
    <div className="ufab__slot">
      <span className="ufab__slot-rank">{slotIndex + 1}</span>
      <span className="ufab__slot-player">
        {pos && <span className="ufab__slot-pos" style={{ color: POS_COLOR[pos] }}>{pos}</span>}
        <PlayerLink playerId={slot.sleeper_id} className="ufab__slot-name">{name}</PlayerLink>
        {player?.nfl_team && <span className="ufab__slot-team">{player.nfl_team}</span>}
      </span>
      <span className="ufab__slot-terms">
        {isMaxTier(tier)
          ? <strong>MAX</strong>
          : <strong>${Number(slot.y1_salary).toFixed(2)}</strong>}
        <span className="ufab__slot-detail">
          {slot.years}yr &middot; {slot.guaranteed_years} gtd
          {slot.signing_bonus > 0 && <> &middot; ${Number(slot.signing_bonus).toFixed(2)} SB</>}
          {slot.withdraw_if_higher_wins && <> &middot; withdraw if higher wins</>}
          {slot.no_carry_over && <> &middot; this wave only</>}
        </span>
      </span>
      <span className="ufab__slot-actions">
        <button
          onClick={onToggleCarry}
          title={slot.no_carry_over
            ? 'This target will NOT move to the next wave if unawarded'
            : 'If unawarded, this target moves to the next wave at this price'}
          style={{ color: slot.no_carry_over ? 'var(--red)' : 'var(--green)' }}
        >{slot.no_carry_over ? 'This wave only' : 'Carries over'}</button>
        <button onClick={onEdit}>Edit</button>
        <button onClick={onClear} className="ufab__slot-remove">Remove</button>
      </span>
    </div>
  )
}

// -- Player picker -----------------------------------------------------------
function PlayerPickerModal({ wave, pool, usedSleeperIds, onClose, onPick }) {
  const [search, setSearch] = useState('')
  const [posFilter, setPos] = useState('ALL')

  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pool
      .filter(p => p.status === 'available')
      .filter(p => posFilter === 'ALL' || p.position === posFilter)
      .filter(p => !q || p.full_name?.toLowerCase().includes(q))
      .filter(p => !usedSleeperIds.has(p.sleeper_id))
      .slice(0, 60)
  }, [pool, search, posFilter, usedSleeperIds])

  return (
    <div className="ufab-modal__backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ufab-modal">
        <div className="ufab-modal__header">
          <span>Wave {wave} &middot; Choose a player</span>
          <button onClick={onClose} className="ufab-modal__close">&times;</button>
        </div>

        <div className="ufab-modal__search">
          <input
            autoFocus placeholder="Search players..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <div className="ufab-modal__pos">
            {['ALL','QB','RB','WR','TE'].map(p => (
              <button key={p} className={posFilter === p ? 'active' : ''} onClick={() => setPos(p)}>{p}</button>
            ))}
          </div>
        </div>

        <div className="ufab-modal__results">
          {results.length === 0 && <div className="ufab-modal__empty">No available players match.</div>}
          {results.map(p => (
            <button key={p.sleeper_id} className="ufab-modal__result" onClick={() => onPick(p)}>
              <span className="ufab__slot-pos" style={{ color: POS_COLOR[p.position] }}>{p.position}</span>
              <span>{p.full_name}</span>
              <span className="ufab-modal__result-team">{p.nfl_team}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
