import { createContext, useContext, useState, useCallback } from 'react'

const PlayerCardCtx = createContext(null)

export function PlayerCardProvider({ children }) {
  const [card, setCard] = useState(null) // { playerId, anchorRect }

  const openCard = useCallback((playerId, anchorRect) => {
    setCard(prev => {
      // Second click on same player closes the card
      if (prev?.playerId === playerId) return null
      return { playerId, anchorRect }
    })
  }, [])

  const closeCard = useCallback(() => setCard(null), [])

  return (
    <PlayerCardCtx.Provider value={{ card, openCard, closeCard }}>
      {children}
    </PlayerCardCtx.Provider>
  )
}

export function usePlayerCard() {
  return useContext(PlayerCardCtx)
}