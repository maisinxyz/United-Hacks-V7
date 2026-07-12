import { useState } from 'react'
import type { KickConfig } from './StepWizard'

interface Props {
  config: KickConfig
  onUpdate: (config: Partial<KickConfig>) => void
  onKick: () => void
  onBack: () => void
  loading: boolean
  ballPosition: [number, number]
}

export default function CurveOverlay({ config, onUpdate, onKick, onBack, loading, ballPosition }: Props) {
  const MAX_SPIN = 150

  const [x, setX] = useState(() => Math.round(config.spinAxisX * (config.spinRate / MAX_SPIN) * 100) || 0)
  const [y, setY] = useState(() => Math.round(-config.spinAxisY * (config.spinRate / MAX_SPIN) * 100) || 0)
  const [z, setZ] = useState(() => Math.round(config.spinAxisZ * (config.spinRate / MAX_SPIN) * 100) || 0)

  const handleSliderChange = (axis: 'X' | 'Y' | 'Z', value: number) => {
    let newX = axis === 'X' ? value : x
    let newY = axis === 'Y' ? value : y
    let newZ = axis === 'Z' ? value : z

    if (axis === 'X') setX(value)
    if (axis === 'Y') setY(value)
    if (axis === 'Z') setZ(value)

    const maxVal = Math.max(Math.abs(newX), Math.abs(newY), Math.abs(newZ))
    const spinRate = (maxVal / 100) * MAX_SPIN
    
    let spinAxisX = 0, spinAxisY = 0, spinAxisZ = 0
    if (maxVal > 0) {
      spinAxisX = newX / maxVal
      spinAxisY = -newY / maxVal
      spinAxisZ = newZ / maxVal
    }

    onUpdate({
      spinRate,
      spinAxisX,
      spinAxisY,
      spinAxisZ
    })
  }

  // Same dynamic positioning: if ball is on left, panel goes left.
  const sideClass = ballPosition[0] <= 0 ? 'bottom-left-panel' : 'bottom-right-panel'

  return (
    <div className={`overlay-card frosted ${sideClass} select-none`}>
      <div className="step-header">
        <span className="step-number">04</span>
        <h2>Curve Settings</h2>
      </div>

      <div className="flex flex-col gap-6 mb-6 mt-4">
        <label className="text-sm font-semibold flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-red-400">X-Axis Curve (Dip/Loft)</span>
            <span>{x}%</span>
          </div>
          <input type="range" min="-100" max="100" step="1" value={x} onChange={(e) => handleSliderChange('X', parseInt(e.target.value))} className="w-full accent-red-500" />
        </label>
        
        <label className="text-sm font-semibold flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-green-400">Y-Axis Curve (Left/Right)</span>
            <span>{y}%</span>
          </div>
          <input type="range" min="-100" max="100" step="1" value={y} onChange={(e) => handleSliderChange('Y', parseInt(e.target.value))} className="w-full accent-green-500" />
        </label>
        
        <label className="text-sm font-semibold flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-blue-400">Z-Axis Curve (Corkscrew)</span>
            <span>{z}%</span>
          </div>
          <input type="range" min="-100" max="100" step="1" value={z} onChange={(e) => handleSliderChange('Z', parseInt(e.target.value))} className="w-full accent-blue-500" />
        </label>
      </div>

      <div className="wizard-actions">
        <button className="wizard-btn outline" onClick={onBack}>Back</button>
        <button className="wizard-btn primary" onClick={onKick} disabled={loading}>
          {loading ? 'Simulating...' : 'KICK! ⚽'}
        </button>
      </div>
    </div>
  )
}
