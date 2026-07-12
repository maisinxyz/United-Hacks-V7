/**
 * StepWizard — Orchestrates the immersive UI flow.
 * 5-attempt free kick mode with random ball positions and scoreboard.
 * Flow: Entrance → [Power → H-Aim → V-Aim → Curve → Timing → Result] × 5 → Game Over
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import EntranceScreen from './EntranceScreen'
import PowerOverlay from './PowerOverlay'
import HorizontalAngleOverlay from './HorizontalAngleOverlay'
import VerticalAngleOverlay from './VerticalAngleOverlay'
import CurveOverlay from './CurveOverlay'
import ShotTimingOverlay, { type TimingResult } from './ShotTimingOverlay'
import StadiumBadge from './StadiumBadge'
import SnowOverlay from './SnowOverlay'
import PitchScene, { type CameraConfig } from './PitchScene'
import axios from 'axios'
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

const MAX_ATTEMPTS = 5

// Steps: -2 = Entrance, 0 = Power, 1 = H-Aim, 2 = V-Aim, 3 = Curve, 4 = Timing, 5 = Kick Result, 6 = Game Over
const STEP_COUNT = 7

/** Generate a random ball position outside the penalty box but inside the attacking half.
 *  Penalty box: x ∈ [-9, 9], z ∈ [10, 27]. We pick outside that region.
 *  x ∈ [-12, 12], z ∈ [2, 12] — varying distances from goal */
function generateRandomPositions(count: number): [number, number][] {
  const positions: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const x = Math.round((Math.random() * 24 - 12) * 10) / 10  // -12 to 12
    const z = Math.round((Math.random() * 10 + 2) * 10) / 10   // 2 to 12
    positions.push([x, z])
  }
  return positions
}

/** Build camera configs offset by ball position */
function getCameraConfig(step: number, bp: [number, number]): CameraConfig {
  const [bx, bz] = bp
  const configs: Record<number, CameraConfig> = {
    [-2]: { position: [0, 30, -50], target: [0, 5, 0] },
    0: { position: [bx - 3, 0.8, bz - 2], target: [bx + 0.5, 0.11, bz + 1.5] },
    1: { position: [bx, 12, bz - 8], target: [bx, 0, (bz + 27) / 2] },
    2: { position: [bx - 15, 3, (bz + 27) / 2], target: [bx, 1, (bz + 27) / 2] },
    3: { position: [bx, 1.0, bz - 2.5], target: [bx, 0.11, (bz + 27) / 2] },
    4: { position: [bx, 1.0, bz - 2.5], target: [bx, 0.11, (bz + 27) / 2] }, // Timing: same as curve
    5: { position: [bx, 8, bz - 12], target: [0, 2, 15] }, // Result
    6: { position: [0, 30, -20], target: [0, 0, 15] }, // Game Over
  }
  return configs[step] || configs[0]
}

export default function StepWizard() {
  const [step, setStep] = useState(-2)
  const [config, setConfig] = useState<KickConfig>(INITIAL_CONFIG)
  const [simResult, setSimResult] = useState<SimulateResult | null>(null)
  const [previewTrajectory, setPreviewTrajectory] = useState<TrajectoryPoint[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [resultRevealed, setResultRevealed] = useState(false)

  // 5-attempt game state
  const [attemptIndex, setAttemptIndex] = useState(0)
  const [attemptResults, setAttemptResults] = useState<('goal' | 'miss')[]>([])
  const [score, setScore] = useState(0)
  const [ballPositions, setBallPositions] = useState<[number, number][]>(() => generateRandomPositions(MAX_ATTEMPTS))
  const [gameOver, setGameOver] = useState(false)
  const [stamina, setStamina] = useState(100)

  const currentBallPos = ballPositions[attemptIndex] || [0, 0]

  const handlePlay = async () => {
    setLoading(true)
    setResultRevealed(false)
    setAttemptIndex(0)
    setAttemptResults([])
    setScore(0)
    setGameOver(false)
    setStamina(100)
    const newPositions = generateRandomPositions(MAX_ATTEMPTS)
    setBallPositions(newPositions)
    try {
      const init = await fetchGameInit()
      setConfig((prev) => ({
        ...prev,
        stadiumId: init.stadium.id,
        conditions: init.conditions,
      }))
      setStep(0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = useCallback(
    (patch: Partial<KickConfig>) => setConfig((prev) => ({ ...prev, ...patch })),
    []
  )

  // Live trajectory preview during Curve step
  useEffect(() => {
    if (step !== 3) return
    const conditions = config.conditions
    if (!conditions) return
    
    const controller = new AbortController()
    
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
          conditions,
          ball_start_x: currentBallPos[0],
          ball_start_z: currentBallPos[1],
        }, controller.signal)
        setPreviewTrajectory(result.trajectory)
      } catch (e: any) {
        if (e.name !== 'CanceledError' && e.name !== 'AbortError' && !axios.isCancel(e)) {
          console.error("Failed to get preview trajectory:", e)
        }
      }
    }
    
    fetchPreview()

    return () => {
      controller.abort()
    }
  }, [step, config, currentBallPos])

  const next = () => setStep((s) => Math.min(s + 1, STEP_COUNT - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  // CurveOverlay's "KICK!" now advances to the timing step
  const handleReadyToKick = () => {
    setStep(4) // Go to timing overlay
  }

  // Called after the timing overlay fires its result
  const handleTimingResult = async (timing: TimingResult) => {
    if (!config.conditions) return

    // Apply stamina cost
    setStamina((prev) => Math.max(0, prev - timing.staminaCost))

    setLoading(true)
    setResultRevealed(false)

    // Apply deviation based on timing zone
    const devScale = timing.deviation
    const hDeviation = (Math.random() - 0.5) * 2 * devScale * 8 // up to ±8 degrees in red
    const vDeviation = (Math.random() - 0.5) * 2 * devScale * 4 // up to ±4 degrees in red

    try {
      const result = await runSimulation({
        stadium_id: config.stadiumId,
        power: config.power,
        horizontal_angle: config.horizontalAngle + hDeviation,
        vertical_angle: config.verticalAngle + vDeviation,
        spin_rate: config.spinRate * (1 - devScale * 0.3), // up to 30% spin loss
        spin_axis_x: config.spinAxisX,
        spin_axis_y: config.spinAxisY,
        spin_axis_z: config.spinAxisZ,
        conditions: config.conditions,
        ball_start_x: currentBallPos[0],
        ball_start_z: currentBallPos[1],
      })
      setSimResult(result)
      setStep(5) // Go to result
    } catch (err) {
      console.error('Simulation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  // Record result when revealed
  useEffect(() => {
    if (step === 5 && resultRevealed && simResult && attemptResults.length === attemptIndex) {
      const isGoal = simResult.result === 'goal'
      setAttemptResults((prev) => [...prev, isGoal ? 'goal' : 'miss'])
      if (isGoal) setScore((s) => s + 1)
    }
  }, [resultRevealed, step, simResult, attemptIndex, attemptResults.length])

  const handleNextKick = () => {
    const nextAttempt = attemptIndex + 1
    if (nextAttempt >= MAX_ATTEMPTS) {
      setGameOver(true)
      setStep(6)
      return
    }
    setAttemptIndex(nextAttempt)
    setSimResult(null)
    setPreviewTrajectory(null)
    setResultRevealed(false)
    // Reset kick params but keep stadium/conditions
    setConfig((prev) => ({
      ...prev,
      power: INITIAL_CONFIG.power,
      horizontalAngle: INITIAL_CONFIG.horizontalAngle,
      verticalAngle: INITIAL_CONFIG.verticalAngle,
      spinRate: INITIAL_CONFIG.spinRate,
      spinAxisX: INITIAL_CONFIG.spinAxisX,
      spinAxisY: INITIAL_CONFIG.spinAxisY,
      spinAxisZ: INITIAL_CONFIG.spinAxisZ,
    }))
    setStep(0)
  }

  const handleRestart = () => {
    setStep(-2)
    setSimResult(null)
    setPreviewTrajectory(null)
    setResultRevealed(false)
    setAttemptIndex(0)
    setAttemptResults([])
    setScore(0)
    setGameOver(false)
    setConfig(INITIAL_CONFIG)
  }

  const cameraConfig = useMemo(() => getCameraConfig(step, currentBallPos), [step, currentBallPos])

  return (
    <div className="wizard-container">
      <div className="scene-background">
        <PitchScene
          camera={cameraConfig}
          trajectory={simResult?.trajectory}
          previewTrajectory={previewTrajectory}
          ghostTrajectory={previewTrajectory || undefined}
          result={step === 5 && resultRevealed ? simResult?.result : undefined}
          resultVisible={step === 5 && resultRevealed}
          dimmed={false}
          stepIndex={step}
          config={config}
          instantCamera={step === -2 || step === 0}
          onTrajectoryComplete={() => setResultRevealed(true)}
          ballPosition={currentBallPos}
        />
      </div>

      {step === -2 && <EntranceScreen onPlay={handlePlay} />}

      {/* Scoreboard — visible during gameplay (steps 0–5) */}
      {step >= 0 && (
        <Scoreboard
          attemptResults={attemptResults}
          attemptIndex={attemptIndex}
          score={score}
          maxAttempts={MAX_ATTEMPTS}
        />
      )}

      {/* Snow Overlay for negative temperatures */}
      {config.conditions && config.conditions.temperature_celsius < 0 && (
        <SnowOverlay />
      )}

      {/* Stadium Badge — visible during kick prep steps */}
      {(step >= 0 && step <= 3) && config.conditions && (
        <StadiumBadge conditions={config.conditions} />
      )}

      <div className="overlay-container">
        {step === 0 && (
          <PowerOverlay power={config.power} onUpdate={(power) => updateConfig({ power })} onNext={next} onBack={() => {}} />
        )}
        {step === 1 && (
          <HorizontalAngleOverlay angle={config.horizontalAngle} onUpdate={(a) => updateConfig({ horizontalAngle: a })} onNext={next} onBack={back} ballPosition={currentBallPos} />
        )}
        {step === 2 && (
          <VerticalAngleOverlay angle={config.verticalAngle} onUpdate={(a) => updateConfig({ verticalAngle: a })} onNext={next} onBack={back} />
        )}
        {step === 3 && (
          <CurveOverlay config={config} onUpdate={updateConfig} onKick={handleReadyToKick} onBack={back} loading={loading} ballPosition={currentBallPos} />
        )}
        {step === 4 && (
          <ShotTimingOverlay stamina={stamina} onResult={handleTimingResult} />
        )}
        {step === 5 && simResult && resultRevealed && (
          <div className="result-actions">
            <div className="result-banner">
              {simResult.result === 'goal' ? (
                <h2 className="result-goal">⚽ GOAL!</h2>
              ) : (
                <h2 className="result-miss">❌ MISSED</h2>
              )}
            </div>
            {attemptIndex < MAX_ATTEMPTS - 1 ? (
              <button className="wizard-btn try-again-btn" onClick={handleNextKick}>
                Next Kick →
              </button>
            ) : (
              <button className="wizard-btn try-again-btn" onClick={handleNextKick}>
                See Final Score
              </button>
            )}
          </div>
        )}
        {step === 6 && gameOver && (
          <div className="game-over-screen">
            <h1 className="game-over-title">Final Score</h1>
            <div className="game-over-score">{score} / {MAX_ATTEMPTS}</div>
            <div className="game-over-circles">
              {attemptResults.map((r, i) => (
                <span key={i} className={`score-circle ${r === 'goal' ? 'goal' : 'miss'}`} />
              ))}
            </div>
            <p className="game-over-message">
              {score === MAX_ATTEMPTS ? '🏆 Perfect! You scored every one!' :
               score >= 3 ? '🎉 Great shooting!' :
               score >= 1 ? '👍 Not bad, try again!' :
               '😅 Better luck next time!'}
            </p>
            <button className="wizard-btn try-again-btn" onClick={handleRestart}>
              🔄 Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Scoreboard with 5 circles and running score */
function Scoreboard({ attemptResults, attemptIndex, score, maxAttempts }: {
  attemptResults: ('goal' | 'miss')[]
  attemptIndex: number
  score: number
  maxAttempts: number
}) {
  return (
    <div className="scoreboard">
      <div className="scoreboard-points">
        <span className="scoreboard-label">Score</span>
        <span className="scoreboard-value">{score}</span>
      </div>
      <div className="scoreboard-circles">
        {Array.from({ length: maxAttempts }).map((_, i) => {
          let cls = 'score-circle'
          if (i < attemptResults.length) {
            cls += attemptResults[i] === 'goal' ? ' goal' : ' miss'
          } else if (i === attemptIndex) {
            cls += ' current'
          }
          return <span key={i} className={cls} />
        })}
      </div>
      <div className="scoreboard-attempt">
        Kick {Math.min(attemptIndex + 1, maxAttempts)} / {maxAttempts}
      </div>
    </div>
  )
}
