/**
 * StepWizard — Orchestrates the immersive UI flow.
 * Determines which overlay to show and what camera position to pass to PitchScene.
 */

import { useState, useCallback, useEffect } from 'react'
import StadiumOverlay from './StadiumOverlay'
import PowerOverlay from './PowerOverlay'
import HorizontalAngleOverlay from './HorizontalAngleOverlay'
import VerticalAngleOverlay from './VerticalAngleOverlay'
import CurveOverlay from './CurveOverlay'
import PitchScene, { type CameraConfig } from './PitchScene'
import { runSimulation, type SimulateResult, type StadiumConditions, type TrajectoryPoint } from '../api'

export interface KickConfig {
  stadiumId: string
  conditions: StadiumConditions | null
  power: number
  horizontalAngle: number
  verticalAngle: number
  spinRate: number
  spinAxisX: number
  spinAxisY: number
  spinAxisZ: number
}

const INITIAL_CONFIG: KickConfig = {
  stadiumId: 'metlife',
  conditions: null,
  power: 50,
  horizontalAngle: 0,
  verticalAngle: 22,
  spinRate: 8,
  spinAxisX: 1,
  spinAxisY: 1,
  spinAxisZ: 1,
}

// 0: Stadium, 1: Power, 2: H-Aim, 3: V-Aim, 4: Spin, 5: Kick Result
const STEP_COUNT = 6

const CAMERA_CONFIGS: Record<number, CameraConfig> = {
  0: { position: [0, 5, -8], target: [0, 1, 27] },      // Stadium: behind ball, looking at goal
  // Power: side/back view, zoomed in on ball, framed on the right
  1: { position: [-3, 0.8, -2], target: [0.5, 0.11, 1.5] }, 
  // H-Aim: High tactical angle from behind the ball looking towards the goal (avoids top-down singularity completely)
  2: { position: [0, 12, -8], target: [0, 0, 15] },      
  3: { position: [-15, 3, 13], target: [0, 1, 13] },     // V-Aim: side view
  // Spin: camera is directly behind the ball, looking towards the goal, so the ball is dead center.
  4: { position: [0, 1.0, -2.5], target: [0, 0.11, 15] }, 
  5: { position: [0, 8, -12], target: [0, 2, 15] },      // Kick: cinematic behind view
}

export default function StepWizard() {
  const [step, setStep] = useState(0)
  const [config, setConfig] = useState<KickConfig>(INITIAL_CONFIG)
  const [simResult, setSimResult] = useState<SimulateResult | null>(null)
  const [previewTrajectory, setPreviewTrajectory] = useState<TrajectoryPoint[] | null>(null)
  const [loading, setLoading] = useState(false)

  const updateConfig = useCallback(
    (patch: Partial<KickConfig>) => setConfig((prev) => ({ ...prev, ...patch })),
    []
  )

  // Live trajectory preview during Curve step
  useEffect(() => {
    if (step !== 4) return
    
    let isCancelled = false
    const fetchPreview = async () => {
      try {
        const result = await runSimulation({
          stadium_id: config.stadiumId,
          power: config.power,
          horizontal_angle: config.horizontalAngle,
          vertical_angle: config.verticalAngle,
          spin_rate: config.spinRate,
          spin_axis_x: config.spinAxisX,
          spin_axis_y: config.spinAxisY,
          spin_axis_z: config.spinAxisZ,
        })
        if (!isCancelled) setPreviewTrajectory(result.trajectory)
      } catch (e) {
        console.error("Failed to get preview trajectory:", e)
      }
    }
    
    fetchPreview()

    return () => {
      isCancelled = true
    }
  }, [step, config])

  const next = () => setStep((s) => Math.min(s + 1, STEP_COUNT - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const handleKick = async () => {
    setLoading(true)
    try {
      const result = await runSimulation({
        stadium_id: config.stadiumId,
        power: config.power,
        horizontal_angle: config.horizontalAngle,
        vertical_angle: config.verticalAngle,
        spin_rate: config.spinRate,
        spin_axis_x: config.spinAxisX,
        spin_axis_y: config.spinAxisY,
        spin_axis_z: config.spinAxisZ,
      })
      setSimResult(result)
      setStep(5) // Go to result step
    } catch (err) {
      console.error('Simulation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRestart = () => {
    setStep(0)
    setSimResult(null)
    setConfig((prev) => ({ ...INITIAL_CONFIG, stadiumId: prev.stadiumId, conditions: prev.conditions }))
  }

  const camera = CAMERA_CONFIGS[step]
  const isDimmed = step < 5 // Dim background while configuring

  return (
    <div className="wizard-container">
      <div className="scene-background">
        <PitchScene
          camera={camera}
          trajectory={simResult?.trajectory}
          previewTrajectory={previewTrajectory}
          ghostTrajectory={simResult?.ghost_trajectory}
          result={step === 5 ? simResult?.result : undefined}
          dimmed={isDimmed}
          stepIndex={step}
          config={config}
          instantCamera={step === 4}
        />
      </div>

      <div className="overlay-container">
        {step === 0 && (
          <StadiumOverlay config={config} onUpdate={updateConfig} onNext={next} />
        )}
        {step === 1 && (
          <PowerOverlay power={config.power} onUpdate={(power) => updateConfig({ power })} onNext={next} onBack={back} />
        )}
        {step === 2 && (
          <HorizontalAngleOverlay angle={config.horizontalAngle} onUpdate={(a) => updateConfig({ horizontalAngle: a })} onNext={next} onBack={back} />
        )}
        {step === 3 && (
          <VerticalAngleOverlay angle={config.verticalAngle} onUpdate={(a) => updateConfig({ verticalAngle: a })} onNext={next} onBack={back} />
        )}
        {step === 4 && (
          <CurveOverlay config={config} onUpdate={updateConfig} onKick={handleKick} onBack={back} loading={loading} />
        )}
        {step === 5 && simResult && (
          <div className="result-actions">
            <button className="wizard-btn secondary frosted" onClick={handleRestart}>
              🔄 Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
