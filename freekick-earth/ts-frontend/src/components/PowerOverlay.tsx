/**
 * PowerOverlay — Floating power selector with detailed animated SVG leg.
 */

import { useRef, useCallback } from 'react'

interface Props {
  power: number
  onUpdate: (power: number) => void
  onNext: () => void
  onBack: () => void
}

const MIN_POWER = 10
const MAX_POWER = 40

export default function PowerOverlay({ power, onUpdate, onNext, onBack }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const fraction = (power - MIN_POWER) / (MAX_POWER - MIN_POWER)

  const updateFromY = useCallback((clientY: number) => {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const y = rect.bottom - clientY
    const pct = Math.max(0, Math.min(1, y / rect.height))
    const val = MIN_POWER + pct * (MAX_POWER - MIN_POWER)
    onUpdate(Math.round(val * 2) / 2)
  }, [onUpdate])

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateFromY(e.clientY)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging.current) updateFromY(e.clientY)
  }
  const handlePointerUp = () => dragging.current = false

  const getBarColor = () => {
    if (fraction < 0.33) return '#22c55e'
    if (fraction < 0.66) return '#f59e0b'
    return '#ef4444'
  }

  // Animation math for leg
  // As power increases, thigh gets thicker, calf gets thicker
  const thighWidth = 20 + fraction * 12
  const calfWidth = 15 + fraction * 10
  
  // Swing animation mapped to fraction just for visual feedback, 
  // or we could let CSS handle a continuous idle swing.
  // We will do a continuous CSS idle animation, but scale the leg by power.
  const scale = 0.8 + fraction * 0.4

  return (
    <div className="overlay-card frosted side-panel left-panel">
      <div className="step-header">
        <span className="step-number">02</span>
        <h2>Shot Power</h2>
      </div>

      <div className="power-container">
        {/* Animated SVG Leg and Ball */}
        <div className="leg-illustration" style={{ transform: `scale(${scale})` }}>
          <svg viewBox="0 0 200 200" width="160" height="160">
            <g className="leg-swing">
              {/* Thigh (Soccer shorts & leg) */}
              <path
                d={`M 110 30 C 120 30 130 50 120 90 C 110 90 95 60 90 35 Z`}
                fill="#3b82f6" // blue shorts
                stroke="#1e3a8a"
                strokeWidth="2"
              />
              <path
                d={`M 120 90 C 125 110 115 130 100 130 C 90 130 95 110 100 90 Z`}
                fill="#fca5a5" // skin
                stroke="#dc2626"
                strokeWidth={thighWidth / 15}
              />
              {/* Calf (Sock) */}
              <path
                d={`M 100 130 C 110 150 95 170 80 175 C 70 170 85 150 90 130 Z`}
                fill="#ffffff" // white sock
                stroke="#d1d5db"
                strokeWidth={calfWidth / 15}
              />
              <path d="M 85 140 L 105 140" stroke="#3b82f6" strokeWidth="4" /> {/* sock stripes */}
              <path d="M 83 148 L 102 148" stroke="#3b82f6" strokeWidth="4" />
              {/* Boot */}
              <path
                d="M 80 175 C 80 185 100 185 110 180 C 115 175 90 170 80 175 Z"
                fill="#1e293b" // dark cleat
                stroke="#0f172a"
                strokeWidth="2"
              />
              {/* Cleat studs */}
              <circle cx="85" cy="183" r="1.5" fill="#facc15" />
              <circle cx="95" cy="183" r="1.5" fill="#facc15" />
              <circle cx="105" cy="180" r="1.5" fill="#facc15" />
            </g>
            
            {/* The Ball */}
            <circle cx="120" cy="172" r="12" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
            <path d="M 115 165 L 125 168 L 122 178 L 112 175 Z" fill="#1e293b" opacity="0.8" />
            
            {/* Impact sparks */}
            {fraction > 0.5 && (
              <g className="impact-sparks" opacity={fraction}>
                <line x1="110" y1="172" x2="95" y2="165" stroke="#f59e0b" strokeWidth="3" />
                <line x1="110" y1="180" x2="90" y2="185" stroke="#f59e0b" strokeWidth="3" />
                <line x1="115" y1="185" x2="110" y2="195" stroke="#f59e0b" strokeWidth="3" />
              </g>
            )}
          </svg>
        </div>

        {/* Power bar */}
        <div
          ref={barRef}
          className="power-bar-track"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="power-bar-fill"
            style={{
              height: `${fraction * 100}%`,
              background: `linear-gradient(to top, ${getBarColor()}, ${getBarColor()}dd)`,
            }}
          />
          <div className="power-bar-handle" style={{ bottom: `calc(${fraction * 100}% - 14px)` }} />
        </div>

        <div className="power-readout">
          <div className="power-value">{power}</div>
          <div className="power-unit">m/s</div>
        </div>
      </div>

      <div className="step-actions">
        <button className="wizard-btn secondary" onClick={onBack}>← Back</button>
        <button className="wizard-btn primary" onClick={onNext}>Next →</button>
      </div>
    </div>
  )
}
