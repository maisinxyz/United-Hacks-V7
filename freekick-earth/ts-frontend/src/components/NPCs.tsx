import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// A simple blocky Coach NPC.
export function Coach({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Legs */}
      <mesh position={[-0.15, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.15, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.8, 0.3]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#fca5a5" />
      </mesh>
      {/* Arms (crossed) */}
      <mesh position={[0, 1.2, 0.2]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.2, 0.2]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
    </group>
  )
}

// A warming up player on the sidelines
export function PlayerWarmup({ position, rotation, offset = 0 }: { position: [number, number, number], rotation: [number, number, number], offset?: number }) {
  const groupRef = useRef<THREE.Group>(null!)
  
  useFrame((state) => {
    if (groupRef.current) {
      // Bob up and down (warming up)
      groupRef.current.position.y = position[1] + Math.abs(Math.sin(state.clock.elapsedTime * 5 + offset)) * 0.2
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <mesh position={[-0.15, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 0.8, 0.15]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.15, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 0.8, 0.15]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.6, 0.25]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshStandardMaterial color="#fca5a5" />
      </mesh>
    </group>
  )
}

// A cameraman with a big TV camera
export function CameraOperator({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[-0.15, 0.4, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0.15, 0.4, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0, 1.1, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.6, 0.25]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 1.55, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshStandardMaterial color="#fca5a5" />
      </mesh>
      {/* Big Camera */}
      <mesh position={[0, 1.3, 0.3]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.4, 0.8]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 1.3, 0.7]} rotation={[Math.PI/2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.4, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
    </group>
  )
}

// A rack of spare footballs
export function BallRack({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.6, 0.5]} />
        <meshStandardMaterial color="#374151" wireframe />
      </mesh>
      <mesh position={[-0.5, 0.15, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.5, 0.15, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}
