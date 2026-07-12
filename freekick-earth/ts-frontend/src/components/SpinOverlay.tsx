/**
 * SpinOverlay — Floating spin controls for Step 5.
 */

import { useRef, useCallback } from 'react'
import type { KickConfig } from './StepWizard'

interface Props {
  config: KickConfig
  onUpdate: (patch: Partial<KickConfig>) => void
  onKick: () => void
  onBack: () => void
  loading: boolean
}

const MIN_SPIN = 0
const MAX_SPIN = 60

export default function SpinOverlay({ config, onUpdate, onKick, onBack, loading }: Props) {
  const dialRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const fraction = (config.spinRate - MIN_SPIN) / (MAX_SPIN - MIN_SPIN)

  const updateFromEvent = useCallback((clientX: number, clientY: number) => {
    if (!dialRef.current) return
    const rect = dialRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = clientX - cx
    const dy = cy - clientY
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI
    let normalized = 90 - angleDeg
    if (normalized < 0) normalized += 360
    const usableStart = 30
    const usableEnd = 330
    const usableRange = usableEnd - usableStart
    const clamped = Math.max(usableStart, Math.min(usableEnd, normalized))
    const pct = (clamped - usableStart) / usableRange
    const val = MIN_SPIN + pct * (MAX_SPIN - MIN_SPIN)
    onUpdate({ spinRate: Math.round(val) })
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

  const gaugeRadius = 80
  const gaugeCX = 120
  const gaugeCY = 120
  const startAngle = 210
  const endAngle = 330
  const currentAngle = startAngle + fraction * (endAngle - startAngle)

  const polarToXY = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180
    return {
      x: gaugeCX + r * Math.cos(rad),
      y: gaugeCY + r * Math.sin(rad),
    }
  }

  const describeArc = (startA: number, endA: number, r: number) => {
    const s = polarToXY(startA, r)
    const e = polarToXY(endA, r)
    const largeArc = endA - startA > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
  }

  return (
    <div className="overlay-card frosted side-panel right-panel">
      <div className="step-header">
        <span className="step-number">05</span>
        <h2>Spin</h2>
      </div>

      <div className="spin-gauge-wrapper">
        <svg
          ref={dialRef}
          viewBox="0 0 240 160"
          className="spin-gauge-svg"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <path d={describeArc(startAngle, endAngle, gaugeRadius)} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
          <path d={describeArc(startAngle, currentAngle, gaugeRadius)} fill="none" stroke={fraction < 0.33 ? '#22c55e' : fraction < 0.66 ? '#f59e0b' : '#ef4444'} strokeWidth="12" strokeLinecap="round" />
          <circle cx={gaugeCX} cy={gaugeCY} r="5" fill="#0f172a" />
          {[0, 15, 30, 45, 60].map((v, i) => {
            const a = startAngle + (i / 4) * (endAngle - startAngle)
            const pos = polarToXY(a, gaugeRadius + 20)
            return <text key={v} x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#94a3b8" fontSize="10">{v}</text>
          })}
          <text x={gaugeCX} y={gaugeCY + 35} textAnchor="middle" fill="#0f172a" fontSize="22" fontWeight="800">{config.spinRate}</text>
          <text x={gaugeCX} y={gaugeCY + 50} textAnchor="middle" fill="#64748b" fontSize="10">RPM</text>
        </svg>
      </div>

      <div className="flex flex-col gap-4 mt-2">
        <label className="text-sm font-semibold flex flex-col gap-2">
          <span>X-Axis (Topspin/Backspin): {config.spinAxisX.toFixed(2)}</span>
          <input type="range" min="-1" max="1" step="0.1" value={config.spinAxisX} onChange={(e) => onUpdate({ spinAxisX: parseFloat(e.target.value) })} className="w-full" />
        </label>
        <label className="text-sm font-semibold flex flex-col gap-2">
          <span>Y-Axis (Sidespin): {config.spinAxisY.toFixed(2)}</span>
          <input type="range" min="-1" max="1" step="0.1" value={config.spinAxisY} onChange={(e) => onUpdate({ spinAxisY: parseFloat(e.target.value) })} className="w-full" />
        </label>
        <label className="text-sm font-semibold flex flex-col gap-2">
          <span>Z-Axis (Corkscrew): {config.spinAxisZ.toFixed(2)}</span>
          <input type="range" min="-1" max="1" step="0.1" value={config.spinAxisZ} onChange={(e) => onUpdate({ spinAxisZ: parseFloat(e.target.value) })} className="w-full" />
        </label>
      </div>

      <div className="wizard-actions">
        <button className="wizard-btn outline" onClick={onBack} style={{ background: '#64748b', color: 'white', border: 'none', boxShadow: 'none' }}>Back</button>
        <button className="wizard-btn primary" onClick={onKick} disabled={loading}>
          {loading ? 'Simulating...' : 'KICK! ⚽'}
        </button>
      </div>
    </div>
  )
}


