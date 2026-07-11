/**
 * PitchScene — Always-visible 3D scene.
 * Camera position is controlled by the parent via props.
 * Renders pitch, goalposts, ball, trajectory, aim preview, and spin arrows.
 */

import { useRef, useState, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, Text, Torus, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { TrajectoryPoint } from '../api'
import type { KickConfig } from './StepWizard'

export interface CameraConfig {
  position: [number, number, number]
  target: [number, number, number]
}

interface Props {
  camera: CameraConfig
  trajectory?: TrajectoryPoint[]
  ghostTrajectory?: TrajectoryPoint[]
  result?: string
  dimmed?: boolean
  stepIndex: number
  config: KickConfig
  instantCamera?: boolean
}

export default function PitchScene({
  camera,
  trajectory,
  ghostTrajectory,
  result,
  dimmed = false,
  stepIndex,
  config,
  instantCamera = false,
}: Props) {
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
          disabled={stepIndex === 5} 
        />
        
        {stepIndex === 5 && (
          <OrbitControls 
            makeDefault 
            enableDamping 
            target={camera.target} 
            maxPolarAngle={Math.PI / 2 - 0.05} // Don't let camera go below ground
            maxDistance={150}
          />
        )}

        <ambientLight intensity={0.6} />
        <directionalLight
          position={[20, 30, -10]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <hemisphereLight color="#87ceeb" groundColor="#2d8a4e" intensity={0.4} />

        <color attach="background" args={['#d4edda']} />
        <fog attach="fog" args={['#d4edda', 80, 200]} />

        <Pitch />
        <ArenaEnvironment stadiumId={config.stadiumId} />
        <GoalPosts />
        <DistanceMarkers />

        {/* Ball at origin when no trajectory */}
        {(!trajectory || trajectory.length === 0) && (
          <StaticBall />
        )}

        {/* Live Preview line for Angles (Steps 2 and 3) */}
        {(stepIndex === 2 || stepIndex === 3) && (
          <AimPreview config={config} />
        )}

        {/* Live Spin Arrows for Spin (Step 4) */}
        {stepIndex === 4 && (
          <SpinArrows config={config} />
        )}

        {/* Trajectory animation when available */}
        {trajectory && trajectory.length > 0 && (
          <TrajectoryAnimation
            trajectory={trajectory}
            ghostTrajectory={ghostTrajectory || []}
          />
        )}
      </Canvas>

      {dimmed && <div className="scene-dim" />}

      {result && (
        <div
          className="result-badge"
          style={{
            background: result === 'goal' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
          }}
        >
          {result === 'goal' ? '⚽ GOAL!' : '❌ MISS'}
        </div>
      )}
    </div>
  )
}

function CameraController({ position, target, instant = false, disabled = false }: { position: [number, number, number]; target: [number, number, number]; instant?: boolean; disabled?: boolean }) {
  const { camera } = useThree()
  const targetVec = useRef(new THREE.Vector3(...target))
  const posVec = useRef(new THREE.Vector3(...position))

  const dummyCamera = useMemo(() => new THREE.PerspectiveCamera(), [])

  useEffect(() => {
    posVec.current.set(...position)
    targetVec.current.set(...target)
  }, [position, target])

  useFrame(() => {
    if (disabled) return
    const speed = instant ? 1 : 0.04
    
    // Smoothly lerp position
    camera.position.lerp(posVec.current, speed)
    
    // Calculate the desired rotation using a dummy camera
    dummyCamera.position.copy(camera.position)
    // For top-down views, prevent the exact [0, -1, 0] forward vector from causing Up-vector singularity
    if (dummyCamera.position.x === targetVec.current.x && dummyCamera.position.z === targetVec.current.z) {
        dummyCamera.position.z += 0.001
    }
    dummyCamera.up.set(0, 1, 0)
    dummyCamera.lookAt(targetVec.current)
    
    // Smoothly slerp rotation
    camera.quaternion.slerp(dummyCamera.quaternion, speed)
  })
  return null
}

function StaticBall() {
  return (
    <mesh position={[0, 0.11, 0]} castShadow>
      <sphereGeometry args={[0.11, 24, 24]} />
      <meshStandardMaterial color="white" roughness={0.3} metalness={0.1} />
    </mesh>
  )
}

// ---------------------------------------------------------------
// Aim Preview Line
// ---------------------------------------------------------------
function AimPreview({ config }: { config: KickConfig }) {
  const points = useMemo(() => {
    const pts = []
    const radH = (-config.horizontalAngle * Math.PI) / 180 // -x is left
    const radV = (config.verticalAngle * Math.PI) / 180
    // Draw a simple parabolic or straight arc preview
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      const distance = t * 15 // project out 15 meters
      const x = distance * Math.sin(radH)
      const z = distance * Math.cos(radH)
      const y = 0.11 + distance * Math.tan(radV) - (0.5 * 9.8 * Math.pow(distance / 20, 2))
      pts.push(new THREE.Vector3(x, Math.max(0.11, y), z))
    }
    return pts
  }, [config.horizontalAngle, config.verticalAngle])

  return (
    <Line points={points} color="#f59e0b" lineWidth={3} dashed dashSize={0.5} gapSize={0.2} opacity={0.8} transparent />
  )
}

// ---------------------------------------------------------------
// Spin Arrows
// ---------------------------------------------------------------
function SpinArrows({ config }: { config: KickConfig }) {
  // Use Torus to draw circular arrows around the ball
  // Radius of ball is 0.11, so arrow radius is slightly larger
  const R = 0.18
  const maxSpin = 60
  
  // Calculate arc angle based on spin rate and axis weight
  // If spinRate is 60 and axis is 1.0, arc is almost full circle (Math.PI * 1.8)
  const baseArc = (config.spinRate / maxSpin) * Math.PI * 1.8

  const arcX = baseArc * Math.abs(config.spinAxisX)
  const arcY = baseArc * Math.abs(config.spinAxisY)
  const arcZ = baseArc * Math.abs(config.spinAxisZ)

  return (
    <group position={[0, 0.11, 0]}>
      {/* X Axis Spin (Topspin/Backspin) - rotates around X axis */}
      {arcX > 0.1 && (
        <group rotation={[0, 0, -Math.PI / 2]}>
          <Torus args={[R, 0.015, 8, 32, arcX]} position={[0, 0, 0]} material-color="#ef4444" />
        </group>
      )}
      {/* Y Axis Spin (Sidespin) - rotates around Y axis */}
      {arcY > 0.1 && (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <Torus args={[R, 0.015, 8, 32, arcY]} position={[0, 0, 0]} material-color="#22c55e" />
        </group>
      )}
      {/* Z Axis Spin (Corkscrew) - rotates around Z axis */}
      {arcZ > 0.1 && (
        <group rotation={[0, 0, 0]}>
          <Torus args={[R, 0.015, 8, 32, arcZ]} position={[0, 0, 0]} material-color="#3b82f6" />
        </group>
      )}
    </group>
  )
}


function Pitch() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 20]} receiveShadow>
        <planeGeometry args={[40, 60]} />
        <meshStandardMaterial color="#3ba55d" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 20]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#4caf50" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.2, 32]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <PitchLine points={[[-9, 0.02, 10], [-9, 0.02, 27], [9, 0.02, 27], [9, 0.02, 10]]} />
      <PitchLine points={[[-20, 0.02, 27], [20, 0.02, 27]]} />
    </group>
  )
}

function PitchLine({ points }: { points: [number, number, number][] }) {
  const vecs = points.map((p) => new THREE.Vector3(...p))
  return <Line points={vecs} color="white" lineWidth={2} opacity={0.7} transparent />
}

function GoalPosts() {
  const postRadius = 0.06
  const crossbarY = 2.44
  const halfWidth = 7.32 / 2
  const goalZ = 27
  const netDepth = 2.0

  return (
    <group position={[0, 0, goalZ]}>
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
      <mesh position={[0, crossbarY / 2, netDepth]}>
        <planeGeometry args={[7.32, crossbarY]} />
        <meshStandardMaterial color="white" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Net Left */}
      <mesh position={[-halfWidth, crossbarY / 2, netDepth / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[netDepth, crossbarY]} />
        <meshStandardMaterial color="white" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Net Right */}
      <mesh position={[halfWidth, crossbarY / 2, netDepth / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[netDepth, crossbarY]} />
        <meshStandardMaterial color="white" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Net Top */}
      <mesh position={[0, crossbarY, netDepth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.32, netDepth]} />
        <meshStandardMaterial color="white" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      <Text position={[0, crossbarY + 0.5, 0]} fontSize={0.4} color="#1e6b38" anchorX="center" anchorY="bottom" font={undefined}>
        GOAL
      </Text>
    </group>
  )
}

// ---------------------------------------------------------------
// Procedural Arena
// ---------------------------------------------------------------

const STADIUM_THEMES: Record<string, { seats: string; archType: 'bowl' | 'canopy' | 'rectangular' }> = {
  azteca: { seats: '#166534', archType: 'rectangular' }, // Mexico (Steep tiers)
  metlife: { seats: '#1e3a8a', archType: 'rectangular' }, // US (Classic blocky)
  rosebowl: { seats: '#b91c1c', archType: 'bowl' },       // US (Open oval)
  sofi: { seats: '#1e3a8a', archType: 'canopy' },         // US (Massive roof)
  default: { seats: '#475569', archType: 'canopy' },
}

function ArenaEnvironment({ stadiumId }: { stadiumId: string }) {
  const theme = STADIUM_THEMES[stadiumId] || STADIUM_THEMES.default
  
  const blocks = []

  // Base lower tier (exists in all)
  blocks.push({ pos: [-40, 5, 10], rot: [0, 0, -Math.PI / 8], size: [20, 2, 120], color: theme.seats }) // Left
  blocks.push({ pos: [40, 5, 10], rot: [0, 0, Math.PI / 8], size: [20, 2, 120], color: theme.seats })  // Right
  blocks.push({ pos: [0, 5, 50], rot: [-Math.PI / 8, 0, 0], size: [100, 2, 20], color: theme.seats })   // Back
  blocks.push({ pos: [0, 5, -30], rot: [Math.PI / 8, 0, 0], size: [100, 2, 20], color: theme.seats })   // Front

  if (theme.archType === 'bowl') {
    // Open bowl: Add a continuous upper tier, no roof
    blocks.push({ pos: [-55, 15, 10], rot: [0, 0, -Math.PI / 6], size: [20, 2, 140], color: theme.seats })
    blocks.push({ pos: [55, 15, 10], rot: [0, 0, Math.PI / 6], size: [20, 2, 140], color: theme.seats })
    blocks.push({ pos: [0, 15, 65], rot: [-Math.PI / 6, 0, 0], size: [130, 2, 20], color: theme.seats })
    blocks.push({ pos: [0, 15, -45], rot: [Math.PI / 6, 0, 0], size: [130, 2, 20], color: theme.seats })
  } else if (theme.archType === 'rectangular') {
    // Steep rectangular: 3 distinct tiers, no continuous corners, large jumbotron
    blocks.push({ pos: [-45, 18, 10], rot: [0, 0, -Math.PI / 4], size: [20, 2, 100], color: theme.seats })
    blocks.push({ pos: [45, 18, 10], rot: [0, 0, Math.PI / 4], size: [20, 2, 100], color: theme.seats })
    // Jumbotrons
    blocks.push({ pos: [0, 25, 60], rot: [0, 0, 0], size: [30, 15, 2], color: '#111111' })
    blocks.push({ pos: [0, 25, -40], rot: [0, 0, 0], size: [30, 15, 2], color: '#111111' })
  } else if (theme.archType === 'canopy') {
    // Canopy (SoFi style): massive roof covering everything
    blocks.push({ pos: [-50, 15, 10], rot: [0, 0, -Math.PI / 5], size: [20, 2, 130], color: theme.seats })
    blocks.push({ pos: [50, 15, 10], rot: [0, 0, Math.PI / 5], size: [20, 2, 130], color: theme.seats })
    
    // Massive curved roof (simulated with large thin blocks)
    blocks.push({ pos: [0, 40, 10], rot: [0, 0, 0], size: [140, 2, 160], color: '#ffffff' }) // Main canopy
    // Pillars
    blocks.push({ pos: [-65, 20, 50], rot: [0, 0, 0], size: [5, 40, 5], color: '#94a3b8' })
    blocks.push({ pos: [65, 20, 50], rot: [0, 0, 0], size: [5, 40, 5], color: '#94a3b8' })
    blocks.push({ pos: [-65, 20, -30], rot: [0, 0, 0], size: [5, 40, 5], color: '#94a3b8' })
    blocks.push({ pos: [65, 20, -30], rot: [0, 0, 0], size: [5, 40, 5], color: '#94a3b8' })
    
    // Center hanging jumbotron (Oculus style)
    blocks.push({ pos: [0, 25, 10], rot: [0, 0, 0], size: [20, 5, 20], color: '#111111' })
  }

  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={new THREE.Vector3(...b.pos)} rotation={new THREE.Euler(...b.rot)} receiveShadow castShadow>
          <boxGeometry args={b.size as [number, number, number]} />
          <meshStandardMaterial color={b.color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function DistanceMarkers() {
  const distances = [5, 10, 15, 20, 25]
  return (
    <group>
      {distances.map((d) => (
        <group key={d}>
          <PitchLine points={[[-1, 0.02, d], [1, 0.02, d]]} />
          <Text position={[2, 0.1, d]} fontSize={0.35} color="#94a3b8" anchorX="left" font={undefined}>
            {d}m
          </Text>
        </group>
      ))}
    </group>
  )
}

function TrajectoryAnimation({ trajectory, ghostTrajectory }: { trajectory: TrajectoryPoint[]; ghostTrajectory: TrajectoryPoint[] }) {
  const ballRef = useRef<THREE.Mesh>(null!)
  const [frameIndex, setFrameIndex] = useState(0)
  const [animating, setAnimating] = useState(true)

  const pathPoints = useMemo(() => trajectory.map((p) => new THREE.Vector3(p.x, p.y, p.z)), [trajectory])
  const ghostPoints = useMemo(() => ghostTrajectory.map((p) => new THREE.Vector3(p.x, p.y, p.z)), [ghostTrajectory])
  const trailPoints = useMemo(() => pathPoints.slice(0, frameIndex + 1), [pathPoints, frameIndex])

  useMemo(() => {
    setFrameIndex(0)
    setAnimating(true)
  }, [trajectory])

  useFrame(() => {
    if (!animating || trajectory.length === 0) return
    const nextFrame = frameIndex + 1
    if (nextFrame < trajectory.length) {
      setFrameIndex(nextFrame)
      if (ballRef.current) {
        const pt = trajectory[nextFrame]
        ballRef.current.position.set(pt.x, pt.y, pt.z)
      }
    } else {
      setAnimating(false)
    }
  })

  if (trajectory.length === 0) return null

  return (
    <group>
      <mesh ref={ballRef} position={[trajectory[0].x, trajectory[0].y, trajectory[0].z]} castShadow>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshStandardMaterial color="white" roughness={0.3} metalness={0.1} />
      </mesh>
      {trailPoints.length >= 2 && <Line points={trailPoints} color="#f59e0b" lineWidth={3} opacity={0.9} transparent />}
      {!animating && pathPoints.length >= 2 && <Line points={pathPoints} color="#f59e0b" lineWidth={1.5} opacity={0.4} transparent />}
      {ghostPoints.length >= 2 && <Line points={ghostPoints} color="#94a3b8" lineWidth={1.5} opacity={0.35} transparent dashed dashSize={0.3} gapSize={0.15} />}
    </group>
  )
}
