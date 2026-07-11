/**
 * PitchScene — Three.js 3D scene with football pitch, goalposts,
 * animated ball flight, and glowing trajectory trail.
 */

import { useRef, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { TrajectoryPoint } from '../api'

interface Props {
  trajectory: TrajectoryPoint[]
  ghostTrajectory: TrajectoryPoint[]
  result: string
}

export default function PitchScene({ trajectory, ghostTrajectory, result }: Props) {
  return (
    <div className="canvas-wrapper">
      <Canvas
        camera={{
          position: [0, 8, -12],
          fov: 55,
          near: 0.1,
          far: 500,
        }}
        shadows
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[20, 30, -10]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <hemisphereLight
          color="#87ceeb"
          groundColor="#2d8a4e"
          intensity={0.4}
        />

        {/* Sky */}
        <color attach="background" args={['#d4edda']} />
        <fog attach="fog" args={['#d4edda', 80, 200]} />

        {/* Ground / Pitch */}
        <Pitch />

        {/* Goalposts */}
        <GoalPosts />

        {/* Trajectory + Ball animation */}
        <TrajectoryAnimation
          trajectory={trajectory}
          ghostTrajectory={ghostTrajectory}
        />

        {/* Distance markers */}
        <DistanceMarkers />

        <OrbitControls
          makeDefault
          enablePan={true}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={60}
        />
      </Canvas>

      {/* Result overlay */}
      {result && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: '10px 20px',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: '1.1rem',
            background: result === 'goal'
              ? 'rgba(34, 197, 94, 0.9)'
              : 'rgba(239, 68, 68, 0.9)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            animation: 'slide-in 0.3s ease-out',
            zIndex: 20,
          }}
        >
          {result === 'goal' ? '⚽ GOAL!' : '❌ MISS'}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// Pitch — green rectangle with field markings
// ---------------------------------------------------------------

function Pitch() {
  return (
    <group>
      {/* Main pitch surface */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 20]}
        receiveShadow
      >
        <planeGeometry args={[40, 60]} />
        <meshStandardMaterial color="#3ba55d" />
      </mesh>

      {/* Surrounding ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 20]}
        receiveShadow
      >
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#4caf50" />
      </mesh>

      {/* Kick spot marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.2, 32]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Penalty area box lines */}
      <PitchLine points={[[-9, 0.02, 10], [-9, 0.02, 27], [9, 0.02, 27], [9, 0.02, 10]]} />

      {/* Goal line */}
      <PitchLine points={[[-20, 0.02, 27], [20, 0.02, 27]]} />
    </group>
  )
}

function PitchLine({ points }: { points: [number, number, number][] }) {
  const vecs = points.map(p => new THREE.Vector3(...p))
  return (
    <Line
      points={vecs}
      color="white"
      lineWidth={2}
      opacity={0.7}
      transparent
    />
  )
}

// ---------------------------------------------------------------
// Goalposts — at Z = 27m
// ---------------------------------------------------------------

function GoalPosts() {
  const postRadius = 0.06
  const crossbarY = 2.44
  const halfWidth = 7.32 / 2
  const goalZ = 27

  return (
    <group position={[0, 0, goalZ]}>
      {/* Left post */}
      <mesh position={[-halfWidth, crossbarY / 2, 0]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, crossbarY, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Right post */}
      <mesh position={[halfWidth, crossbarY / 2, 0]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, crossbarY, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Crossbar */}
      <mesh position={[0, crossbarY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[postRadius, postRadius, 7.32, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Net (simple plane for effect) */}
      <mesh position={[0, crossbarY / 2, 0.5]}>
        <planeGeometry args={[7.32, crossbarY]} />
        <meshStandardMaterial
          color="white"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          wireframe
        />
      </mesh>
      {/* Goal label */}
      <Text
        position={[0, crossbarY + 0.5, 0]}
        fontSize={0.4}
        color="#1e6b38"
        anchorX="center"
        anchorY="bottom"
        font={undefined}
      >
        GOAL
      </Text>
    </group>
  )
}

// ---------------------------------------------------------------
// Distance markers
// ---------------------------------------------------------------

function DistanceMarkers() {
  const distances = [5, 10, 15, 20, 25]
  return (
    <group>
      {distances.map((d) => (
        <group key={d}>
          <PitchLine
            points={[[-1, 0.02, d], [1, 0.02, d]]}
          />
          <Text
            position={[2, 0.1, d]}
            fontSize={0.35}
            color="#94a3b8"
            anchorX="left"
            font={undefined}
          >
            {d}m
          </Text>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------
// Trajectory Animation — ball + trail line
// ---------------------------------------------------------------

function TrajectoryAnimation({
  trajectory,
  ghostTrajectory,
}: {
  trajectory: TrajectoryPoint[]
  ghostTrajectory: TrajectoryPoint[]
}) {
  const ballRef = useRef<THREE.Mesh>(null!)
  const [frameIndex, setFrameIndex] = useState(0)
  const [animating, setAnimating] = useState(true)

  // Convert trajectory to Vector3 arrays
  const pathPoints = useMemo(
    () => trajectory.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    [trajectory]
  )

  const ghostPoints = useMemo(
    () => ghostTrajectory.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    [ghostTrajectory]
  )

  // Trail drawn so far (up to current frame)
  const trailPoints = useMemo(
    () => pathPoints.slice(0, frameIndex + 1),
    [pathPoints, frameIndex]
  )

  // Reset animation when trajectory changes
  useMemo(() => {
    setFrameIndex(0)
    setAnimating(true)
  }, [trajectory])

  // Animate ball along the path
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
      {/* Ball */}
      <mesh
        ref={ballRef}
        position={[trajectory[0].x, trajectory[0].y, trajectory[0].z]}
        castShadow
      >
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshStandardMaterial color="white" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Glowing trail (actual trajectory) */}
      {trailPoints.length >= 2 && (
        <Line
          points={trailPoints}
          color="#f59e0b"
          lineWidth={3}
          opacity={0.9}
          transparent
        />
      )}

      {/* Full trajectory (faint, shown after animation completes) */}
      {!animating && pathPoints.length >= 2 && (
        <Line
          points={pathPoints}
          color="#f59e0b"
          lineWidth={1.5}
          opacity={0.4}
          transparent
        />
      )}

      {/* Ghost trajectory (baseline comparison) */}
      {ghostPoints.length >= 2 && (
        <Line
          points={ghostPoints}
          color="#94a3b8"
          lineWidth={1.5}
          opacity={0.35}
          transparent
          dashed
          dashSize={0.3}
          gapSize={0.15}
        />
      )}
    </group>
  )
}
