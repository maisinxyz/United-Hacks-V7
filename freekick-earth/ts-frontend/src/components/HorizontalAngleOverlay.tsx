/**
 * HorizontalAngleOverlay — Floating aim selector for Step 3.
 */

import { useRef, useCallback } from 'react'

interface Props {
  angle: number
  onUpdate: (angle: number) => void
  onNext: () => void
  onBack: () => void
  ballPosition: [number, number]
}

const MIN_ANGLE = -30
const MAX_ANGLE = 30
const ARC_RADIUS = 140
const CENTER_X = 200
const CENTER_Y = 240

export default function HorizontalAngleOverlay({ angle, onUpdate, onNext, onBack, ballPosition }: Props) {
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
    const rad = Math.atan2(dx, dy)
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
  const aimX = CENTER_X + ARC_RADIUS * Math.sin(angleRad)
  const aimY = CENTER_Y - ARC_RADIUS * Math.cos(angleRad)

  const arcPoints = []
  for (let d = MIN_ANGLE; d <= MAX_ANGLE; d += 1) {
    const r = (d * Math.PI) / 180
    arcPoints.push(`${CENTER_X + ARC_RADIUS * Math.sin(r)},${CENTER_Y - ARC_RADIUS * Math.cos(r)}`)
  }

  // If the ball is on the left side (x <= 0), placing the UI on the left prevents blocking the center/right view.
  const sideClass = ballPosition[0] <= 0 ? 'left-panel' : 'right-panel'

  return (
    <div className={`overlay-card frosted side-panel ${sideClass} select-none`}>
      <div className="step-header">
        <span className="step-number">03</span>
        <h2>Horizontal Aim</h2>
      </div>

      <div className="angle-container">
        <svg
          ref={svgRef}
          viewBox="0 0 400 300"
          className="angle-svg"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <polyline points={arcPoints.join(' ')} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
          {[-30, -20, -10, 0, 10, 20, 30].map((d) => {
            const r = (d * Math.PI) / 180
            const x1 = CENTER_X + (ARC_RADIUS - 8) * Math.sin(r)
            const y1 = CENTER_Y - (ARC_RADIUS - 8) * Math.cos(r)
            const x2 = CENTER_X + (ARC_RADIUS + 8) * Math.sin(r)
            const y2 = CENTER_Y - (ARC_RADIUS + 8) * Math.cos(r)
            const lx = CENTER_X + (ARC_RADIUS + 20) * Math.sin(r)
            const ly = CENTER_Y - (ARC_RADIUS + 20) * Math.cos(r)
            return (
              <g key={d}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.5" />
                <text x={lx} y={ly + 4} textAnchor="middle" fill="#94a3b8" fontSize="9">{d}°</text>
              </g>
            )
          })}
          <line x1={CENTER_X} y1={CENTER_Y} x2={aimX} y2={aimY} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="6 4" />
          <circle cx={aimX} cy={aimY} r="10" fill="#f59e0b" stroke="white" strokeWidth="3" style={{ cursor: 'grab' }} />
          <circle cx={CENTER_X} cy={CENTER_Y} r="5" fill="white" stroke="#1e6b38" strokeWidth="2" />
        </svg>

        <div className="angle-readout">
          <div className="angle-value">{angle > 0 ? '+' : ''}{angle}°</div>
        </div>
      </div>

      <div className="step-actions">
        <button className="wizard-btn" onClick={onBack} style={{ background: '#64748b', color: 'white', border: 'none', boxShadow: 'none' }}>← Back</button>
        <button className="wizard-btn primary" onClick={onNext}>Next →</button>
      </div>
    </div>
  )
}
