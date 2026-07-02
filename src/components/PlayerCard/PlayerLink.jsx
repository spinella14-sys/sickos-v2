import { useRef } from 'react'
import { usePlayerCard } from './PlayerCardContext'

/**
 * Drop-in wrapper for any player name. Single click opens the player card.
 * Use everywhere except the Players database page (use plain <Link> there).
 *
 * Usage: <PlayerLink playerId={player.sleeper_id}>{player.full_name}</PlayerLink>
 */
export default function PlayerLink({ playerId, children, className = '', style }) {
  const ref = useRef(null)
  const ctx = usePlayerCard()

  function handleClick(e) {
    if (!ctx || !playerId) return
    e.preventDefault()
    e.stopPropagation()
    ctx.openCard(playerId, ref.current?.getBoundingClientRect())
  }

  return (
    <span
      ref={ref}
      className={`plink${className ? ` ${className}` : ''}`}
      style={style}
      onClick={handleClick}
      role="button"
      tabIndex={playerId ? 0 : -1}
      onKeyDown={e => e.key === 'Enter' && handleClick(e)}
    >
      {children}
    </span>
  )
}