/**
 * PitchScene — Always-visible 3D scene.
 * Camera position is controlled by the parent via props.
 * Renders pitch, goalposts, ball, trajectory, aim preview, and spin arrows.
 */

import { useRef, useState, useMemo, useEffect, forwardRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, Text, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { TrajectoryPoint } from '../api'
import type { KickConfig } from './StepWizard'
import BCPlace from './BCPlace'

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
  dimmed?: boolean
  stepIndex: number
  config: KickConfig
  instantCamera?: boolean
}

export default function PitchScene({
  camera,
  trajectory,
  previewTrajectory,
  ghostTrajectory,
  // keeperTrajectory,
  result,
  dimmed = false,
  stepIndex,
  config,
  instantCamera = false,
}: Props) {
  const ballRef = useRef<THREE.Mesh>(null!)
  
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

        <color attach="background" args={['#87ceeb']} />
        <fog attach="fog" args={['#87ceeb', 80, 300]} />

        <Pitch />
        <ArenaEnvironment stadiumId={config.stadiumId} />
        {stepIndex < 0 && <BCPlace />}
        {config.conditions && (
          <WindParticles speed={config.conditions.wind_speed_m_s} direction={config.conditions.wind_direction_deg} />
        )}
        <GoalPosts ballRef={ballRef} />
        <DistanceMarkers />

        {/* Ball at origin when no trajectory */}
        {(!trajectory || trajectory.length === 0) && (
          <StaticBall />
        )}

        {/* Live Preview line for Angles (Steps 1 and 2) */}
        {(stepIndex === 1 || stepIndex === 2) && (
          <AimPreview config={config} />
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
        {stepIndex === 4 && trajectory && trajectory.length > 0 && (
          <>
            <TrajectoryAnimation
              trajectory={trajectory}
              ghostTrajectory={ghostTrajectory || []}
              ballRef={ballRef}
            />
            {/* Goalkeeper temporarily removed as per user request */}
            {/* {keeperTrajectory && <Goalkeeper trajectory={keeperTrajectory} />} */}
          </>
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

function StaticBall() {
  return <SoccerBall position={[0, 0.11, 0]} />
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
          velocities.current[i3+1] = 0
          velocities.current[i3+2] = 0
          continue
        }
        
        let forceX = -kAnchor * disp[i3]
        let forceY = -kAnchor * disp[i3+1]
        let forceZ = -kAnchor * disp[i3+2]
        
        // Structural forces (Laplacian)
        const neighbors = [
          (idx - cols) * 3, // top
          (idx + cols) * 3, // bottom
          (idx - 1) * 3,    // left
          (idx + 1) * 3     // right
        ]
        
        for (const n3 of neighbors) {
          forceX += kStructural * (disp[n3] - disp[i3])
          forceY += kStructural * (disp[n3+1] - disp[i3+1])
          forceZ += kStructural * (disp[n3+2] - disp[i3+2])
        }
        
        // Ball collision
        localPosVec.set(positions[i3], positions[i3+1], positions[i3+2])
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
        velocities.current[i3+1] += forceY * dt
        velocities.current[i3+2] += forceZ * dt
        
        // Apply damping
        velocities.current[i3] *= damping
        velocities.current[i3+1] *= damping
        velocities.current[i3+2] *= damping
        
        // Update position
        const vx = velocities.current[i3]
        const vy = velocities.current[i3+1]
        const vz = velocities.current[i3+2]
        
        if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001 || Math.abs(vz) > 0.001 || Math.abs(disp[i3]) > 0.001) {
          positions[i3] += vx * dt
          positions[i3+1] += vy * dt
          positions[i3+2] += vz * dt
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

function GoalPosts({ ballRef }: { ballRef: React.MutableRefObject<THREE.Mesh> }) {
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

function TrajectoryAnimation({ trajectory, ghostTrajectory, ballRef }: { trajectory: TrajectoryPoint[]; ghostTrajectory: TrajectoryPoint[]; ballRef: React.MutableRefObject<THREE.Mesh> }) {
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
      <SoccerBall ref={ballRef} position={[trajectory[0].x, trajectory[0].y, trajectory[0].z]} />
      {trailPoints.length >= 2 && <Line points={trailPoints} color="#f59e0b" lineWidth={3} opacity={0.9} transparent />}
      {!animating && pathPoints.length >= 2 && <Line points={pathPoints} color="#f59e0b" lineWidth={1.5} opacity={0.4} transparent />}
      {ghostPoints.length >= 2 && <Line points={ghostPoints} color="#cbd5e1" lineWidth={2} opacity={0.5} transparent dashed dashSize={0.5} gapSize={0.2} />}
    </group>
  )
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
  const count = 60
  const particles = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        Math.random() * 20,
        (Math.random() - 0.5) * 60
      ),
      length: 1 + Math.random() * 2,
    }))
  }, [count])

  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dirRad = THREE.MathUtils.degToRad(direction)
  const vel = new THREE.Vector3(Math.sin(dirRad), 0, Math.cos(dirRad)).multiplyScalar(speed * 0.5 + 2) // minimum speed for visual effect

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    particles.forEach((p, i) => {
      p.position.addScaledVector(vel, delta)
      // wrap around bounds (60x20x60)
      if (p.position.x > 30) p.position.x -= 60
      if (p.position.x < -30) p.position.x += 60
      if (p.position.z > 30) p.position.z -= 60
      if (p.position.z < -30) p.position.z += 60
      
      dummy.position.copy(p.position)
      // Align lines with velocity
      dummy.lookAt(p.position.clone().add(vel))
      dummy.scale.set(1, 1, p.length)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  // Using a box geometry stretched on Z to act as a line
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.05, 0.05, 1]} />
      <meshBasicMaterial color="#e2e8f0" transparent opacity={0.4} />
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
      if (t >= trajectory[i].t && t <= trajectory[i+1].t) {
        prev = trajectory[i]
        next = trajectory[i+1]
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
