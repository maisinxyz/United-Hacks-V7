/**
 * VerticalAngleOverlay — Floating aim selector for Step 4.
 */

import { useRef, useCallback } from 'react'

interface Props {
  angle: number
  onUpdate: (angle: number) => void
  onNext: () => void
  onBack: () => void
}

const MIN_ANGLE = 5
const MAX_ANGLE = 45
const ARC_RADIUS = 150
const CENTER_X = 100
const CENTER_Y = 230

export default function VerticalAngleOverlay({ angle, onUpdate, onNext, onBack }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  const updateFromEvent = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    const svgX = (sx / rect.width) * 400
    const svgY = (sy / rect.height) * 300
    const dx = svgX - CENTER_X
    const dy = CENTER_Y - svgY
    const rad = Math.atan2(dy, dx)
    let deg = (rad * 180) / Math.PI
    deg = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, deg))
    onUpdate(Math.round(deg * 2) / 2)
  }, [onUpdate])

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    ;(e.target as SVGElement).setPointerCapture?.(e.pointerId)
    updateFromEvent(e.clientX, e.clientY)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging.current) updateFromEvent(e.clientX, e.clientY)
  }
  const handlePointerUp = () => dragging.current = false

  const angleRad = (angle * Math.PI) / 180
  const handleX = CENTER_X + ARC_RADIUS * Math.cos(angleRad)
  const handleY = CENTER_Y - ARC_RADIUS * Math.sin(angleRad)

  const arcPoints = []
  for (let d = MIN_ANGLE; d <= MAX_ANGLE; d += 1) {
    const r = (d * Math.PI) / 180
    arcPoints.push(`${CENTER_X + ARC_RADIUS * Math.cos(r)},${CENTER_Y - ARC_RADIUS * Math.sin(r)}`)
  }

  return (
    <div className="overlay-card frosted bottom-wide-panel select-none">
      <div className="step-header">
        <span className="step-number">04</span>
        <h2>Vertical Pitch</h2>
      </div>

      <div className="angle-container">
        <svg
          ref={svgRef}
          viewBox="0 90 400 160"
          className="angle-svg"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <line x1="50" y1={CENTER_Y} x2="380" y2={CENTER_Y} stroke="#94a3b8" strokeWidth="2" />
          <polyline points={arcPoints.join(' ')} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
          {[5, 10, 15, 20, 25, 30, 35, 40, 45].map((d) => {
            const r = (d * Math.PI) / 180
            const x1 = CENTER_X + (ARC_RADIUS - 8) * Math.cos(r)
            const y1 = CENTER_Y - (ARC_RADIUS - 8) * Math.sin(r)
            const x2 = CENTER_X + (ARC_RADIUS + 8) * Math.cos(r)
            const y2 = CENTER_Y - (ARC_RADIUS + 8) * Math.sin(r)
            const lx = CENTER_X + (ARC_RADIUS + 22) * Math.cos(r)
            const ly = CENTER_Y - (ARC_RADIUS + 22) * Math.sin(r)
            const showLabel = d % 10 === 0 || d === 5 || d === 45
            return (
              <g key={d}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={showLabel ? 1.5 : 1} />
                {showLabel && <text x={lx} y={ly + 4} textAnchor="middle" fill="#94a3b8" fontSize="9">{d}°</text>}
              </g>
            )
          })}
          <line x1={CENTER_X} y1={CENTER_Y} x2={handleX} y2={handleY} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="6 4" />
          <circle cx={handleX} cy={handleY} r="10" fill="#f59e0b" stroke="white" strokeWidth="3" style={{ cursor: 'grab' }} />
          <circle cx={CENTER_X} cy={CENTER_Y} r="5" fill="white" stroke="#1e6b38" strokeWidth="2" />
        </svg>
        <div className="angle-readout">
          <div className="angle-value" style={{ minWidth: '4ch', display: 'inline-block', fontVariantNumeric: 'tabular-nums' }}>{angle}°</div>
        </div>
      </div>

      <div className="step-actions">
        <button className="wizard-btn secondary" onClick={onBack}>← Back</button>
        <button className="wizard-btn primary" onClick={onNext}>Next →</button>
      </div>
    </div>
  )
}
