import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

const vertexShader = `
  varying vec2 vUv;
  uniform float time;
  uniform float windSpeed;
  uniform float windDir;
  
  void main() {
    vUv = uv;
    
    // Get instance matrix
    mat4 instanceMat = instanceMatrix;
    
    // Transform vertex
    vec4 localPosition = vec4(position, 1.0);
    
    // Only sway the top of the grass (y > 0)
    if (position.y > 0.0) {
      // Calculate wind effect
      float windX = cos(windDir) * windSpeed;
      float windZ = sin(windDir) * windSpeed;
      
      // Calculate world position to create a traveling wave
      vec4 worldPos = modelMatrix * instanceMat * vec4(0.0, 0.0, 0.0, 1.0);
      
      // Sway wave
      float wave = sin(worldPos.x * 0.5 + worldPos.z * 0.5 + time * 2.0);
      
      // Apply displacement
      float swayMultiplier = position.y * 0.1; // Bend more at the top
      localPosition.x += wave * windX * swayMultiplier;
      localPosition.z += wave * windZ * swayMultiplier;
      
      // Add slight random bend per blade (using instance ID as seed approximation)
      float randomOffset = sin(float(gl_InstanceID) * 12.9898) * 0.1;
      localPosition.x += randomOffset * position.y;
    }
    
    vec4 mvPosition = viewMatrix * modelMatrix * instanceMat * localPosition;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = `
  varying vec2 vUv;
  uniform vec3 color1;
  uniform vec3 color2;
  
  void main() {
    // Gradient from bottom to top
    vec3 finalColor = mix(color1, color2, vUv.y);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`

export default function Grass({
  windSpeed = 2,
  windDirection = 0,
  count = 200000,
  width = 80,
  depth = 120
}: {
  windSpeed?: number
  windDirection?: number
  count?: number
  width?: number
  depth?: number
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  
  // Create grass instances
  const { dummy, uniforms } = useMemo(() => {
    const dummy = new THREE.Object3D()
    
    const uniforms = {
      time: { value: 0 },
      windSpeed: { value: windSpeed },
      windDir: { value: windDirection * (Math.PI / 180) },
      color1: { value: new THREE.Color('#2e7d32') }, // Lighter green base
      color2: { value: new THREE.Color('#64dd17') }  // Lime green tip
    }
    
    return { dummy, uniforms }
  }, [windSpeed, windDirection])

  // Setup instances on mount
  useEffect(() => {
    if (!meshRef.current) return;
    
    // Pitch has stripes (alternating greens)
    // The pitch is around width 80 (x from -40 to 40), depth 120 (z from -60 to 60)
    for (let i = 0; i < count; i++) {
      // Random position
      const x = (Math.random() - 0.5) * width
      const z = (Math.random() - 0.5) * depth
      
      // Random rotation and scale
      const rotY = Math.random() * Math.PI
      const scale = 0.5 + Math.random() * 0.5
      
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, rotY, 0)
      dummy.scale.set(1, scale, 1)
      dummy.updateMatrix()
      
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [count, width, depth, dummy])
  
  // Update uniforms
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime
      materialRef.current.uniforms.windSpeed.value = windSpeed
      // Convert degrees to radians and adjust for three.js coordinate system
      materialRef.current.uniforms.windDir.value = windDirection * (Math.PI / 180)
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow position={[0, 0, 0]} frustumCulled={false}>
      {/* Simple grass blade geometry (a narrow triangle/cone) */}
      <coneGeometry args={[0.03, 0.4, 3]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}
