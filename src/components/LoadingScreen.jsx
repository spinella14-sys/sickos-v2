import { useEffect, useState, useRef } from 'react'
import leagueLogo from '../assets/logos/LEAGUE.png'
import './LoadingScreen.css'

export default function LoadingScreen({ progress = 0, stepLabel = '', onComplete }) {
  const [displayPct, setDisplayPct] = useState(0)
  const [fadeOut,    setFadeOut]    = useState(false)
  const [showReady,  setShowReady]  = useState(false)
  const [visible,    setVisible]    = useState(false)
  const rafRef  = useRef(null)
  const current = useRef(0)

  // Fade in after mount
  useEffect(() => {
    setTimeout(() => setVisible(true), 50)
  }, [])

  // Smoothly animate display pct toward real progress
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    function tick() {
      const diff = progress - current.current
      if (Math.abs(diff) < 0.5) {
        current.current = progress
        setDisplayPct(Math.round(progress))
        if (progress >= 100) {
          setShowReady(true)
          setTimeout(() => {
            setFadeOut(true)
            setTimeout(onComplete, 600)
          }, 700)
        }
        return
      }
      // Ease toward target
      current.current += diff * 0.08
      setDisplayPct(Math.round(current.current))
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [progress])

  const YARD_LINES = [10, 20, 30, 40, 50, 60, 70, 80, 90]

  return (
    <div className={`ls-root ${fadeOut ? 'ls-fade-out' : ''}`}>
      <div className="ls-texture" />

      {/* Corner accents */}
      <div className="ls-corner ls-corner--tl" />
      <div className="ls-corner ls-corner--tr" />
      <div className="ls-corner ls-corner--bl" />
      <div className="ls-corner ls-corner--br" />

      <div className="ls-body">
        {/* League logo */}
        <div className={`ls-logo-wrap ${visible ? 'ls-logo--visible' : ''}`}>
          <img src={leagueLogo} alt="Sickos Only" className="ls-logo" />
        </div>

        {/* Progress */}
        <div className={`ls-progress-wrap ${visible ? 'ls-progress--visible' : ''}`}>
          <div className="ls-label">
            {showReady ? 'LET\'S RIDE' : (stepLabel || 'Loading') + '…'}
          </div>

          {/* Football progress track */}
          <div className="ls-track">
            {YARD_LINES.map(m => (
              <div key={m} className="ls-yardline" style={{ left: `${m}%` }} />
            ))}

            {/* Green field fill */}
            <div className="ls-fill" style={{ width: `${displayPct}%` }} />

            {/* Football riding the bar */}
            <div
              className="ls-football-wrap"
              style={{ left: `calc(${displayPct}% - 14px)` }}
            >
              <span className="ls-football">🏈</span>
            </div>
          </div>

          <div className="ls-pct">{displayPct}%</div>
        </div>
      </div>
    </div>
  )
}
