/**
 * StepWizard — Orchestrates the immersive UI flow.
 * New flow: Cinematic intro → Power → H-Aim → V-Aim → Curve → Kick Result
 * Stadium is randomly assigned by the backend via /game/init.
 */

import { useState, useCallback, useEffect } from 'react'
import EntranceScreen from './EntranceScreen'
import PowerOverlay from './PowerOverlay'
import HorizontalAngleOverlay from './HorizontalAngleOverlay'
import VerticalAngleOverlay from './VerticalAngleOverlay'
import CurveOverlay from './CurveOverlay'
import StadiumBadge from './StadiumBadge'
import PitchScene, { type CameraConfig } from './PitchScene'
import { fetchGameInit, runSimulation, type SimulateResult, type StadiumConditions, type TrajectoryPoint } from '../api'

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
  stadiumId: '',
  conditions: null,
  power: 50,
  horizontalAngle: 0,
  verticalAngle: 22,
  spinRate: 8,
  spinAxisX: 1,
  spinAxisY: 1,
  spinAxisZ: 1,
}

// Steps: 
// -2 = Entrance, 
// -1 = Cinematic Exterior, 
// -0.5 = Cinematic Tunnel Fly-through,
// 0 = Power, 1 = H-Aim, 2 = V-Aim, 3 = Curve, 4 = Kick Result
const STEP_COUNT = 5

const CAMERA_CONFIGS: Record<number, CameraConfig> = {
  [-2]: { position: [0, 30, -50], target: [0, 5, 0] },      // Entrance background
  [-1]: { position: [0, 50, -130], target: [0, 10, 0] },    // Cinematic: far exterior
  [-0.5]: { position: [0, 5, -20], target: [0, 1, 15] },  // Cinematic: tunnel fly-through
  0: { position: [-3, 0.8, -2], target: [0.5, 0.11, 1.5] }, // Power: side/back view
  1: { position: [0, 12, -8], target: [0, 0, 15] },       // H-Aim: tactical behind
  2: { position: [-15, 3, 13], target: [0, 1, 13] },       // V-Aim: side view
  3: { position: [0, 1.0, -2.5], target: [0, 0.11, 15] },  // Curve: behind ball
  4: { position: [0, 8, -12], target: [0, 2, 15] },        // Kick: cinematic behind
}

export default function StepWizard() {
  const [step, setStep] = useState(-2) // Start at Entrance
  const [config, setConfig] = useState<KickConfig>(INITIAL_CONFIG)
  const [simResult, setSimResult] = useState<SimulateResult | null>(null)
  const [previewTrajectory, setPreviewTrajectory] = useState<TrajectoryPoint[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [initLoaded, setInitLoaded] = useState(false)

  const handlePlay = async () => {
    setLoading(true)
    try {
      const init = await fetchGameInit()
      setConfig((prev) => ({
        ...prev,
        stadiumId: init.stadium.id,
        conditions: init.conditions,
      }))
      setInitLoaded(true)
      setStep(-1) // Start cinematic sequence
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Cinematic sequence timing
  useEffect(() => {
    if (step === -1 && initLoaded) {
      // Exterior view for 1s
      const timer = setTimeout(() => setStep(-0.5), 1000) 
      return () => clearTimeout(timer)
    }
    if (step === -0.5) {
      // Fly through tunnel for 1s
      const timer = setTimeout(() => setStep(0), 1000)
      return () => clearTimeout(timer)
    }
  }, [step, initLoaded])

  const updateConfig = useCallback(
    (patch: Partial<KickConfig>) => setConfig((prev) => ({ ...prev, ...patch })),
    []
  )

  // Live trajectory preview during Curve step
  useEffect(() => {
    if (step !== 3) return
    
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
    if (!config.conditions) return
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
        conditions: config.conditions,
      })
      setSimResult(result)
      setStep(4) // Go to result step
    } catch (err) {
      console.error('Simulation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRestart = async () => {
    setStep(-2)
    setSimResult(null)
    setPreviewTrajectory(null)
    setInitLoaded(false)
    setConfig(INITIAL_CONFIG)
  }

  return (
    <div className="wizard-container">
      <div className="scene-background">
        <PitchScene
          camera={CAMERA_CONFIGS[step]}
          trajectory={simResult?.trajectory}
          previewTrajectory={previewTrajectory}
          ghostTrajectory={previewTrajectory || undefined}
          // keeperTrajectory={simResult?.keeper_trajectory}
          result={step === 4 ? simResult?.result : undefined}
          dimmed={false} // Removed dimming to keep things bright
          stepIndex={step}
          config={config}
          instantCamera={step === -2 || step === -1} // Snap to initial camera positions
        />
      </div>

      {step === -2 && <EntranceScreen onPlay={handlePlay} />}

      {/* Stadium Badge — visible during exterior cinematic and kick prep steps */}
      {(step === -1 || (step >= 0 && step <= 3)) && config.conditions && (
        <StadiumBadge conditions={config.conditions} />
      )}

      {/* Cinematic intro text (only show on -1 so it doesn't block tunnel run) */}
      {step === -1 && (
        <div className="cinematic-intro-bottom-left">
          <h1>{config.conditions?.stadium.name}</h1>
          <p>{config.conditions?.stadium.city}, {config.conditions?.stadium.country} • Altitude: {config.conditions?.stadium.altitude_meters}m</p>
        </div>
      )}

      <div className="overlay-container">
        {step === 0 && (
          <PowerOverlay power={config.power} onUpdate={(power) => updateConfig({ power })} onNext={next} onBack={() => {}} />
        )}
        {step === 1 && (
          <HorizontalAngleOverlay angle={config.horizontalAngle} onUpdate={(a) => updateConfig({ horizontalAngle: a })} onNext={next} onBack={back} />
        )}
        {step === 2 && (
          <VerticalAngleOverlay angle={config.verticalAngle} onUpdate={(a) => updateConfig({ verticalAngle: a })} onNext={next} onBack={back} />
        )}
        {step === 3 && (
          <CurveOverlay config={config} onUpdate={updateConfig} onKick={handleKick} onBack={back} loading={loading} />
        )}
        {step === 4 && simResult && (
          <div className="result-actions">
            <div className="result-banner">
              {simResult.result === 'goal' && <h2 className="result-goal">⚽ GOAL!</h2>}
              {simResult.result === 'saved' && <h2 className="result-saved">🧤 SAVED!</h2>}
              {simResult.result === 'miss_high' && <h2 className="result-miss">⬆️ Over the bar!</h2>}
              {simResult.result === 'miss_wide' && <h2 className="result-miss">↔️ Wide!</h2>}
              {simResult.result === 'miss_short' && <h2 className="result-miss">⬇️ Too short!</h2>}
            </div>
            <button className="wizard-btn try-again-btn" onClick={handleRestart}>
              🔄 Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
