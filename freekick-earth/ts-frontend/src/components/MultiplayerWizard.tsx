/**
 * MultiplayerWizard — WebSocket-driven multiplayer flow.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import PowerOverlay from './PowerOverlay'
import HorizontalAngleOverlay from './HorizontalAngleOverlay'
import VerticalAngleOverlay from './VerticalAngleOverlay'
import CurveOverlay from './CurveOverlay'
import ShotTimingOverlay, { type TimingResult } from './ShotTimingOverlay'
import StadiumBadge from './StadiumBadge'
import SnowOverlay from './SnowOverlay'
import FlyoverScreen from './FlyoverScreen'
import { WS_BASE_URL, API_BASE_URL, type StadiumConditions } from '../api'
import PitchScene, { type CameraConfig } from './PitchScene'
import GoalKeeperScreen from './GoalKeeperScreen'
import axios from 'axios'
import { runSimulation, type SimulateResult, type TrajectoryPoint } from '../api'

export interface KickConfig {
  power: number
  horizontalAngle: number
  verticalAngle: number
  spinRate: number
  spinAxisX: number
  spinAxisY: number
  spinAxisZ: number
}

const INITIAL_CONFIG: KickConfig = {
  power: 50,
  horizontalAngle: 0,
  verticalAngle: 22,
  spinRate: 8,
  spinAxisX: 1,
  spinAxisY: 1,
  spinAxisZ: 1,
}

const MAX_ATTEMPTS = 5
const STEP_COUNT = 7

function getCameraConfig(step: number, bp: [number, number], role?: string | null): CameraConfig {
  if (role === 'goalkeeper' && step >= 0 && step <= 5) {
    const [bx, bz] = bp
    return { position: [0, 1.8, 28], target: [bx, 0.5, bz] }
  }
  const [bx, bz] = bp
  const configs: Record<number, CameraConfig> = {
    [-2]: { position: [0, 30, -50], target: [0, 5, 0] },
    [-1]: { position: [0, 35, 0], target: [0, 0, 15] },
    0: { position: [bx - 3, 0.8, bz - 2], target: [bx + 0.5, 0.11, bz + 1.5] },
    1: { position: [bx, 12, bz - 8], target: [bx, 0, (bz + 27) / 2] },
    2: { position: [bx - 15, 3, (bz + 27) / 2], target: [bx, 1, (bz + 27) / 2] },
    3: { position: [bx, 1.0, bz - 2.5], target: [bx, 0.11, (bz + 27) / 2] },
    4: { position: [bx, 1.0, bz - 2.5], target: [bx, 0.11, (bz + 27) / 2] },
    5: { position: [bx, 8, bz - 12], target: [0, 2, 15] },
    6: { position: [0, 30, -20], target: [0, 0, 15] },
  }
  return configs[step] || configs[0]
}

interface Props {
  mode: 'create' | 'join'
  roomCode?: string
  onExit: () => void
}

export default function MultiplayerWizard({ mode, roomCode, onExit }: Props) {
  const [step, setStep] = useState(-2)
  const [config, setConfig] = useState<KickConfig>(INITIAL_CONFIG)
  const [simResult, setSimResult] = useState<SimulateResult | null>(null)
  const [previewTrajectory, setPreviewTrajectory] = useState<TrajectoryPoint[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [resultRevealed, setResultRevealed] = useState(false)
  const [stamina, setStamina] = useState(100)
  const [errorMsg, setErrorMsg] = useState('')

  // Multiplayer State
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [myId] = useState(() => {
    let id = sessionStorage.getItem('clientId')
    if (!id) {
      id = Math.random().toString(36).substring(2, 9)
      sessionStorage.setItem('clientId', id)
    }
    return id
  })
  const [myRole, setMyRole] = useState<string | null>(null)
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [activeRoomCode, setActiveRoomCode] = useState('')
  const [players, setPlayers] = useState<Record<string, {name: string, score: number, connected: boolean}>>({})
  const [currentTurn, setCurrentTurn] = useState('')
  const [stadium, setStadium] = useState<any>(null)
  const [conditions, setConditions] = useState<StadiumConditions | null>(null)
  const [ballPositions, setBallPositions] = useState<[number, number][]>([[0,0]])
  const [round, setRound] = useState(0)
  const [history, setHistory] = useState<string[]>([])
  const [gameOver, setGameOver] = useState(false)

  const isMyTurn = currentTurn === myId
  const currentBallPos = ballPositions[round] || [0, 0]

  useEffect(() => {
    let active = true
    let socket: WebSocket | null = null
    
    const init = async () => {
      let code = roomCode
      if (mode === 'create') {
        try {
          const res = await axios.post(`${API_BASE_URL}/multiplayer/create`)
          if (!active) return
          code = res.data.room_code
        } catch (e) {
          if (!active) return
          setErrorMsg('Failed to create room')
          return
        }
      }
      if (!active) return
      setActiveRoomCode(code || '')

      const wsUrl = `${WS_BASE_URL}/multiplayer/ws/${code}/${myId}`
      
      socket = new WebSocket(wsUrl)
      
      socket.onopen = () => {
        console.log("Connected to room", code)
      }

      socket.onerror = (e) => {
        console.error("WebSocket Error: ", e)
        if (active) setErrorMsg("Connection to server failed.")
      }
      
      socket.onmessage = (event) => {
        if (!active) return
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'error':
            setErrorMsg(data.message)
            socket?.close()
            break
            
          case 'keeper_reaction_phase':
            setStep(4.5)
            break
            
          case 'room_state':
            setPlayers(data.players)
            if (data.roles) setRoles(data.roles)
            if (data.history) setHistory(data.history)
            break
            
          case 'role_selection':
            setRoles(data.roles)
            if (data.roles['kicker'] === myId) setMyRole('kicker')
            else if (data.roles['goalkeeper'] === myId) setMyRole('goalkeeper')
            setStep(-2.5) // Role selection step
            break
            
          case 'role_update':
            setRoles(data.roles)
            if (data.roles['kicker'] === myId) setMyRole('kicker')
            else if (data.roles['goalkeeper'] === myId) setMyRole('goalkeeper')
            break
            
          case 'game_start':
            setStadium(data.stadium)
            setConditions(data.conditions)
            setBallPositions(data.ball_positions)
            setCurrentTurn(data.turn)
            setPlayers(data.players)
            if (data.history) setHistory(data.history)
            if (data.roles) {
              setRoles(data.roles)
              for (const [r, cid] of Object.entries(data.roles)) {
                if (cid === myId) setMyRole(r as string)
              }
            }
            setStep(-1) // Start flyover
            break
            
          case 'turn_start':
            setCurrentTurn(data.turn)
            setRound(data.round)
            if (data.history) setHistory(data.history)
            setConfig(INITIAL_CONFIG)
            setSimResult(null)
            setPreviewTrajectory(null)
            setResultRevealed(false)
            setStep(0)
            break
            
          case 'shot_result':
            setSimResult({
              trajectory: data.trajectory,
              ghost_trajectory: [], // Simplified
              conditions: conditions!, // Assuming already set
              result: data.result,
              keeper_trajectory: []
            })
            // Update scores
            setPlayers(prev => ({
              ...prev,
              [data.player_id]: { ...prev[data.player_id], score: data.score }
            }))
            if (data.history) setHistory(data.history)
            setStep(5)
            break
            
          case 'game_over':
            setPlayers(data.players)
            setGameOver(true)
            setStep(6)
            break
            
          case 'player_disconnected':
            setPlayers(prev => ({
              ...prev,
              [data.player_id]: { ...prev[data.player_id], connected: false }
            }))
            break
        }
      }
      
      socket.onclose = () => {
        console.log("Disconnected")
      }
      
      setWs(socket)
    }
    
    init()
    
    return () => {
      active = false
      if (socket) socket.close()
    }
  }, [mode, roomCode])

  const updateConfig = useCallback(
    (patch: Partial<KickConfig>) => setConfig((prev) => ({ ...prev, ...patch })),
    []
  )

  useEffect(() => {
    if (step !== 3 || !isMyTurn) return
    if (!conditions) return
    
    const controller = new AbortController()
    const fetchPreview = async () => {
      try {
        const result = await runSimulation({
          stadium_id: stadium.id,
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
      } catch (e: any) {}
    }
    fetchPreview()
    return () => controller.abort()
  }, [step, config, currentBallPos, conditions, isMyTurn, stadium])

  const next = () => setStep((s) => Math.min(s + 1, STEP_COUNT - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const handleReadyToKick = () => {
    const kickData = { power: config.power, horizontal_angle: config.horizontalAngle, vertical_angle: config.verticalAngle, spin_rate: config.spinRate, spin_axis_x: config.spinAxisX, spin_axis_y: config.spinAxisY, spin_axis_z: config.spinAxisZ, ball_start_x: currentBallPos[0], ball_start_z: currentBallPos[1], stadium_id: stadium?.id, conditions: conditions }
    ws?.send(JSON.stringify({ type: 'take_shot', params: kickData }))
  }

  const handleKeeperReaction = (x: number, y: number) => {
    ws?.send(JSON.stringify({ type: 'keeper_reaction', x, y }))
    setStep(4.6)
  }

  const handleTimingResult = (timing: TimingResult) => {
    if (!conditions || !ws) return

    setStamina((prev) => Math.max(0, prev - timing.staminaCost))
    setLoading(true)
    setResultRevealed(false)
    setStep(5)

    const devScale = timing.deviation
    const hDeviation = (Math.random() - 0.5) * 2 * devScale * 8
    const vDeviation = (Math.random() - 0.5) * 2 * devScale * 4

    // Send the shot params to the server
    ws.send(JSON.stringify({
      type: 'take_shot',
      params: {
        stadium_id: stadium.id,
        power: config.power,
        horizontal_angle: config.horizontalAngle + hDeviation,
        vertical_angle: config.verticalAngle + vDeviation,
        spin_rate: config.spinRate * (1 - devScale * 0.3),
        spin_axis_x: config.spinAxisX,
        spin_axis_y: config.spinAxisY,
        spin_axis_z: config.spinAxisZ,
        conditions: conditions,
        ball_start_x: currentBallPos[0],
        ball_start_z: currentBallPos[1],
      }
    }))
    
    setLoading(false)
  }

  const handleNextKick = () => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'animation_complete' }))
    }
    // We don't advance the step here; the server will send 'turn_start' when both players are ready
    setStep(0)
  }

  const cameraConfig = useMemo(() => getCameraConfig(step, currentBallPos, myRole), [step, currentBallPos, myRole])

  if (errorMsg) {
    return (
      <div className="entrance-screen">
        <div className="entrance-content">
          <h2 style={{color: 'red'}}>{errorMsg}</h2>
          <button className="wizard-btn" onClick={onExit} style={{ marginTop: '2rem', background: '#64748b', color: 'white', border: 'none', boxShadow: 'none' }}>Back</button>
        </div>
      </div>
    )
  }

  if (step === -2) {
    return (
      <div className="entrance-screen">
        <div className="entrance-content">
          <h2 className="game-subtitle">
            {mode === 'create' ? 'Room Code: ' + activeRoomCode : 'Joining...'}
          </h2>
          <p>Waiting for opponent...</p>
          <div className="loading-spinner" style={{marginTop: '2rem'}} />
          <button className="wizard-btn outline small" onClick={onExit} style={{marginTop: '2rem'}}>Cancel</button>
        </div>
      </div>
    )
  }

  if (step === -2.5) {
    const selectRole = (role: string) => {
      if (ws) ws.send(JSON.stringify({ type: 'select_role', role }))
    }
    const isKickerTaken = roles['kicker'] && roles['kicker'] !== myId
    const isKeeperTaken = roles['goalkeeper'] && roles['goalkeeper'] !== myId
    
    return (
      <div className="entrance-screen">
        <div className="entrance-content">
          <h2 className="game-title" style={{ fontSize: '3rem' }}>Select Role</h2>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '3rem' }}>
            <button
              className="wizard-btn"
              disabled={Boolean(isKickerTaken)}
              onClick={() => selectRole('kicker')}
              style={{ opacity: isKickerTaken ? 0.5 : 1, boxShadow: 'none', background: '#3b82f6', color: 'white', border: 'none' }}
            >
              Kicker
            </button>
            <button
              className="wizard-btn"
              disabled={Boolean(isKeeperTaken)}
              onClick={() => selectRole('goalkeeper')}
              style={{ opacity: isKeeperTaken ? 0.5 : 1, boxShadow: 'none', background: '#3b82f6', color: 'white', border: 'none' }}
            >
              Goalkeeper
            </button>
          </div>
          <p style={{ marginTop: '2rem', opacity: 0.8 }}>Waiting for both players to choose...</p>
        </div>
      </div>
    )
  }

  let uiContent = null
  if (myRole === 'kicker') {
    if (step === 4.5 || step === 4.6) {
      uiContent = (
        <div className="overlay-card frosted center-panel select-none">
          <h2>Waiting for Goalkeeper...</h2>
          <p>The Goalkeeper is reacting to your shot!</p>
        </div>
      )
    } else if (isMyTurn) {
      if (step === 0) uiContent = <PowerOverlay power={config.power} onUpdate={(p) => updateConfig({ power: p })} onNext={next} onBack={() => {}} />
      else if (step === 1) uiContent = <HorizontalAngleOverlay angle={config.horizontalAngle} onUpdate={(a) => updateConfig({ horizontalAngle: a })} onNext={next} onBack={back} ballPosition={currentBallPos} />
      else if (step === 2) uiContent = <VerticalAngleOverlay angle={config.verticalAngle} onUpdate={(a) => updateConfig({ verticalAngle: a })} onNext={next} onBack={back} />
      else if (step === 3) uiContent = <CurveOverlay config={{...config, stadiumId: stadium?.id, conditions}} onUpdate={updateConfig} onKick={handleReadyToKick} onBack={back} loading={loading} ballPosition={currentBallPos} />
      else if (step === 4) uiContent = <ShotTimingOverlay stamina={stamina} onResult={handleTimingResult} />
    } else {
      uiContent = (
         <div className="overlay-card frosted bottom-center-panel" style={{ padding: '2rem', textAlign: 'center' }}>
           <h2>Opponent's Turn</h2>
           <p>Waiting for them to take their shot...</p>
         </div>
      )
    }
  } else {
    uiContent = <GoalKeeperScreen stadiumName={stadium?.name} step={step} onReact={handleKeeperReaction} />
  }

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
          dimmed={step >= 0 && step <= 4}
          stepIndex={step}
          config={{...config, stadiumId: stadium?.id, conditions}}
          instantCamera={step === -2 || step === -1 || step === 5}
          onTrajectoryComplete={() => setResultRevealed(true)}
          ballPosition={currentBallPos}
        />
      </div>

      {step === -1 && conditions && (
        <FlyoverScreen
          stadiumName={conditions.stadium.name}
          location={`${conditions.stadium.city}, ${conditions.stadium.country}`}
          conditions={conditions}
          onComplete={() => setStep(0)}
        />
      )}

      {step >= 0 && (
        <div className="scoreboard">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className="scoreboard-label" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Round {round + 1} / {MAX_ATTEMPTS}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => {
                const res = history[i]
                let bgColor = 'rgba(255,255,255,0.2)'
                if (res === 'goal') bgColor = '#22c55e'
                else if (res === 'miss') bgColor = '#ef4444'
                return (
                  <div key={i} style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: bgColor, border: '2px solid rgba(255,255,255,0.5)'
                  }} />
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', background: 'rgba(0,0,0,0.5)', padding: '0.5rem 1rem', borderRadius: '12px' }}>
            {Object.entries(players).map(([pid, p]) => (
              <div key={pid} style={{ textAlign: 'center', color: pid === myId ? '#38bdf8' : 'white', fontWeight: currentTurn === pid ? 'bold' : 'normal' }}>
                <div>{pid === myId ? 'You' : 'Opponent'} {!p.connected && '(Offline)'}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{p.score}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {conditions && conditions.temperature_celsius < 0 && <SnowOverlay />}
      {(step >= 0 && step <= 3) && conditions && <StadiumBadge conditions={conditions} />}

      <div className="overlay-container">
        {uiContent}
        
        {step === 5 && simResult && resultRevealed && (
          <div className="result-actions">
            <div className="result-banner">
              {simResult.result === 'goal' ? <h2 className="result-goal" style={{ fontSize: '6rem', fontWeight: 900, textShadow: '0 0 20px rgba(74, 222, 128, 0.5)' }}>⚽ GOAL!</h2> : <h2 className="result-miss" style={{ fontSize: '6rem', fontWeight: 900, textShadow: '0 0 20px rgba(248, 113, 113, 0.5)' }}>❌ MISSED</h2>}
            </div>
            <button className="wizard-btn try-again-btn" onClick={handleNextKick}>
              {round < MAX_ATTEMPTS - 1 ? 'Continue →' : 'See Final Score'}
            </button>
          </div>
        )}

        {step === 6 && gameOver && (
          <div className="game-over-screen">
            <h1 className="game-over-title">Final Score</h1>
            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '2rem' }}>
              {Object.entries(players).map(([pid, p]) => (
                <div key={pid} style={{ textAlign: 'center', fontSize: '2rem' }}>
                  <div style={{ fontSize: '1rem', opacity: 0.8 }}>{pid === myId ? 'You' : 'Opponent'}</div>
                  <div style={{ fontWeight: 900, color: pid === myId ? '#38bdf8' : 'white' }}>{p.score}</div>
                </div>
              ))}
            </div>
            <button className="wizard-btn try-again-btn" onClick={onExit}>
              Exit to Menu
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
