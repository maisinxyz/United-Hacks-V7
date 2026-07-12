/**
 * ShotTimingOverlay — NBA 2K-style "Green Release" timing mechanic.
 *
 * A cursor oscillates rapidly across a horizontal bar. The player must
 * tap/click when the cursor is inside the green zone for a perfect shot.
 *
 * Props:
 *  - stamina: 0–100, controls the width of the green zone
 *  - onResult: callback with timing result { zone, deviation, staminaCost }
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export type TimingZone = 'green' | 'yellow' | 'red'

export interface TimingResult {
  zone: TimingZone
  /** Random deviation multiplier: 0 = perfect, up to ~1 = worst */
  deviation: number
  /** How much stamina this costs */
  staminaCost: number
}

interface Props {
  stamina: number
  onResult: (result: TimingResult) => void
}

// Cursor speed: full bar traversal in ~0.8s, so green at 0.2s wide is tight
const CURSOR_SPEED = 2.5 // full sweeps per second
const BAR_WIDTH = 400
const BAR_HEIGHT = 56

export default function ShotTimingOverlay({ stamina, onResult }: Props) {
  const [cursorPos, setCursorPos] = useState(0) // 0..1
  const [locked, setLocked] = useState(false)
  const [resultZone, setResultZone] = useState<TimingZone | null>(null)
  const animRef = useRef<number>(0)
  const startTime = useRef(performance.now())
  const directionRef = useRef(1)

  // Green zone width scales with stamina: 100 stamina = 20% width, 0 stamina = 5%
  const greenWidth = 0.05 + (stamina / 100) * 0.15 // 5% to 20%
  const yellowWidth = 0.12 // fixed 12% on each side of green
  const greenStart = 0.5 - greenWidth / 2
  const greenEnd = 0.5 + greenWidth / 2
  const yellowStart = greenStart - yellowWidth
  const yellowEnd = greenEnd + yellowWidth

  // Animate the cursor
  useEffect(() => {
    if (locked) return

    const animate = (time: number) => {
      const elapsed = (time - startTime.current) / 1000
      // Ping-pong between 0 and 1
      const cycle = elapsed * CURSOR_SPEED
      const t = cycle % 2
      const pos = t <= 1 ? t : 2 - t
      setCursorPos(pos)
      animRef.current = requestAnimationFrame(animate)
    }

    startTime.current = performance.now()
    animRef.current = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animRef.current)
  }, [locked])

  const handleTap = useCallback(() => {
    if (locked) return
    setLocked(true)
    cancelAnimationFrame(animRef.current)

    // Determine which zone the cursor landed in
    let zone: TimingZone
    let deviation: number
    let staminaCost: number

    if (cursorPos >= greenStart && cursorPos <= greenEnd) {
      zone = 'green'
      deviation = 0
      staminaCost = 5
    } else if (cursorPos >= yellowStart && cursorPos <= yellowEnd) {
      zone = 'yellow'
      // How far from the green edge?
      const distFromGreen = cursorPos < greenStart
        ? (greenStart - cursorPos) / yellowWidth
        : (cursorPos - greenEnd) / yellowWidth
      deviation = 0.3 + distFromGreen * 0.4 // 0.3 to 0.7
      staminaCost = 20
    } else {
      zone = 'red'
      deviation = 0.7 + Math.random() * 0.3 // 0.7 to 1.0
      staminaCost = 35
    }

    setResultZone(zone)

    // Brief flash of the result, then fire callback
    setTimeout(() => {
      onResult({ zone, deviation, staminaCost })
    }, 600)
  }, [locked, cursorPos, greenStart, greenEnd, yellowStart, yellowEnd, yellowWidth, onResult])

  // Also listen for spacebar
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        handleTap()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleTap])

  const cursorX = cursorPos * BAR_WIDTH

  // Zone colors
  const zoneFlashColor = resultZone === 'green' ? '#22c55e' : resultZone === 'yellow' ? '#eab308' : '#ef4444'

  return (
    <div
      className="overlay-card frosted bottom-center-panel select-none"
      style={{ cursor: 'pointer', padding: '24px 32px', maxWidth: '520px', width: 'min(95vw, 520px)' }}
      onClick={handleTap}
    >
      <div className="step-header" style={{ marginBottom: 8 }}>
        <span className="step-number">⚡</span>
        <h2 style={{ fontSize: '1.2rem' }}>Time Your Shot!</h2>
      </div>

      {/* Stamina display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stamina</span>
        <div style={{
          flex: 1, height: 8, borderRadius: 4,
          background: 'rgba(0,0,0,0.08)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${stamina}%`, height: '100%', borderRadius: 4,
            background: stamina > 60 ? 'linear-gradient(90deg, #22c55e, #4ade80)' :
                        stamina > 30 ? 'linear-gradient(90deg, #eab308, #facc15)' :
                                       'linear-gradient(90deg, #ef4444, #f87171)',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', minWidth: 36 }}>{Math.round(stamina)}%</span>
      </div>

      {/* Timing bar */}
      <svg
        viewBox={`0 0 ${BAR_WIDTH} ${BAR_HEIGHT}`}
        style={{ width: '100%', maxHeight: 60, display: 'block' }}
      >
        {/* Red background */}
        <rect x={0} y={8} width={BAR_WIDTH} height={BAR_HEIGHT - 16} rx={8} fill="#fecaca" />

        {/* Yellow zones */}
        <rect x={yellowStart * BAR_WIDTH} y={8} width={yellowWidth * BAR_WIDTH} height={BAR_HEIGHT - 16} rx={0} fill="#fde68a" />
        <rect x={greenEnd * BAR_WIDTH} y={8} width={yellowWidth * BAR_WIDTH} height={BAR_HEIGHT - 16} rx={0} fill="#fde68a" />

        {/* Green zone */}
        <rect x={greenStart * BAR_WIDTH} y={8} width={greenWidth * BAR_WIDTH} height={BAR_HEIGHT - 16} rx={0} fill="#86efac" />

        {/* Zone borders */}
        <rect x={0} y={8} width={BAR_WIDTH} height={BAR_HEIGHT - 16} rx={8} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth={1.5} />

        {/* Cursor line */}
        <line
          x1={cursorX} y1={2} x2={cursorX} y2={BAR_HEIGHT - 2}
          stroke={locked ? zoneFlashColor : '#0f172a'}
          strokeWidth={locked ? 5 : 3}
          strokeLinecap="round"
        />

        {/* Cursor diamond */}
        {!locked && (
          <polygon
            points={`${cursorX},0 ${cursorX + 6},6 ${cursorX},12 ${cursorX - 6},6`}
            fill="#0f172a"
          />
        )}

        {/* Result flash */}
        {locked && resultZone && (
          <text
            x={cursorX}
            y={BAR_HEIGHT / 2 + 5}
            textAnchor="middle"
            fill={zoneFlashColor}
            fontSize="18"
            fontWeight="900"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
          >
            {resultZone === 'green' ? '🟢 PERFECT' : resultZone === 'yellow' ? '🟡 GOOD' : '🔴 MISS'}
          </text>
        )}
      </svg>

      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', marginTop: 8, fontWeight: 600 }}>
        {locked ? '' : 'Tap or press SPACE to kick!'}
      </p>
    </div>
  )
}
