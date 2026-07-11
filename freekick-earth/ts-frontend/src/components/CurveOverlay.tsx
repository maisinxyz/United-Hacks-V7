import type { KickConfig } from './StepWizard'

interface Props {
  config: KickConfig
  onUpdate: (config: Partial<KickConfig>) => void
  onKick: () => void
  onBack: () => void
  loading: boolean
}

export default function CurveOverlay({ config, onUpdate, onKick, onBack, loading }: Props) {
  const MAX_SPIN = 60

  // The sliders give values from -100 to 100
  // spinRate = max(|X|, |Y|, |Z|) * MAX_SPIN / 100
  // spinAxis = sliderValue / 100

  const handleSliderChange = (axis: 'X' | 'Y' | 'Z', value: number) => {
    let rawX = config.spinAxisX * 100
    // user value is inverted physical Y, so that Left (-100) = physical spinAxisY (1) = Curve Left
    let rawY = -config.spinAxisY * 100 
    let rawZ = config.spinAxisZ * 100

    if (axis === 'X') rawX = value
    if (axis === 'Y') rawY = value
    if (axis === 'Z') rawZ = value

    const absX = Math.abs(rawX)
    const absY = Math.abs(rawY)
    const absZ = Math.abs(rawZ)
    const maxVal = Math.max(absX, absY, absZ)
    
    const spinRate = Math.round((maxVal / 100) * MAX_SPIN)
    
    // Avoid division by zero if all are 0
    let spinAxisX = 0, spinAxisY = 0, spinAxisZ = 0
    if (maxVal > 0) {
      spinAxisX = rawX / maxVal
      spinAxisY = -rawY / maxVal // convert user value back to physical Y
      spinAxisZ = rawZ / maxVal
    }

    onUpdate({
      spinRate,
      spinAxisX,
      spinAxisY,
      spinAxisZ
    })
  }

  // Calculate current slider positions from config
  const maxVal = config.spinRate / MAX_SPIN * 100
  const currentX = Math.round(config.spinAxisX * maxVal)
  const currentY = Math.round(-config.spinAxisY * maxVal) // inverted for display
  const currentZ = Math.round(config.spinAxisZ * maxVal)

  return (
    <div className="overlay-card frosted side-panel right-panel">
      <div className="step-header">
        <span className="step-number">04</span>
        <h2>Curve Settings</h2>
      </div>
      <p className="text-sm text-slate-300 mb-4 leading-relaxed">
        Adjust the curve along the X (Dip/Loft), Y (Left/Right), and Z (Corkscrew) axes. <br/>
        Watch the live trajectory preview bend!
      </p>

      <div className="flex flex-col gap-6 mb-6">
        <label className="text-sm font-semibold flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-red-400">X-Axis Curve (Dip/Loft)</span>
            <span>{currentX}%</span>
          </div>
          <input type="range" min="-100" max="100" step="1" value={currentX} onChange={(e) => handleSliderChange('X', parseInt(e.target.value))} className="w-full accent-red-500" />
        </label>
        
        <label className="text-sm font-semibold flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-green-400">Y-Axis Curve (Left/Right)</span>
            <span>{currentY}%</span>
          </div>
          <input type="range" min="-100" max="100" step="1" value={currentY} onChange={(e) => handleSliderChange('Y', parseInt(e.target.value))} className="w-full accent-green-500" />
        </label>
        
        <label className="text-sm font-semibold flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-blue-400">Z-Axis Curve (Corkscrew)</span>
            <span>{currentZ}%</span>
          </div>
          <input type="range" min="-100" max="100" step="1" value={currentZ} onChange={(e) => handleSliderChange('Z', parseInt(e.target.value))} className="w-full accent-blue-500" />
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
