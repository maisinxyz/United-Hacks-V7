/**
 * BCPlace - Minimalist blocky 3D model of BC Place Stadium.
 * Features a tunnel/gap for the camera to fly through.
 */

import { DoubleSide } from 'three'

export default function BCPlace() {
  return (
    <group position={[0, 0, 0]}>
      {/* 
        Stadium Bowl 
        We use a few separate boxes to create an arena with a gap (tunnel) at the back.
        The kicker is around [0, 0, 0], aiming towards +Z.
        The camera will start at -Z, fly through the gap, to [0, 0.8, -2].
      */}
      
      {/* Front/Sides of the bowl */}
      <mesh position={[0, 10, 40]}>
        <boxGeometry args={[80, 20, 20]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      
      <mesh position={[-40, 10, 0]}>
        <boxGeometry args={[20, 20, 100]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      
      <mesh position={[40, 10, 0]}>
        <boxGeometry args={[20, 20, 100]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>

      {/* Back of the bowl (with tunnel gap in the middle) */}
      {/* Left back wall */}
      <mesh position={[-25, 10, -40]}>
        <boxGeometry args={[30, 20, 20]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      {/* Right back wall */}
      <mesh position={[25, 10, -40]}>
        <boxGeometry args={[30, 20, 20]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      {/* Bridge over the tunnel */}
      <mesh position={[0, 15, -40]}>
        <boxGeometry args={[20, 10, 20]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>

      {/* 
        Iconic BC Place Roof 
        A massive ring/cable structure.
      */}
      {/* Lower roof ring */}
      <mesh position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[35, 55, 16]} />
        <meshStandardMaterial color="#f8fafc" side={DoubleSide} transparent opacity={0.9} />
      </mesh>
      
      {/* Upper central cable net (represented as a smaller semi-transparent cap) */}
      <mesh position={[0, 25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[25, 35, 5, 16, 1, true]} />
        <meshStandardMaterial color="#94a3b8" side={DoubleSide} transparent opacity={0.6} wireframe />
      </mesh>

      {/* Structural pillars on the exterior */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        if (i === 9 || i === 8 || i === 10) return null 
        const x = Math.cos(angle) * 48
        const z = Math.sin(angle) * 48
        return (
          <mesh key={`pillar-${i}`} position={[x, 10, z]} rotation={[0, -angle, 0]}>
            <cylinderGeometry args={[1.5, 1.5, 20, 8]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        )
      })}

      {/* Surrounding City Environment */}
      <group position={[0, -0.1, 0]}>
        {/* Extended concrete plaza around the stadium */}
        <mesh position={[0, 0, -40]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.9} />
        </mesh>
        
        {/* Some blocky city buildings in the distance */}
        {/* Left cluster */}
        <mesh position={[-90, 30, -120]}>
          <boxGeometry args={[40, 60, 40]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[-140, 45, -90]}>
          <boxGeometry args={[35, 90, 35]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[-110, 20, -50]}>
          <boxGeometry args={[50, 40, 30]} />
          <meshStandardMaterial color="#475569" />
        </mesh>

        {/* Right cluster */}
        <mesh position={[100, 40, -100]}>
          <boxGeometry args={[45, 80, 45]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[130, 25, -60]}>
          <boxGeometry args={[40, 50, 40]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[80, 15, -40]}>
          <boxGeometry args={[30, 30, 30]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        
        {/* Background buildings */}
        <mesh position={[0, 35, -200]}>
          <boxGeometry args={[60, 70, 40]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[70, 55, -180]}>
          <boxGeometry args={[40, 110, 40]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[-60, 65, -190]}>
          <boxGeometry args={[45, 130, 45]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>
    </group>
  )
}
