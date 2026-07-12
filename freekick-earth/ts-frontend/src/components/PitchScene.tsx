/**
 * PitchScene — Always-visible 3D scene.
 * Camera position is controlled by the parent via props.
 * Renders pitch, goalposts, ball, trajectory, aim preview, and spin arrows.
 */

import { useRef, useState, useMemo, useEffect, forwardRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, Text, CameraControls, Sky, Cloud, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import type { TrajectoryPoint } from '../api'
import type { KickConfig } from './StepWizard'
import { getStadiumPrimitives } from './stadiums3d'
import BCPlace from './BCPlace'
import Grass from './Grass'
import { Coach, PlayerWarmup, CameraOperator, BallRack } from './NPCs'

export interface CameraConfig {
  position: [number, number, number]
  target: [number, number, number]
}

interface Props {
  camera: CameraConfig
  trajectory?: TrajectoryPoint[]
  previewTrajectory?: TrajectoryPoint[] | null
  ghostTrajectory?: TrajectoryPoint[]
  // keeperTrajectory?: TrajectoryPoint[]
  result?: string
  resultVisible?: boolean
  dimmed?: boolean
  stepIndex: number
  config: KickConfig
  instantCamera?: boolean
  onTrajectoryComplete?: () => void
  ballPosition?: [number, number]  // [x, z] offset for ball placement
}

export default function PitchScene({
  camera,
  trajectory,
  previewTrajectory,
  ghostTrajectory,
  // keeperTrajectory,
  result,
  resultVisible = true,
  dimmed = false,
  stepIndex,
  config,
  instantCamera = false,
  onTrajectoryComplete,
  ballPosition = [0, 0],
}: Props) {
  const ballRef = useRef<THREE.Mesh>(null!)
  const [triggerRecenter, setTriggerRecenter] = useState(0)

  // Ambient crowd noise
  useEffect(() => {
    const crowdAudio = new Audio('/crowd.mp3')
    crowdAudio.loop = true
    crowdAudio.volume = 0.15 // Moderate volume: not too loud, not too quiet

    const playPromise = crowdAudio.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Browsers often block autoplay until user interacts with the page
        const handleInteraction = () => {
          crowdAudio.play().catch(e => console.log('Audio play failed:', e))
          window.removeEventListener('click', handleInteraction)
          window.removeEventListener('keydown', handleInteraction)
        }
        window.addEventListener('click', handleInteraction)
        window.addEventListener('keydown', handleInteraction)
      })
    }

    return () => {
      crowdAudio.pause()
      crowdAudio.src = ''
    }
  }, [])

  return (
    <div className="pitch-scene-wrapper">
      <Canvas
        camera={{
          position: camera.position,
          fov: 55,
          near: 0.1,
          far: 500,
        }}
        shadows
      >
        <CameraController
          target={camera.target}
          position={camera.position}
          instant={instantCamera}
          triggerRecenter={triggerRecenter}
          trackBall={stepIndex === 5}
          ballRef={ballRef}
        />

        <ambientLight intensity={0.6} />
        <directionalLight
          position={[50, 80, -30]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={4096}
          shadow-mapSize-height={4096}
          shadow-bias={-0.0005}
        >
          <orthographicCamera attach="shadow-camera" left={-120} right={120} top={120} bottom={-120} near={0.1} far={300} />
        </directionalLight>
        {/* Volumetric sun ray proxy */}
        <mesh position={[25, 40, -15]} rotation={[Math.PI / 4, 0, Math.PI / 6]}>
          <cylinderGeometry args={[5, 20, 100, 32, 1, true]} />
          <meshBasicMaterial color="#ffedd5" transparent opacity={0.03} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <hemisphereLight color="#87ceeb" groundColor="#2d8a4e" intensity={0.4} />

        <Sky sunPosition={[100, 20, 100]} turbidity={8} rayleigh={0.5} />
        <fog attach="fog" args={['#87ceeb', 80, 300]} />
        
        {/* Clouds */}
        <Cloud position={[-60, 50, -100]} speed={0.1} opacity={0.4} segments={20} scale={2} />
        <Cloud position={[60, 60, -80]} speed={0.15} opacity={0.5} segments={25} scale={2} />
        <Cloud position={[0, 70, -120]} speed={0.1} opacity={0.6} segments={30} scale={3} />
        
        {/* Birds */}
        <Birds />

        {/* Defensive Wall */}
        <DefensiveWall ballPosition={ballPosition} isShooting={(trajectory && trajectory.length > 0) || false} />

        <Pitch />
        <Grass windSpeed={config.conditions?.wind_speed_m_s} windDirection={config.conditions?.wind_direction_deg} />
        
        {/* Sideline NPCs */}
        {stepIndex >= 0 && (
          <group>
            <Coach position={[-29, 0, 6]} rotation={[0, Math.PI/2, 0]} />
            <PlayerWarmup position={[-29, 0, 2]} rotation={[0, Math.PI/2, 0]} offset={0} />
            <PlayerWarmup position={[-29, 0, 3.5]} rotation={[0, Math.PI/2, 0]} offset={Math.PI} />
            <BallRack position={[-29, 0, 10]} rotation={[0, Math.PI/2, 0]} />
            
            <Coach position={[-29, 0, 20]} rotation={[0, Math.PI/2, 0]} />
            <PlayerWarmup position={[-29, 0, 24]} rotation={[0, Math.PI/2, 0]} offset={2} />
            
            <CameraOperator position={[28, 0, -2]} rotation={[0, -Math.PI/4, 0]} />
            <CameraOperator position={[-28, 0, 28]} rotation={[0, Math.PI/4, 0]} />
          </group>
        )}

        <ArenaEnvironment stadiumId={config.stadiumId} hideRoof={stepIndex < 0} />
        {stepIndex < 0 && <BCPlace />}
        {config.conditions && (
          <>
            <WindParticles speed={config.conditions.wind_speed_m_s} direction={config.conditions.wind_direction_deg} />
            <CornerFlag speed={config.conditions.wind_speed_m_s} direction={config.conditions.wind_direction_deg} />
          </>
        )}
        <GoalPosts ballRef={ballRef} />
        <GoalPosts ballRef={ballRef} isNorth />
        <DistanceMarkers />

        {/* Ball at starting position when no trajectory */}
        {(!trajectory || trajectory.length === 0) && (
          <StaticBall position={ballPosition} />
        )}

        {/* Live Preview line for Angles (Steps 1 and 2) */}
        {(stepIndex === 1 || stepIndex === 2) && (
          <AimPreview config={config} ballPosition={ballPosition} />
        )}

        {/* Live Spin Arrows for Spin (Step 3) */}
        {stepIndex === 3 && (
          <>
            {previewTrajectory && previewTrajectory.length > 0 && (
              <Line
                points={previewTrajectory.map((p) => new THREE.Vector3(p.x, p.y, p.z))}
                color="#f59e0b" // Glowing amber
                lineWidth={3}
                dashed
                dashSize={0.5}
                gapSize={0.2}
                opacity={0.8}
                transparent
              />
            )}
          </>
        )}

        {/* Trajectory animation when available */}
        {trajectory && trajectory.length > 0 && (
          <>
            <TrajectoryAnimation
              trajectory={trajectory}
              ghostTrajectory={ghostTrajectory || []}
              ballRef={ballRef}
              onComplete={onTrajectoryComplete}
            />
            {/* Goalkeeper temporarily removed as per user request */}
            {/* {keeperTrajectory && <Goalkeeper trajectory={keeperTrajectory} />} */}
          </>
        )}
      </Canvas>

      {dimmed && <div className="scene-dim" />}

      {stepIndex >= 0 && stepIndex <= 3 && (
        <button
          className="wizard-btn secondary"
          style={{ position: 'absolute', bottom: '30px', left: '30px', zIndex: 100, pointerEvents: 'auto', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setTriggerRecenter(t => t + 1) }}
        >
          <span style={{ marginRight: '8px' }}>🎯</span>
          Recenter
        </button>
      )}

      {resultVisible && result && (
        <div
          className="result-badge"
          style={{
            background: result === 'goal' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
          }}
        >
          {result === 'goal' ? '⚽ GOAL!' : '❌ MISSED'}
        </div>
      )}
    </div>
  )
}

function CameraController({
  position, target, instant = false, triggerRecenter = 0, trackBall = false, ballRef
}: {
  position: [number, number, number]; target: [number, number, number]; instant?: boolean; triggerRecenter?: number; trackBall?: boolean; ballRef?: React.MutableRefObject<THREE.Mesh>
}) {
  const controlsRef = useRef<any>(null)
  const currentTarget = useMemo(() => new THREE.Vector3(), [])
  const currentPos = useMemo(() => new THREE.Vector3(), [])
  const desiredCam = useMemo(() => new THREE.Vector3(), [])
  const closeTrackOffset = useMemo(() => new THREE.Vector3(0, 2.8, -4.2), [])

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.setLookAt(
        position[0], position[1], position[2],
        target[0], target[1], target[2],
        !instant
      )
    }
  }, [position, target, instant, triggerRecenter])

  useFrame(() => {
    if (!trackBall || !ballRef?.current || !controlsRef.current) return

    const ballPos = ballRef.current.position
    desiredCam.copy(ballPos).add(closeTrackOffset)

    if (controlsRef.current.getTarget) {
      controlsRef.current.getTarget(currentTarget)
      currentTarget.lerp(ballPos, 0.35)
      controlsRef.current.setTarget(currentTarget.x, currentTarget.y, currentTarget.z, false)
    }

    if (controlsRef.current.getPosition) {
      controlsRef.current.getPosition(currentPos)
      currentPos.lerp(desiredCam, 0.35)
      controlsRef.current.setPosition(currentPos.x, currentPos.y, currentPos.z, false)
    } else {
      controlsRef.current.setLookAt(
        desiredCam.x,
        desiredCam.y,
        desiredCam.z,
        ballPos.x,
        ballPos.y,
        ballPos.z,
        false,
      )
    }
  })
  useEffect(() => {
    if (controlsRef.current) {
      // Hard bound the camera to stay inside the stadium walls
      // Expanded from 45/55 to 100 so the camera has room to zoom out!
      const box = new THREE.Box3(
        new THREE.Vector3(-100, 0.5, -100),
        new THREE.Vector3(100, 100, 100)
      )
      controlsRef.current.setBoundary(box)
      controlsRef.current.boundaryEnclosesCamera = true
    }
  }, [])

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      maxPolarAngle={Math.PI / 2 - 0.05} // Don't let camera go below ground
      minDistance={2}
      maxDistance={40}
      dollySpeed={1.5}
      mouseButtons={{
        left: 1, // ROTATE
        middle: 16, // DOLLY
        right: 0, // Disable TRUCK completely
        wheel: 16, // DOLLY
      }}
      touches={{
        one: 64, // TOUCH_ROTATE
        two: 1024, // TOUCH_DOLLY only
        three: 0, // Disable TOUCH_TRUCK
      }}
    />
  )
}

const SoccerBall = forwardRef<THREE.Mesh, any>((props, ref) => {
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader()
    const tex = loader.load('/jabulani.png')
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  return (
    <mesh ref={ref} {...props} castShadow>
      <sphereGeometry args={[0.11, 32, 32]} />
      <meshStandardMaterial map={texture} roughness={0.4} metalness={0.1} />
    </mesh>
  )
})

function StaticBall({ position = [0, 0] }: { position?: [number, number] }) {
  return <SoccerBall position={[position[0], 0.11, position[1]]} />
}

// ---------------------------------------------------------------
// Aim Preview Line
// ---------------------------------------------------------------
function AimPreview({ config, ballPosition = [0, 0] }: { config: KickConfig; ballPosition?: [number, number] }) {
  const points = useMemo(() => {
    const pts = []
    const radH = (-config.horizontalAngle * Math.PI) / 180 // -x is left
    const radV = (config.verticalAngle * Math.PI) / 180
    // Draw a simple parabolic or straight arc preview
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      const distance = t * 15 // project out 15 meters
      const x = ballPosition[0] + distance * Math.sin(radH)
      const z = ballPosition[1] + distance * Math.cos(radH)
      const y = 0.11 + distance * Math.tan(radV) - (0.5 * 9.8 * Math.pow(distance / 20, 2))
      pts.push(new THREE.Vector3(x, Math.max(0.11, y), z))
    }
    return pts
  }, [config.horizontalAngle, config.verticalAngle, ballPosition])

  return (
    <Line points={points} color="#f59e0b" lineWidth={3} dashed dashSize={0.5} gapSize={0.2} opacity={0.8} transparent />
  )
}

// ---------------------------------------------------------------
// Spin Arrows
// ---------------------------------------------------------------
function Pitch() {
  const y = 0.02
  const hw = 20
  const hl = 27

  const circlePts: [number, number, number][] = []
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * Math.PI * 2
    circlePts.push([Math.cos(angle) * 5, y, Math.sin(angle) * 5])
  }

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[40, 54]} />
        <meshStandardMaterial color="#388e3c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
        <circleGeometry args={[0.2, 32]} />
        <meshStandardMaterial color="white" />
      </mesh>

      <PitchLine points={circlePts} />
      <PitchLine points={[[-hw, y, 0], [hw, y, 0]]} />
      <PitchLine points={[[-hw, y, -hl], [hw, y, -hl], [hw, y, hl], [-hw, y, hl], [-hw, y, -hl]]} />

      {/* South (Main) Goal Lines */}
      <PitchLine points={[[-12, y, hl], [-12, y, hl - 14], [12, y, hl - 14], [12, y, hl]]} />
      <PitchLine points={[[-5, y, hl], [-5, y, hl - 5], [5, y, hl - 5], [5, y, hl]]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, hl - 9]}>
        <circleGeometry args={[0.15, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* North Goal Lines */}
      <PitchLine points={[[-12, y, -hl], [-12, y, -hl + 14], [12, y, -hl + 14], [12, y, -hl]]} />
      <PitchLine points={[[-5, y, -hl], [-5, y, -hl + 5], [5, y, -hl + 5], [5, y, -hl]]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, -hl + 9]}>
        <circleGeometry args={[0.15, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  )
}

function PitchLine({ points }: { points: [number, number, number][] }) {
  const vecs = points.map((p) => new THREE.Vector3(...p))
  return <Line points={vecs} color="white" lineWidth={2} opacity={0.7} transparent />
}

function DynamicNet({
  width,
  height,
  position,
  rotation,
  ballRef,
}: {
  width: number
  height: number
  position: [number, number, number]
  rotation?: [number, number, number]
  ballRef: React.MutableRefObject<THREE.Mesh>
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const initialPositions = useRef<Float32Array | null>(null)
  const velocities = useRef<Float32Array | null>(null)
  const worldPosVec = useMemo(() => new THREE.Vector3(), [])
  const localPosVec = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (meshRef.current) {
      const geometry = meshRef.current.geometry
      initialPositions.current = geometry.attributes.position.array.slice() as Float32Array
      velocities.current = new Float32Array(initialPositions.current.length)
    }
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current || !initialPositions.current || !velocities.current || !ballRef.current) return

    // Cap delta to prevent physics explosion on lag spikes
    const dt = Math.min(delta, 0.03)

    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position.array as Float32Array
    const ballPos = ballRef.current.position

    let needsUpdate = false

    // Physics parameters
    const kAnchor = 10.0 // weak anchor to return to shape
    const kStructural = 300.0 // strong structural spring for wave propagation
    const damping = 0.95 // Velocity damping
    const interactionRadius = 0.8 // How close the ball needs to be to affect vertices

    const cols = 33 // 32 width segments + 1
    const rows = 17 // 16 height segments + 1

    // Precompute displacements
    const disp = new Float32Array(positions.length)
    for (let i = 0; i < positions.length; i++) {
      disp[i] = positions[i] - initialPositions.current[i]
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        const i3 = idx * 3

        // Fixed edges
        if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
          velocities.current[i3] = 0
          velocities.current[i3 + 1] = 0
          velocities.current[i3 + 2] = 0
          continue
        }

        let forceX = -kAnchor * disp[i3]
        let forceY = -kAnchor * disp[i3 + 1]
        let forceZ = -kAnchor * disp[i3 + 2]

        // Structural forces (Laplacian)
        const neighbors = [
          (idx - cols) * 3, // top
          (idx + cols) * 3, // bottom
          (idx - 1) * 3,    // left
          (idx + 1) * 3     // right
        ]

        for (const n3 of neighbors) {
          forceX += kStructural * (disp[n3] - disp[i3])
          forceY += kStructural * (disp[n3 + 1] - disp[i3 + 1])
          forceZ += kStructural * (disp[n3 + 2] - disp[i3 + 2])
        }

        // Ball collision
        localPosVec.set(positions[i3], positions[i3 + 1], positions[i3 + 2])
        worldPosVec.copy(localPosVec)
        worldPosVec.applyMatrix4(meshRef.current.matrixWorld)

        const dist = worldPosVec.distanceTo(ballPos)
        if (dist < interactionRadius) {
          const pushForce = Math.pow((interactionRadius - dist) / interactionRadius, 2)
          const dirX = worldPosVec.x - ballPos.x
          const dirY = worldPosVec.y - ballPos.y
          const dirZ = worldPosVec.z - ballPos.z

          const pushWorld = new THREE.Vector3(dirX, dirY, dirZ).normalize().multiplyScalar(pushForce * 20.0)

          forceX += pushWorld.x
          forceY += pushWorld.y
          forceZ += pushWorld.z
        }

        // Update velocity
        velocities.current[i3] += forceX * dt
        velocities.current[i3 + 1] += forceY * dt
        velocities.current[i3 + 2] += forceZ * dt

        // Apply damping
        velocities.current[i3] *= damping
        velocities.current[i3 + 1] *= damping
        velocities.current[i3 + 2] *= damping

        // Update position
        const vx = velocities.current[i3]
        const vy = velocities.current[i3 + 1]
        const vz = velocities.current[i3 + 2]

        if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001 || Math.abs(vz) > 0.001 || Math.abs(disp[i3]) > 0.001) {
          positions[i3] += vx * dt
          positions[i3 + 1] += vy * dt
          positions[i3 + 2] += vz * dt
          needsUpdate = true
        }
      }
    }

    if (needsUpdate) {
      geometry.attributes.position.needsUpdate = true
      geometry.computeVertexNormals()
    }
  })

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[width, height, 32, 16]} />
      <meshStandardMaterial color="#e2e8f0" opacity={0.3} transparent side={THREE.DoubleSide} wireframe />
    </mesh>
  )
}

function GoalPosts({ ballRef, isNorth = false }: { ballRef: React.MutableRefObject<THREE.Mesh>; isNorth?: boolean }) {
  const postRadius = 0.06
  const crossbarY = 2.44
  const halfWidth = 7.32 / 2
  const goalZ = isNorth ? -27 : 27
  const netDepth = 2.0
  const rotY = isNorth ? Math.PI : 0

  return (
    <group position={[0, 0, goalZ]} rotation={[0, rotY, 0]}>
      {/* Posts */}
      <mesh position={[-halfWidth, crossbarY / 2, 0]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, crossbarY, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[halfWidth, crossbarY / 2, 0]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, crossbarY, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0, crossbarY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, 7.32, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Net Back */}
      <DynamicNet width={7.32} height={crossbarY} position={[0, crossbarY / 2, netDepth]} ballRef={ballRef} />
      {/* Net Left */}
      <DynamicNet width={netDepth} height={crossbarY} position={[-halfWidth, crossbarY / 2, netDepth / 2]} rotation={[0, Math.PI / 2, 0]} ballRef={ballRef} />
      {/* Net Right */}
      <DynamicNet width={netDepth} height={crossbarY} position={[halfWidth, crossbarY / 2, netDepth / 2]} rotation={[0, Math.PI / 2, 0]} ballRef={ballRef} />
      {/* Net Top */}
      <DynamicNet width={7.32} height={netDepth} position={[0, crossbarY, netDepth / 2]} rotation={[-Math.PI / 2, 0, 0]} ballRef={ballRef} />

      <Text position={[0, crossbarY + 0.5, 0]} rotation={[0, Math.PI, 0]} fontSize={0.4} color="#1e6b38" anchorX="center" anchorY="bottom" font={undefined}>
        GOAL
      </Text>
    </group>
  )
}

// ---------------------------------------------------------------
// Procedural Arena — per-stadium 3D models
// ---------------------------------------------------------------

function ArenaEnvironment({ stadiumId, hideRoof = false }: { stadiumId: string; hideRoof?: boolean }) {
  const primitives = getStadiumPrimitives(stadiumId, hideRoof)

  return (
    <group position={[0, 0, -22.75]} scale={[1, 1, 1.75]}>
      {primitives.map((p: any, i: number) => {
        if (p.type === 'cylinder') {
          return (
            <mesh key={i} position={new THREE.Vector3(...p.pos)} rotation={new THREE.Euler(...p.rot)} receiveShadow castShadow>
              <cylinderGeometry args={p.args} />
              <meshStandardMaterial color={p.color} roughness={0.9} transparent={p.opacity != null} opacity={p.opacity ?? 1} />
            </mesh>
          )
        }
        return (
          <mesh key={i} position={new THREE.Vector3(...p.pos)} rotation={new THREE.Euler(...p.rot)} receiveShadow castShadow>
            <boxGeometry args={p.size as [number, number, number]} />
            <meshStandardMaterial color={p.color} roughness={0.9} transparent={p.opacity != null} opacity={p.opacity ?? 1} />
          </mesh>
        )
      })}
    </group>
  )
}

function DistanceMarkers() {
  const distances = [5, 10, 15, 20, 25]
  return (
    <group>
      {distances.map((d) => (
        <group key={d} position={[0, 0, d]}>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[10, 0.1]} />
            <meshStandardMaterial color="#ffffff" opacity={0.3} transparent />
          </mesh>
          <Text position={[2, 0.1, 0]} rotation={[-Math.PI / 2, 0, Math.PI]} fontSize={0.35} color="#94a3b8" anchorX="right" font={undefined}>
            {Math.abs(d)}m
          </Text>
        </group>
      ))}
    </group>
  )
}

function TrajectoryAnimation({
  trajectory,
  ghostTrajectory,
  ballRef,
  onComplete,
}: {
  trajectory: TrajectoryPoint[]
  ghostTrajectory: TrajectoryPoint[]
  ballRef: React.MutableRefObject<THREE.Mesh>
  onComplete?: () => void
}) {
  const [frameIndex, setFrameIndex] = useState(0)
  const [animating, setAnimating] = useState(true)
  const completedRef = useRef(false)
  const missDetectedRef = useRef(false)

  const pathPoints = useMemo(() => trajectory.map((p) => new THREE.Vector3(p.x, p.y, p.z)), [trajectory])
  const animatedTrajectory = useMemo(() => extendTrajectoryWithPhysics(trajectory), [trajectory])
  const animatedPoints = useMemo(() => animatedTrajectory.map((p) => new THREE.Vector3(p.x, p.y, p.z)), [animatedTrajectory])
  const ghostPoints = useMemo(() => ghostTrajectory.map((p) => new THREE.Vector3(p.x, p.y, p.z)), [ghostTrajectory])
  const trailPoints = useMemo(() => animatedPoints.slice(0, frameIndex + 1), [animatedPoints, frameIndex])

  useEffect(() => {
    setFrameIndex(0)
    setAnimating(true)
    completedRef.current = false
    missDetectedRef.current = false
  }, [trajectory])

  useEffect(() => {
    if (!animating && !completedRef.current && !missDetectedRef.current) {
      completedRef.current = true
      onComplete?.()
    }
  }, [animating, onComplete])

  useFrame(() => {
    if (!animating || animatedTrajectory.length === 0) return
    const nextFrame = frameIndex + 1
    if (nextFrame < animatedTrajectory.length) {
      setFrameIndex(nextFrame)
      if (ballRef.current) {
        const pt = animatedTrajectory[nextFrame]
        const prev = animatedTrajectory[Math.max(0, nextFrame - 1)]
        ballRef.current.position.set(pt.x, pt.y, pt.z)
        const dx = pt.x - prev.x
        const dz = pt.z - prev.z
        const horizontalDistance = Math.sqrt(dx * dx + dz * dz)
        if (horizontalDistance > 0.0001) {
          ballRef.current.rotation.x += dz / 0.11
          ballRef.current.rotation.z -= dx / 0.11
        }
        ballRef.current.rotation.y += horizontalDistance * 0.15

        if (!missDetectedRef.current && pt.z > 27.2 && (pt.x < -3.7 || pt.x > 3.7 || pt.y > 2.5)) {
          missDetectedRef.current = true
          completedRef.current = true
          onComplete?.()
        }
      }
    } else {
      setAnimating(false)
    }
  })

  if (trajectory.length === 0) return null

  return (
    <group>
      <SoccerBall ref={ballRef} position={[animatedTrajectory[0].x, animatedTrajectory[0].y, animatedTrajectory[0].z]} />
      {trailPoints.length >= 2 && <Line points={trailPoints} color="#f59e0b" lineWidth={3} opacity={0.9} transparent />}
      {!animating && pathPoints.length >= 2 && <Line points={pathPoints} color="#f59e0b" lineWidth={1.5} opacity={0.4} transparent />}
      {ghostPoints.length >= 2 && <Line points={ghostPoints} color="#cbd5e1" lineWidth={2} opacity={0.5} transparent dashed dashSize={0.5} gapSize={0.2} />}
    </group>
  )
}

function extendTrajectoryWithPhysics(trajectory: TrajectoryPoint[]): TrajectoryPoint[] {
  if (trajectory.length < 2) return trajectory

  const groundY = 0.11
  const gravity = 9.81
  const restitution = 0.46
  const bounceDamping = 0.86
  const rollFriction = 1.9
  const stopSpeed = 0.18
  const step = 1 / 30
  const maxExtraTime = 5.0

  const points = trajectory.map((p) => ({ ...p }))
  const prev = trajectory[trajectory.length - 2]
  const last = trajectory[trajectory.length - 1]
  const dt = Math.max(last.t - prev.t, step)

  let x = last.x
  let y = Math.max(last.y, groundY)
  let z = last.z
  let vx = (last.x - prev.x) / dt
  let vy = (last.y - prev.y) / dt
  let vz = (last.z - prev.z) / dt
  let time = last.t
  let rolling = false

  for (let i = 0; i < Math.ceil(maxExtraTime / step); i++) {
    time += step

    const netFrontZ = 27.0
    const netBackZ = 29.5
    const netHalfWidth = 3.55
    const netHeight = 2.40
    const inNetZone = x >= -netHalfWidth && x <= netHalfWidth && y <= netHeight
    const aboutToEnterNet = z >= netFrontZ && inNetZone

    if (aboutToEnterNet) {
      // Net catching the ball. Clamp it to the back net plane and slow it down.
      vx *= 0.2
      vy *= 0.3
      vz *= 0.2
      vy -= gravity * step

      x += vx * step
      y += vy * step
      z += vz * step

      if (z > netBackZ) {
        z = netBackZ
        vz = 0
        vx *= 0.4
      }

      if (y <= groundY) {
        y = groundY
        vy = 0
        vx = 0
        vz = 0
      }

      points.push({ x: round3(x), y: round3(y), z: round3(z), t: round3(time) })

      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz)
      if (speed < 0.05 && y <= groundY) break
      continue
    }

    if (!rolling) {
      vy -= gravity * step
      x += vx * step
      y += vy * step
      z += vz * step

      if (y <= groundY) {
        y = groundY
        if (Math.abs(vy) < 1.1) {
          rolling = true
          vy = 0
          vx *= bounceDamping
          vz *= bounceDamping
        } else {
          vy = -vy * restitution
          vx *= bounceDamping
          vz *= bounceDamping
        }
      }
    } else {
      x += vx * step
      z += vz * step
      y = groundY

      const horizontalSpeed = Math.sqrt(vx * vx + vz * vz)
      if (horizontalSpeed < stopSpeed) {
        points.push({ x: round3(x), y: groundY, z: round3(z), t: round3(time) })
        break
      }

      const decay = Math.max(0, 1 - rollFriction * step)
      vx *= decay
      vz *= decay
    }

    points.push({ x: round3(x), y: round3(y), z: round3(z), t: round3(time) })

    if (rolling) {
      const horizontalSpeed = Math.sqrt(vx * vx + vz * vz)
      if (horizontalSpeed < stopSpeed) break
    }
  }

  return points
}

// ---------------------------------------------------------------
// Birds
// ---------------------------------------------------------------
function Birds() {
  const group = useRef<THREE.Group>(null!)
  const numBirds = 20
  
  const birdsData = useMemo(() => {
    return new Array(numBirds).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 300,
      y: 60 + Math.random() * 60,
      z: (Math.random() - 0.5) * 300,
      speed: 0.5 + Math.random() * 1.5,
      angle: Math.random() * Math.PI * 2,
      radius: 30 + Math.random() * 100
    }))
  }, [])

  useFrame((state) => {
    if (group.current) {
      group.current.children.forEach((bird, i) => {
        const data = birdsData[i]
        data.angle += (data.speed * 0.005)
        
        const newX = data.x + Math.cos(data.angle) * data.radius
        const newZ = data.z + Math.sin(data.angle) * data.radius
        
        // Point the bird in the direction of movement
        bird.lookAt(newX, bird.position.y, newZ)
        
        bird.position.x = newX
        bird.position.z = newZ
        bird.position.y = data.y + Math.sin(state.clock.elapsedTime * data.speed + i) * 3
      })
    }
  })

  return (
    <group ref={group}>
      {birdsData.map((_, i) => (
        <mesh key={i}>
          {/* A small flattened cone acts as a bird silhouette */}
          <coneGeometry args={[0.6, 1.2, 3]} />
          <meshBasicMaterial color="#ffffff" fog={true} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------
// Defensive Wall
// ---------------------------------------------------------------
function DefensiveWall({ ballPosition, isShooting }: { ballPosition: [number, number]; isShooting: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const jumpStartTime = useRef(0)
  const jumpHeightParams = useRef({ v: 0, g: 0 })
  const isJumping = useRef(false)
  const hasJumped = useRef(false)

  // Only jump once per shot
  useEffect(() => {
    if (isShooting && !hasJumped.current) {
      // Players jump immediately when the shot is fired
      isJumping.current = true
      hasJumped.current = true
      jumpStartTime.current = performance.now()
      
      // We want a very visible jump: height ~0.4m to 0.6m
      // y = v*t - 0.5*g*t^2
      const h = 0.4 + Math.random() * 0.3
      const hangTime = 0.8 + Math.random() * 0.2
      // h = v*(hangTime/2) - 0.5*g*(hangTime/2)^2
      // root at hangTime: 0 = v*hangTime - 0.5*g*hangTime^2 => v = 0.5*g*hangTime => g = 2v/hangTime
      // peak is at t = hangTime/2 => h = v*(hangTime/2) - 0.5*(2v/hangTime)*(hangTime/2)^2 = v*hangTime/2 - v*hangTime/4 = v*hangTime/4
      // => v = 4h / hangTime
      const v = (4 * h) / hangTime
      const g = (2 * v) / hangTime
      jumpHeightParams.current = { v, g }

    } else if (!isShooting) {
      // Reset when not shooting
      hasJumped.current = false
      isJumping.current = false
      if (groupRef.current) groupRef.current.position.y = 0
    }
  }, [isShooting])

  useFrame(() => {
    if (isJumping.current && groupRef.current) {
      const t = (performance.now() - jumpStartTime.current) / 1000
      const { v, g } = jumpHeightParams.current
      let y = v * t - 0.5 * g * t * t

      if (y <= 0 && t > 0.1) {
        y = 0
        isJumping.current = false
      }
      groupRef.current.position.y = y
    }
  })

  // Math for wall placement
  const distToGoal = Math.hypot(0 - ballPosition[0], 27 - ballPosition[1])
  const wallDist = Math.min(9.144, distToGoal - 2) // 10 yards away, but at least 2m from goal line
  if (distToGoal < 10) return null // No wall if too close to goal

  const dirX = (0 - ballPosition[0]) / distToGoal
  const dirZ = (27 - ballPosition[1]) / distToGoal

  // Base position of the wall
  const wallX = ballPosition[0] + dirX * wallDist
  const wallZ = ballPosition[1] + dirZ * wallDist

  const spacing = 0.65
  const offsets = [-1.5 * spacing, -0.5 * spacing, 0.5 * spacing, 1.5 * spacing]

  // Calculate rotation to face the ball
  const rotationY = Math.atan2(dirX, dirZ) + Math.PI

  return (
    <group position={[wallX, 0, wallZ]} rotation={[0, rotationY, 0]}>
      <group ref={groupRef}>
        {offsets.map((offset, i) => (
          <WallPlayer key={i} offsetX={offset} />
        ))}
      </group>
    </group>
  )
}

// Shared texture for all wall players (loaded once)
const playerTexture = new THREE.TextureLoader().load('/player_sprite.png')
playerTexture.colorSpace = THREE.SRGBColorSpace

function WallPlayer({ offsetX }: { offsetX: number }) {
  // Photorealistic billboard sprite — always faces camera
  const spriteW = 1.0  // width in world units
  const spriteH = 1.85 // height in world units (roughly human proportions)

  return (
    <group position={[offsetX, spriteH / 2, 0]}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh castShadow>
          <planeGeometry args={[spriteW, spriteH]} />
          <meshStandardMaterial
            map={playerTexture}
            transparent
            alphaTest={0.5}
            side={THREE.DoubleSide}
            roughness={0.7}
          />
        </mesh>
      </Billboard>
    </group>
  )
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

export function StadiumShell() {
  return (
    <group>
      {/* Outer elliptical wall */}
      <mesh position={[0, 15, 0]}>
        <cylinderGeometry args={[50, 45, 30, 32, 1, true]} />
        <meshStandardMaterial color="#4a5568" transparent opacity={0.3} wireframe />
      </mesh>
      {/* Roof ring */}
      <mesh position={[0, 30, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[35, 50, 32]} />
        <meshStandardMaterial color="#2d3748" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export function WindParticles({ speed, direction }: { speed: number; direction: number }) {
  const count = 300
  const particles = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 80,
        Math.random() * 30,
        (Math.random() - 0.5) * 80
      ),
      length: 1 + Math.random() * 3,
      speedVariance: 0.8 + Math.random() * 0.4,
      verticalSway: (Math.random() - 0.5) * 2
    }))
  }, [count])

  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dirRad = THREE.MathUtils.degToRad(direction)
  const baseSpeed = speed * 0.8 + 3
  const vel = new THREE.Vector3(Math.sin(dirRad), 0, Math.cos(dirRad)).multiplyScalar(baseSpeed)

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    const time = state.clock.getElapsedTime()
    particles.forEach((p, i) => {
      p.position.x += vel.x * p.speedVariance * delta
      p.position.z += vel.z * p.speedVariance * delta
      p.position.y += Math.sin(time * 2 + i) * p.verticalSway * delta

      if (p.position.x > 40) p.position.x -= 80
      if (p.position.x < -40) p.position.x += 80
      if (p.position.z > 40) p.position.z -= 80
      if (p.position.z < -40) p.position.z += 80
      if (p.position.y > 30) p.position.y -= 30
      if (p.position.y < 0) p.position.y += 30

      dummy.position.copy(p.position)
      const lookDir = p.position.clone().add(new THREE.Vector3(vel.x * p.speedVariance, Math.sin(time * 2 + i) * p.verticalSway, vel.z * p.speedVariance))
      dummy.lookAt(lookDir)
      dummy.scale.set(1, 1, p.length)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.04, 0.04, 1.5]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
    </instancedMesh>
  )
}

export function Goalkeeper({ trajectory }: { trajectory: TrajectoryPoint[] }) {
  const groupRef = useRef<THREE.Group>(null!)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(0)
  }, [trajectory])

  useFrame((_, delta) => {
    if (!groupRef.current || trajectory.length === 0) return

    // We animate based on elapsed time rather than strict integration frames,
    // because the keeper trajectory only has a few keyframes (start, dive_start, dive_end)
    const t = elapsed + delta
    setElapsed(t)

    // Find the current keyframe interval
    let prev = trajectory[0]
    let next = trajectory[trajectory.length - 1]

    for (let i = 0; i < trajectory.length - 1; i++) {
      if (t >= trajectory[i].t && t <= trajectory[i + 1].t) {
        prev = trajectory[i]
        next = trajectory[i + 1]
        break
      }
    }

    if (t >= next.t) {
      // Reached the end
      groupRef.current.position.set(next.x, next.y, next.z)
    } else {
      // Interpolate
      const range = next.t - prev.t
      const fraction = range > 0 ? (t - prev.t) / range : 0

      groupRef.current.position.set(
        prev.x + fraction * (next.x - prev.x),
        prev.y + fraction * (next.y - prev.y),
        prev.z + fraction * (next.z - prev.z)
      )
    }

    // Make keeper lean into the dive
    const dx = groupRef.current.position.x
    // Lean angle based on x displacement
    groupRef.current.rotation.z = -dx * 0.2
  })

  return (
    <group ref={groupRef} position={[0, 1, 27]}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.25, 0.7, 4, 8]} />
        <meshStandardMaterial color="#3182ce" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#fbd38d" />
      </mesh>
      {/* Left Arm/Glove */}
      <group position={[-0.4, 0.2, 0.1]} rotation={[0, 0, Math.PI / 4]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.5]} />
          <meshStandardMaterial color="#3182ce" />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.2, 0.25, 0.2]} />
          <meshStandardMaterial color="#dd6b20" />
        </mesh>
      </group>
      {/* Right Arm/Glove */}
      <group position={[0.4, 0.2, 0.1]} rotation={[0, 0, -Math.PI / 4]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.5]} />
          <meshStandardMaterial color="#3182ce" />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.2, 0.25, 0.2]} />
          <meshStandardMaterial color="#dd6b20" />
        </mesh>
      </group>
    </group>
  )
}

export function CornerFlag({ speed, direction }: { speed: number; direction: number }) {
  const groupRef = useRef<THREE.Group>(null!)

  // Wind direction in radians
  const dirRad = THREE.MathUtils.degToRad(direction)

  useFrame((state) => {
    if (groupRef.current) {
      // Basic flapping animation based on speed
      const time = state.clock.getElapsedTime()
      // Flap amplitude based on wind speed
      const flap = speed > 0 ? Math.sin(time * speed * 2) * (0.1 + speed * 0.02) : 0
      // Align flag to wind direction + flap
      // (Assuming 0 deg = North/-Z. We adjust by Math.PI/2 to align plane's normal)
      groupRef.current.rotation.y = dirRad + flap + Math.PI / 2
    }
  })

  return (
    <group position={[20, 0, 27]}>
      {/* Pole */}
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.5]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Animated Flag Group (rotates around the pole) */}
      <group ref={groupRef} position={[0, 1.25, 0]}>
        {/* Offset flag mesh so it hinges at the pole */}
        <mesh position={[0.4, 0, 0]}>
          <planeGeometry args={[0.8, 0.5]} />
          <meshStandardMaterial color="#ef4444" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Speed Label */}
      <Text position={[0, 1.9, 0]} fontSize={0.6} color="#ffffff" anchorX="center" anchorY="bottom" outlineWidth={0.02} outlineColor="#000000">
        {Math.round(speed)} m/s
      </Text>
    </group>
  )
}
