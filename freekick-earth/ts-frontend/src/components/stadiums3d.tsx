// ============================================================
// FreeKick Earth — Procedural 3D Stadium Models
//
// Each stadium is defined as an array of geometric primitives
// (boxes and cylinders) with position, rotation, size, and color.
// The `hideRoof` flag strips roof/canopy elements for the flyover.
//
// Shared helpers add universal detail: stepped bleacher rows,
// LED ad boards, team benches, player tunnels, perimeter walls.
// ============================================================

export type BlockDescriptor = {
  type: 'box'
  pos: [number, number, number]
  rot: [number, number, number]
  size: [number, number, number]
  color: string
  opacity?: number
  isRoof?: boolean
}

export type CylinderDescriptor = {
  type: 'cylinder'
  pos: [number, number, number]
  rot: [number, number, number]
  args: any[]
  color: string
  opacity?: number
  isRoof?: boolean
}

export type StadiumPrimitive = BlockDescriptor | CylinderDescriptor

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function box(
  pos: [number, number, number],
  size: [number, number, number],
  color: string,
  rot: [number, number, number] = [0, 0, 0],
  opts: { opacity?: number; isRoof?: boolean } = {}
): BlockDescriptor {
  return { type: 'box', pos, rot, size, color, ...opts }
}

function cyl(
  pos: [number, number, number],
  args: any[],
  color: string,
  rot: [number, number, number] = [0, 0, 0],
  opts: { opacity?: number; isRoof?: boolean } = {}
): CylinderDescriptor {
  return { type: 'cylinder', pos, rot, args, color, ...opts }
}

// ---------------------------------------------------------------
// Stepped bleacher rows — replaces flat slab tiers
// side: 'left' | 'right' | 'back' | 'front'
// ---------------------------------------------------------------
function bleacherRows(
  side: 'left' | 'right' | 'back' | 'front',
  baseX: number, baseY: number, baseZ: number,
  rows: number, color: string, length: number,
  _startAngle: number = 0.3,
  rowHeight: number = 1.2, rowDepth: number = 1.5,
): StadiumPrimitive[] {
  const out: StadiumPrimitive[] = []
  
  // Create sections with stairways in between
  const sectionCount = Math.max(1, Math.floor(length / 15))
  const stairWidth = 2.0
  const totalStairWidth = (sectionCount - 1) * stairWidth
  const sectionLength = (length - totalStairWidth) / sectionCount
  
  for (let r = 0; r < rows; r++) {
    const y = baseY + r * rowHeight
    const offset = r * rowDepth
    
    // For each section along the length
    for (let s = 0; s < sectionCount; s++) {
      // Calculate local offset along the length
      const posOffset = -length / 2 + (sectionLength / 2) + s * (sectionLength + stairWidth)
      
      if (side === 'left') {
        const pz = baseZ + posOffset
        out.push(box([baseX - offset, y, pz], [rowDepth, rowHeight * 0.7, sectionLength], color))
        out.push(box([baseX - offset + rowDepth * 0.4, y + rowHeight * 0.35, pz], [0.15, rowHeight * 0.3, sectionLength], darken(color)))
        // Add stairs if not last section
        if (s < sectionCount - 1) {
          out.push(box([baseX - offset, y, pz + sectionLength/2 + stairWidth/2], [rowDepth, rowHeight * 0.5, stairWidth], '#6b7280')) // Concrete stairs
        }
      } else if (side === 'right') {
        const pz = baseZ + posOffset
        out.push(box([baseX + offset, y, pz], [rowDepth, rowHeight * 0.7, sectionLength], color))
        out.push(box([baseX + offset - rowDepth * 0.4, y + rowHeight * 0.35, pz], [0.15, rowHeight * 0.3, sectionLength], darken(color)))
        if (s < sectionCount - 1) {
          out.push(box([baseX + offset, y, pz + sectionLength/2 + stairWidth/2], [rowDepth, rowHeight * 0.5, stairWidth], '#6b7280'))
        }
      } else if (side === 'back') {
        const px = baseX + posOffset
        out.push(box([px, y, baseZ + offset], [sectionLength, rowHeight * 0.7, rowDepth], color))
        out.push(box([px, y + rowHeight * 0.35, baseZ + offset - rowDepth * 0.4], [sectionLength, rowHeight * 0.3, 0.15], darken(color)))
        if (s < sectionCount - 1) {
          out.push(box([px + sectionLength/2 + stairWidth/2, y, baseZ + offset], [stairWidth, rowHeight * 0.5, rowDepth], '#6b7280'))
        }
      } else {
        const px = baseX + posOffset
        out.push(box([px, y, baseZ - offset], [sectionLength, rowHeight * 0.7, rowDepth], color))
        out.push(box([px, y + rowHeight * 0.35, baseZ - offset + rowDepth * 0.4], [sectionLength, rowHeight * 0.3, 0.15], darken(color)))
        if (s < sectionCount - 1) {
          out.push(box([px + sectionLength/2 + stairWidth/2, y, baseZ - offset], [stairWidth, rowHeight * 0.5, rowDepth], '#6b7280'))
        }
      }
    }
  }
  return out
}

function darken(hex: string): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 30)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 30)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 30)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

// ---------------------------------------------------------------
// Common pitch-side details (shared by all stadiums)
// ---------------------------------------------------------------
function commonDetails(): StadiumPrimitive[] {
  const adBoard = '#111827'
  const adScreen = '#f8fafc' // Bright screen
  const adAccent = '#e11d48' // sponsor red
  const adAccent2 = '#2563eb' // sponsor blue
  const bench = '#1f2937'
  const benchSeat = '#3b82f6'
  const tunnel = '#111827'
  const concrete = '#6b7280'
  const white = '#ffffff'
  const glass = '#bae6fd'

  return [
    // === LED AD BOARDS (Thicker, layered) ===
    // Left sideline
    box([-29, 0.6, 13], [0.4, 1.2, 80], adBoard),
    box([-28.9, 0.6, 13], [0.1, 1.0, 79], adScreen), // Screen face
    box([-28.8, 0.6, 0], [0.1, 1.0, 12], adAccent),
    box([-28.8, 0.6, 13], [0.1, 1.0, 14], adAccent2),
    box([-28.8, 0.6, 26], [0.1, 1.0, 10], '#f59e0b'),
    
    // Right sideline
    box([29, 0.6, 13], [0.4, 1.2, 80], adBoard),
    box([28.9, 0.6, 13], [0.1, 1.0, 79], adScreen),
    box([28.8, 0.6, 5], [0.1, 1.0, 12], adAccent2),
    box([28.8, 0.6, 18], [0.1, 1.0, 14], adAccent),
    box([28.8, 0.6, 32], [0.1, 1.0, 8], '#10b981'),
    
    // Behind goal (north)
    box([0, 0.6, -4], [60, 1.2, 0.4], adBoard),
    box([0, 0.6, -3.9], [59, 1.0, 0.1], adScreen),
    box([0, 0.6, -3.8], [15, 1.0, 0.1], '#f59e0b'),
    box([12, 0.6, -3.8], [10, 1.0, 0.1], adAccent),
    
    // Behind goal (south)
    box([0, 0.6, 31], [60, 1.2, 0.4], adBoard), // Moved slightly further back
    box([0, 0.6, 30.9], [59, 1.0, 0.1], adScreen),
    box([-8, 0.6, 30.8], [12, 1.0, 0.1], adAccent2),
    box([10, 0.6, 30.8], [8, 1.0, 0.1], '#10b981'),

    // === TEAM BENCHES (HYPER Detailed Dugouts) ===
    // Home bench
    box([-31.5, 2.5, 6], [3.0, 0.2, 12], concrete), // Thicker Roof
    box([-31.0, 1.5, 6], [2.0, 2.5, 11], glass, [0,0,0], { opacity: 0.3 }), // Glass enclosure
    box([-32.8, 1.2, 6], [0.4, 2.5, 12], bench), // Back wall
    box([-31.5, 1.2, 0], [3.0, 2.5, 0.4], bench), // Left wall
    box([-31.5, 1.2, 12], [3.0, 2.5, 0.4], bench), // Right wall
    // Seats in two rows
    ...Array.from({ length: 9 }, (_, i) => box([-32, 0.6, 1.5 + i * 1.1], [0.8, 0.8, 0.8], benchSeat)),
    ...Array.from({ length: 9 }, (_, i) => box([-31, 0.4, 1.5 + i * 1.1], [0.8, 0.6, 0.8], benchSeat)),
    // Water cooler
    cyl([-31.5, 0.6, 11], [0.3, 0.3, 0.8, 16], '#ef4444'),

    // Away bench
    box([-31.5, 2.5, 20], [3.0, 0.2, 12], concrete),
    box([-31.0, 1.5, 20], [2.0, 2.5, 11], glass, [0,0,0], { opacity: 0.3 }),
    box([-32.8, 1.2, 20], [0.4, 2.5, 12], bench),
    box([-31.5, 1.2, 14], [3.0, 2.5, 0.4], bench),
    box([-31.5, 1.2, 26], [3.0, 2.5, 0.4], bench),
    ...Array.from({ length: 9 }, (_, i) => box([-32, 0.6, 15.5 + i * 1.1], [0.8, 0.8, 0.8], '#ef4444')),
    ...Array.from({ length: 9 }, (_, i) => box([-31, 0.4, 15.5 + i * 1.1], [0.8, 0.6, 0.8], '#ef4444')),
    cyl([-31.5, 0.6, 25], [0.3, 0.3, 0.8, 16], '#3b82f6'),

    // === PLAYER TUNNEL (right sideline, at halfway) ===
    box([31, 1.5, 13], [4, 3.0, 5], tunnel),
    box([31, 3.1, 13], [4.5, 0.3, 5.5], concrete),
    box([29, 1.5, 10.5], [0.4, 3.0, 0.4], white),
    box([29, 1.5, 15.5], [0.4, 3.0, 0.4], white),
    box([29, 3.1, 13], [0.4, 0.4, 5.4], white),
    // Tunnel interior shadow
    box([31.5, 1.4, 13], [3.5, 2.8, 4.5], '#000000'),

    // === 4TH OFFICIAL BOARD (between benches) ===
    box([-30.5, 1.5, 13], [0.2, 1.4, 1.0], '#111111'),
    box([-30.4, 1.9, 13], [0.1, 0.8, 0.8], '#22c55e'), // green display

    // === PERIMETER CONCRETE MOAT / TRACK ===
    box([-32, 0.02, 13], [6, 0.04, 86], '#d1d5db'),
    box([32, 0.02, 13], [6, 0.04, 86], '#d1d5db'),
    box([0, 0.02, -6.5], [70, 0.04, 5], '#d1d5db'),
    box([0, 0.02, 33.5], [70, 0.04, 5], '#d1d5db'),

    // === CAMERA POSITIONS & EQUIPMENT ===
    box([30, 1.0, -2], [0.6, 1.2, 0.6], '#111111'),
    box([30, 1.8, -2], [0.4, 0.3, 0.8], '#374151'), // camera head
    box([-30, 1.0, 28], [0.6, 1.2, 0.6], '#111111'),
    box([-30, 1.8, 28], [0.4, 0.3, 0.8], '#374151'),

    // === CORNER FLAG BASES ===
    cyl([-28.5, 0.05, -3.5], [0.2, 0.2, 0.1, 12], '#fef3c7'),
    cyl([28.5, 0.05, -3.5], [0.2, 0.2, 0.1, 12], '#fef3c7'),
    cyl([-28.5, 0.05, 30.5], [0.2, 0.2, 0.1, 12], '#fef3c7'),
    cyl([28.5, 0.05, 30.5], [0.2, 0.2, 0.1, 12], '#fef3c7'),
  ]
}

// ---------------------------------------------------------------
// Concrete support structure under bleachers
// ---------------------------------------------------------------
function supportStructure(
  side: 'left' | 'right' | 'back' | 'front',
  x: number, y: number, z: number,
  length: number, height: number, color: string = '#6b7280'
): StadiumPrimitive[] {
  const out: StadiumPrimitive[] = []
  const count = Math.floor(length / 12)
  for (let i = 0; i <= count; i++) {
    const frac = i / count
    if (side === 'left' || side === 'right') {
      const pz = z - length / 2 + frac * length
      out.push(box([x, y, pz], [1.5, height, 1.5], color))
    } else {
      const px = x - length / 2 + frac * length
      out.push(box([px, y, z], [1.5, height, 1.5], color))
    }
  }
  return out
}

// ---------------------------------------------------------------
// Floodlight tower with multiple lamp heads
// ---------------------------------------------------------------
function floodlightTower(x: number, z: number, height: number = 40, color: string = '#6b7280'): StadiumPrimitive[] {
  return [
    // Pole
    box([x, height / 2, z], [1.5, height, 1.5], color),
    // Cross arm
    box([x, height - 1, z], [6, 0.8, 2], color),
    // Lamp panels (3 across)
    box([x - 2, height, z], [1.5, 1.2, 1.5], '#fef3c7'),
    box([x, height, z], [1.5, 1.2, 1.5], '#fef3c7'),
    box([x + 2, height, z], [1.5, 1.2, 1.5], '#fef3c7'),
  ]
}

// ---------------------------------------------------------------
// Vomitory (entrance gap in the stand)
// ---------------------------------------------------------------
function vomitory(x: number, y: number, z: number, w: number, h: number, d: number): StadiumPrimitive[] {
  return [
    box([x, y, z], [w, h, d], '#1f2937'),
    // Arch top
    box([x, y + h / 2 + 0.2, z], [w + 0.4, 0.4, d + 0.2], '#374151'),
  ]
}

// ==========================
// Pitch center ≈ (0, 0, 13.5). Goal at Z=27. Kick from Z≈0.
// ==========================

// ==========================
// 1. MetLife Stadium
// ==========================
function metlife(): StadiumPrimitive[] {
  const seats1 = '#1e3a8a'
  const seats2 = '#1e40af'
  const steel = '#6b7280'
  const concrete = '#9ca3af'
  return [
    ...commonDetails(),
    // Lower tier — stepped bleachers
    ...bleacherRows('left', -33, 1, 13, 8, seats1, 100),
    ...bleacherRows('right', 33, 1, 13, 8, seats1, 100),
    ...bleacherRows('back', 0, 1, 48, 6, seats1, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seats1, 85),
    // Support columns under lower tier
    ...supportStructure('left', -42, 4, 13, 100, 8, concrete),
    ...supportStructure('right', 42, 4, 13, 100, 8, concrete),
    // Concourse ring (gap between tiers)
    box([-44, 10.5, 13], [5, 1.5, 105], concrete),
    box([44, 10.5, 13], [5, 1.5, 105], concrete),
    box([0, 10.5, 55], [95, 1.5, 5], concrete),
    box([0, 10.5, -29], [95, 1.5, 5], concrete),
    // Upper tier — stepped bleachers
    ...bleacherRows('left', -47, 12, 13, 8, seats2, 108),
    ...bleacherRows('right', 47, 12, 13, 8, seats2, 108),
    ...bleacherRows('back', 0, 12, 60, 6, seats2, 100),
    ...bleacherRows('front', 0, 12, -34, 6, seats2, 100),
    // Steel fascia ring at top
    box([-58, 22, 13], [1.5, 4, 115], steel),
    box([58, 22, 13], [1.5, 4, 115], steel),
    box([0, 22, 67], [115, 4, 1.5], steel),
    box([0, 22, -41], [115, 4, 1.5], steel),
    // LED ribbon boards
    box([-57, 19, 13], [0.5, 1.5, 80], '#111111'),
    box([57, 19, 13], [0.5, 1.5, 80], '#111111'),
    // Outer wall
    box([-59, 12, 13], [1, 24, 118], '#e5e7eb'),
    box([59, 12, 13], [1, 24, 118], '#e5e7eb'),
    box([0, 12, 69], [118, 24, 1], '#e5e7eb'),
    box([0, 12, -43], [118, 24, 1], '#e5e7eb'),
    // Vomitories
    ...vomitory(-44, 5, 13, 3, 3, 2),
    ...vomitory(44, 5, 13, 3, 3, 2),
    // Corner floodlights
    ...floodlightTower(-55, 58),
    ...floodlightTower(55, 58),
    ...floodlightTower(-55, -32),
    ...floodlightTower(55, -32),
  ]
}

// ==========================
// 2. Rose Bowl Stadium
// ==========================
function rosebowl(): StadiumPrimitive[] {
  const seats = '#991b1b'
  const seats2 = '#7f1d1d'
  const pressbox = '#374151'
  const concrete = '#d1d5db'
  return [
    ...commonDetails(),
    // Lower tier — continuous oval bowl
    ...bleacherRows('left', -33, 1, 13, 8, seats, 108),
    ...bleacherRows('right', 33, 1, 13, 8, seats, 108),
    ...bleacherRows('back', 0, 1, 50, 6, seats, 95),
    ...bleacherRows('front', 0, 1, -24, 6, seats, 95),
    // Upper tier
    ...bleacherRows('left', -47, 12, 13, 7, seats2, 112),
    ...bleacherRows('right', 47, 12, 13, 7, seats2, 112),
    ...bleacherRows('back', 0, 12, 58, 5, seats2, 105),
    ...bleacherRows('front', 0, 12, -32, 5, seats2, 105),
    // Corner fills (round the oval)
    box([-40, 7, 48], [10, 8, 10], seats, [0, Math.PI / 4, 0]),
    box([40, 7, 48], [10, 8, 10], seats, [0, -Math.PI / 4, 0]),
    box([-40, 7, -22], [10, 8, 10], seats, [0, -Math.PI / 4, 0]),
    box([40, 7, -22], [10, 8, 10], seats, [0, Math.PI / 4, 0]),
    // Supports
    ...supportStructure('left', -45, 5, 13, 110, 10, concrete),
    ...supportStructure('right', 45, 5, 13, 110, 10, concrete),
    // Press box
    box([-53, 22, 13], [6, 5, 45], pressbox),
    box([-53, 25, 13], [8, 0.8, 50], concrete), // roof
    box([-50, 22, 13], [0.5, 4, 42], '#93c5fd', [0, 0, 0], { opacity: 0.3 }), // glass front
    // Rim wall
    box([-58, 12, 13], [1, 22, 118], concrete),
    box([58, 12, 13], [1, 22, 118], concrete),
    box([0, 12, 66], [118, 22, 1], concrete),
    box([0, 12, -40], [118, 22, 1], concrete),
    // Vomitories at ends
    ...vomitory(0, 5, 55, 4, 3.5, 2),
    ...vomitory(0, 5, -29, 4, 3.5, 2),
    // Floodlights (on rim)
    ...floodlightTower(-55, 56, 38),
    ...floodlightTower(55, 56, 38),
    ...floodlightTower(-55, -30, 38),
    ...floodlightTower(55, -30, 38),
  ]
}

// ==========================
// 3. SoFi Stadium
// ==========================
function sofi(): StadiumPrimitive[] {
  const seats = '#1e3a8a'
  const seats2 = '#1e40af'
  const canopy = '#e2e8f0'
  const steel = '#94a3b8'
  const oculus = '#0f172a'
  return [
    ...commonDetails(),
    // Lower bowl — stepped
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 8, seats, 100),
    ...bleacherRows('back', 0, 1, 48, 6, seats, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seats, 85),
    // Concourse
    box([-44, 10.5, 13], [5, 1.5, 108], '#6b7280'),
    box([44, 10.5, 13], [5, 1.5, 108], '#6b7280'),
    // Upper bowl — stepped
    ...bleacherRows('left', -47, 12, 13, 8, seats2, 112),
    ...bleacherRows('right', 47, 12, 13, 8, seats2, 112),
    ...bleacherRows('back', 0, 12, 58, 6, seats2, 105),
    ...bleacherRows('front', 0, 12, -32, 6, seats2, 105),
    // Supports
    ...supportStructure('left', -55, 8, 13, 108, 16, '#6b7280'),
    ...supportStructure('right', 55, 8, 13, 108, 16, '#6b7280'),
    // Outer wall
    box([-60, 12, 13], [1, 24, 120], '#e5e7eb'),
    box([60, 12, 13], [1, 24, 120], '#e5e7eb'),
    // === CANOPY ROOF ===
    box([0, 40, 13], [140, 1.5, 160], canopy, [0, 0, 0], { opacity: 0.3, isRoof: true }),
    box([0, 38, -50], [140, 1.5, 30], canopy, [Math.PI / 12, 0, 0], { opacity: 0.25, isRoof: true }),
    // Angled steel support columns
    box([-65, 20, 55], [3.5, 40, 3.5], steel, [0, 0, Math.PI / 20], { isRoof: true }),
    box([65, 20, 55], [3.5, 40, 3.5], steel, [0, 0, -Math.PI / 20], { isRoof: true }),
    box([-65, 20, -29], [3.5, 40, 3.5], steel, [0, 0, Math.PI / 20], { isRoof: true }),
    box([65, 20, -29], [3.5, 40, 3.5], steel, [0, 0, -Math.PI / 20], { isRoof: true }),
    box([-65, 20, 13], [3.5, 40, 3.5], steel, [0, 0, Math.PI / 20], { isRoof: true }),
    box([65, 20, 13], [3.5, 40, 3.5], steel, [0, 0, -Math.PI / 20], { isRoof: true }),
    // The Oculus
    box([0, 28, 13], [22, 6, 22], oculus, [0, 0, 0], { isRoof: true }),
    box([0, 25, 13], [24, 0.4, 24], '#3b82f6', [0, 0, 0], { isRoof: true }),
  ]
}

// ==========================
// 4. Levi's Stadium
// ==========================
function levi(): StadiumPrimitive[] {
  const seats = '#dc2626'
  const seats2 = '#b91c1c'
  const tower = '#374151'
  const glass = '#bfdbfe'
  const steel = '#6b7280'
  return [
    ...commonDetails(),
    // Lower tier
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 6, seats, 90),
    ...bleacherRows('back', 0, 1, 48, 6, seats, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seats, 85),
    // East (right) — shorter single tier, open
    ...bleacherRows('right', 42, 8, 13, 4, seats2, 85),
    // WEST TOWER
    box([-52, 18, 13], [14, 28, 85], tower),
    box([-45, 22, 13], [0.8, 18, 78], glass, [0, 0, 0], { opacity: 0.35 }),
    // Tower canopy
    box([-46, 33, 13], [18, 1.5, 90], steel, [0, 0, 0], { isRoof: true }),
    box([-52, 34, 13], [16, 0.8, 88], '#22c55e', [0, 0, 0], { isRoof: true }), // green roof
    // End zone upper
    ...bleacherRows('back', 0, 12, 55, 5, seats2, 75),
    ...bleacherRows('front', 0, 12, -28, 5, seats2, 75),
    // Supports
    ...supportStructure('right', 40, 3, 13, 85, 6, steel),
    // Scoreboard
    box([0, 22, -36], [28, 11, 1.5], '#111111'),
    box([0, 17, -36], [30, 0.8, 1.8], '#dc2626'), // red trim
    // Outer wall east
    box([48, 8, 13], [1, 16, 95], '#e5e7eb'),
  ]
}

// ==========================
// 5. AT&T Stadium
// ==========================
function att(): StadiumPrimitive[] {
  const seats = '#1e3a8a'
  const seats2 = '#1e40af'
  const steel = '#6b7280'
  const glass = '#93c5fd'
  const screen = '#0f172a'
  return [
    ...commonDetails(),
    // Lower bowl — stepped
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 8, seats, 100),
    ...bleacherRows('back', 0, 1, 48, 6, seats, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seats, 85),
    // Upper bowl — steep
    ...bleacherRows('left', -48, 12, 13, 9, seats2, 108, 0.4, 1.3, 1.6),
    ...bleacherRows('right', 48, 12, 13, 9, seats2, 108, 0.4, 1.3, 1.6),
    // Supports
    ...supportStructure('left', -55, 8, 13, 108, 16, steel),
    ...supportStructure('right', 55, 8, 13, 108, 16, steel),
    // STEEL ARCHES
    box([-1.5, 42, 13], [3, 3, 135], steel, [0, 0, 0], { isRoof: true }),
    box([1.5, 42, 13], [3, 3, 135], steel, [0, 0, 0], { isRoof: true }),
    // Arch legs
    box([-55, 22, 60], [5, 38, 5], steel, [0, 0, Math.PI / 12], { isRoof: true }),
    box([55, 22, 60], [5, 38, 5], steel, [0, 0, -Math.PI / 12], { isRoof: true }),
    box([-55, 22, -34], [5, 38, 5], steel, [0, 0, Math.PI / 12], { isRoof: true }),
    box([55, 22, -34], [5, 38, 5], steel, [0, 0, -Math.PI / 12], { isRoof: true }),
    // Retractable roof panels
    box([0, 40, 13], [108, 1, 95], '#d1d5db', [0, 0, 0], { opacity: 0.4, isRoof: true }),
    // GLASS END WALLS
    box([0, 17, 68], [88, 28, 1.5], glass, [0, 0, 0], { opacity: 0.2 }),
    box([0, 17, -42], [88, 28, 1.5], glass, [0, 0, 0], { opacity: 0.2 }),
    // Glass wall frames
    ...Array.from({ length: 5 }, (_, i) => box([-35 + i * 17.6, 17, 68], [1, 28, 2], steel)).flat(),
    ...Array.from({ length: 5 }, (_, i) => box([-35 + i * 17.6, 17, -42], [1, 28, 2], steel)).flat(),
    // Center-hung video board
    box([0, 27, 13], [48, 7, 24], screen, [0, 0, 0], { isRoof: true }),
    box([0, 23.5, 13], [50, 0.4, 26], '#3b82f6', [0, 0, 0], { isRoof: true }),
    // Outer walls
    box([-62, 16, 13], [1, 32, 120], '#e5e7eb'),
    box([62, 16, 13], [1, 32, 120], '#e5e7eb'),
  ]
}

// ==========================
// 6. NRG Stadium
// ==========================
function nrg(): StadiumPrimitive[] {
  const seats = '#1e40af'
  const seats2 = '#1e3a8a'
  const roof = '#9ca3af'
  const steel = '#6b7280'
  const concrete = '#d1d5db'
  return [
    ...commonDetails(),
    // Lower tier — stepped
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 8, seats, 100),
    ...bleacherRows('back', 0, 1, 48, 6, seats, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seats, 85),
    // Upper tier
    ...bleacherRows('left', -47, 12, 13, 7, seats2, 108),
    ...bleacherRows('right', 47, 12, 13, 7, seats2, 108),
    ...bleacherRows('back', 0, 12, 56, 5, seats2, 100),
    ...bleacherRows('front', 0, 12, -30, 5, seats2, 100),
    // Outer concrete walls (boxy industrial look)
    box([-60, 14, 13], [3, 28, 122], concrete),
    box([60, 14, 13], [3, 28, 122], concrete),
    box([0, 14, 69], [122, 28, 3], concrete),
    box([0, 14, -43], [122, 28, 3], concrete),
    // Supports
    ...supportStructure('left', -55, 8, 13, 108, 16, steel),
    ...supportStructure('right', 55, 8, 13, 108, 16, steel),
    // Retractable roof (closed)
    box([-30, 30, 13], [58, 1.5, 118], roof, [0, 0, 0], { isRoof: true }),
    box([30, 30, 13], [58, 1.5, 118], roof, [0, 0, 0], { isRoof: true }),
    // Ridge seam
    box([0, 31, 13], [3, 0.8, 118], steel, [0, 0, 0], { isRoof: true }),
    // Steel truss supports on sides
    box([-60, 30, 13], [3, 3, 118], steel, [0, 0, 0], { isRoof: true }),
    box([60, 30, 13], [3, 3, 118], steel, [0, 0, 0], { isRoof: true }),
    // Vomitories
    ...vomitory(-44, 5, 0, 3, 3, 2),
    ...vomitory(-44, 5, 26, 3, 3, 2),
    ...vomitory(44, 5, 0, 3, 3, 2),
    ...vomitory(44, 5, 26, 3, 3, 2),
  ]
}

// ==========================
// 7. Mercedes-Benz Stadium
// ==========================
function mercedes(): StadiumPrimitive[] {
  const seats = '#111827'
  const seatsAlt = '#dc2626'
  const petal = '#e5e7eb'
  const facade = '#374151'
  return [
    ...commonDetails(),
    // Lower bowl — stepped
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 8, seats, 100),
    ...bleacherRows('back', 0, 1, 48, 6, seatsAlt, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seatsAlt, 85),
    // Upper bowl — steep
    ...bleacherRows('left', -47, 12, 13, 9, seats, 112, 0.4, 1.3, 1.6),
    ...bleacherRows('right', 47, 12, 13, 9, seats, 112, 0.4, 1.3, 1.6),
    ...bleacherRows('back', 0, 12, 58, 7, seats, 105, 0.4, 1.3, 1.6),
    ...bleacherRows('front', 0, 12, -32, 7, seats, 105, 0.4, 1.3, 1.6),
    // Angular facade
    box([-62, 16, 13], [3, 32, 122], facade, [0, 0, -Math.PI / 18]),
    box([62, 16, 13], [3, 32, 122], facade, [0, 0, Math.PI / 18]),
    box([0, 16, 71], [122, 32, 3], facade, [-Math.PI / 18, 0, 0]),
    box([0, 16, -45], [122, 32, 3], facade, [Math.PI / 18, 0, 0]),
    // 8-PETAL ROOF
    box([-30, 36, -20], [34, 1.2, 34], petal, [Math.PI / 8, 0, Math.PI / 16], { isRoof: true }),
    box([30, 36, -20], [34, 1.2, 34], petal, [Math.PI / 8, 0, -Math.PI / 16], { isRoof: true }),
    box([-30, 36, 46], [34, 1.2, 34], petal, [-Math.PI / 8, 0, Math.PI / 16], { isRoof: true }),
    box([30, 36, 46], [34, 1.2, 34], petal, [-Math.PI / 8, 0, -Math.PI / 16], { isRoof: true }),
    box([-45, 36, 13], [28, 1.2, 38], petal, [0, 0, -Math.PI / 8], { isRoof: true }),
    box([45, 36, 13], [28, 1.2, 38], petal, [0, 0, Math.PI / 8], { isRoof: true }),
    // Halo board
    cyl([0, 26, 13], [28, 28, 2.5, 8], '#111111', [0, 0, 0], { isRoof: true }),
    cyl([0, 26, 13], [25, 25, 3, 8], '#dc2626', [0, 0, 0], { isRoof: true }),
    // Supports
    ...supportStructure('left', -56, 8, 13, 112, 16, '#4b5563'),
    ...supportStructure('right', 56, 8, 13, 112, 16, '#4b5563'),
  ]
}

// ==========================
// 8. Lincoln Financial Field
// ==========================
function lincoln(): StadiumPrimitive[] {
  const seats = '#166534'
  const seats2 = '#15803d'
  const seatsEnd = '#1e3a8a'
  const concrete = '#9ca3af'
  const steel = '#6b7280'
  return [
    ...commonDetails(),
    // Lower tier
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 8, seats, 100),
    ...bleacherRows('back', 0, 1, 48, 6, seatsEnd, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seatsEnd, 85),
    // Upper tier with cantilevered overhang
    ...bleacherRows('left', -46, 12, 13, 8, seats2, 95),
    ...bleacherRows('right', 46, 12, 13, 8, seats2, 95),
    // Cantilevered overhang
    box([-42, 23, 13], [16, 1.5, 92], concrete, [0, 0, 0], { isRoof: true }),
    box([42, 23, 13], [16, 1.5, 92], concrete, [0, 0, 0], { isRoof: true }),
    // End zone stands
    ...bleacherRows('back', 0, 10, 55, 5, seatsEnd, 75),
    ...bleacherRows('front', 0, 10, -28, 5, seatsEnd, 75),
    // Supports
    ...supportStructure('left', -50, 6, 13, 95, 12, concrete),
    ...supportStructure('right', 50, 6, 13, 95, 12, concrete),
    // Corner floodlight towers
    ...floodlightTower(-52, 54, 38, steel),
    ...floodlightTower(52, 54, 38, steel),
    ...floodlightTower(-52, -28, 38, steel),
    ...floodlightTower(52, -28, 38, steel),
    // Scoreboard
    box([0, 23, 62], [33, 11, 1.5], '#111111'),
    box([0, 18, 62], [35, 0.8, 1.8], '#166534'),
    // Outer wall
    box([-56, 12, 13], [1, 24, 110], '#e5e7eb'),
    box([56, 12, 13], [1, 24, 110], '#e5e7eb'),
    // Vomitories
    ...vomitory(-44, 5, 5, 3, 3, 2),
    ...vomitory(-44, 5, 21, 3, 3, 2),
    ...vomitory(44, 5, 5, 3, 3, 2),
    ...vomitory(44, 5, 21, 3, 3, 2),
  ]
}

// ==========================
// 9. Gillette Stadium
// ==========================
function gillette(): StadiumPrimitive[] {
  const seats = '#1e3a8a'
  const seatsAlt = '#dc2626'
  const concrete = '#d1d5db'
  const lighthouse = '#f5f5f4'
  const lighthouseAccent = '#1e3a8a'
  return [
    ...commonDetails(),
    // Lower tier
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 8, seatsAlt, 100),
    ...bleacherRows('back', 0, 1, 48, 6, seats, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seats, 85),
    // Upper tier
    ...bleacherRows('left', -47, 12, 13, 7, seats, 108),
    ...bleacherRows('right', 47, 12, 13, 7, seatsAlt, 108),
    ...bleacherRows('back', 0, 12, 58, 5, seats, 100),
    // Supports
    ...supportStructure('left', -52, 6, 13, 108, 12, '#6b7280'),
    ...supportStructure('right', 52, 6, 13, 108, 12, '#6b7280'),
    // LIGHTHOUSE TOWER
    cyl([52, 20, 58], [3.5, 4.5, 32, 12], lighthouse),
    cyl([52, 37, 58], [5.5, 5.5, 2.5, 12], lighthouseAccent),
    cyl([52, 40, 58], [2.5, 2.5, 3.5, 8], '#fef3c7'),
    cyl([52, 43, 58], [0.8, 3.5, 2.5, 8], lighthouseAccent),
    // Lighthouse observation railing
    cyl([52, 38.5, 58], [6, 6, 0.3, 12], '#374151'),
    // Outer walls
    box([-56, 11, 13], [1, 22, 115], concrete),
    box([56, 11, 13], [1, 22, 115], concrete),
    // Scoreboards
    box([0, 21, -34], [38, 13, 1.5], '#111111'),
    box([0, 21, 64], [38, 13, 1.5], '#111111'),
    box([0, 15, -34], [40, 0.8, 1.8], '#dc2626'),
    box([0, 15, 64], [40, 0.8, 1.8], '#1e3a8a'),
    // Concourse
    box([0, 10.5, -28], [95, 1, 3], concrete),
    box([0, 10.5, 54], [95, 1, 3], concrete),
    // Vomitories
    ...vomitory(-44, 5, 0, 3, 3, 2),
    ...vomitory(-44, 5, 26, 3, 3, 2),
  ]
}

// ==========================
// 10. Lumen Field
// ==========================
function lumen(): StadiumPrimitive[] {
  const seats = '#166534'
  const seatsAlt = '#1e3a8a'
  const roof = '#6b7280'
  const steel = '#94a3b8'
  return [
    ...commonDetails(),
    // Lower tier
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 8, seatsAlt, 100),
    ...bleacherRows('back', 0, 1, 48, 6, seats, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seatsAlt, 85),
    // Upper tier — VERY steep (Hawks Nest)
    ...bleacherRows('left', -46, 12, 13, 10, seats, 95, 0.4, 1.4, 1.7),
    ...bleacherRows('right', 46, 12, 13, 10, seatsAlt, 95, 0.4, 1.4, 1.7),
    // DRAMATIC CANTILEVERED ROOFS
    box([-42, 30, 13], [28, 1.5, 100], roof, [0, 0, -Math.PI / 20], { isRoof: true }),
    box([42, 30, 13], [28, 1.5, 100], roof, [0, 0, Math.PI / 20], { isRoof: true }),
    // Roof support columns
    ...Array.from({ length: 6 }, (_, i) => {
      const z = -22 + i * 18
      return [
        box([-55, 18, z], [2.5, 24, 2.5], steel, [0, 0, 0], { isRoof: true }),
        box([55, 18, z], [2.5, 24, 2.5], steel, [0, 0, 0], { isRoof: true }),
      ]
    }).flat(),
    // Open end zones (smaller stands)
    ...bleacherRows('back', 0, 8, 52, 4, seats, 75),
    ...bleacherRows('front', 0, 8, -26, 4, seatsAlt, 75),
    // Supports
    ...supportStructure('left', -52, 6, 13, 95, 12, '#6b7280'),
    ...supportStructure('right', 52, 6, 13, 95, 12, '#6b7280'),
    // Scoreboard
    box([0, 23, -36], [33, 13, 1.5], '#111111'),
    box([0, 17, -36], [35, 0.8, 1.8], '#166534'),
    // Outer walls
    box([-58, 14, 13], [1, 28, 108], '#e5e7eb'),
    box([58, 14, 13], [1, 28, 108], '#e5e7eb'),
  ]
}

// ==========================
// 11. BC Place
// ==========================
function bcplace(): StadiumPrimitive[] {
  const seats = '#1e3a8a'
  const seats2 = '#2563eb'
  const dome = '#e2e8f0'
  const cables = '#94a3b8'
  const concrete = '#d1d5db'
  return [
    ...commonDetails(),
    // Lower tier
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 8, seats, 100),
    ...bleacherRows('back', 0, 1, 48, 6, seats, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seats, 85),
    // Upper tier
    ...bleacherRows('left', -46, 12, 13, 7, seats2, 108),
    ...bleacherRows('right', 46, 12, 13, 7, seats2, 108),
    ...bleacherRows('back', 0, 12, 56, 5, seats2, 98),
    ...bleacherRows('front', 0, 12, -30, 5, seats2, 98),
    // Outer walls (smooth)
    box([-58, 14, 13], [2.5, 28, 120], concrete),
    box([58, 14, 13], [2.5, 28, 120], concrete),
    box([0, 14, 68], [120, 28, 2.5], concrete),
    box([0, 14, -42], [120, 28, 2.5], concrete),
    // DOME ROOF
    cyl([0, 34, 13], [52, 58, 5, 24], dome, [0, 0, 0], { opacity: 0.45, isRoof: true }),
    cyl([0, 30, 13], [60, 60, 1.5, 24], cables, [0, 0, 0], { isRoof: true }),
    // Cable masts
    box([-58, 32, 13], [2.5, 10, 2.5], cables, [0, 0, 0], { isRoof: true }),
    box([58, 32, 13], [2.5, 10, 2.5], cables, [0, 0, 0], { isRoof: true }),
    box([0, 32, 65], [2.5, 10, 2.5], cables, [0, 0, 0], { isRoof: true }),
    box([0, 32, -39], [2.5, 10, 2.5], cables, [0, 0, 0], { isRoof: true }),
    // Supports
    ...supportStructure('left', -52, 6, 13, 108, 12, '#6b7280'),
    ...supportStructure('right', 52, 6, 13, 108, 12, '#6b7280'),
    // Vomitories
    ...vomitory(-44, 5, 0, 3, 3, 2),
    ...vomitory(-44, 5, 26, 3, 3, 2),
    ...vomitory(44, 5, 0, 3, 3, 2),
    ...vomitory(44, 5, 26, 3, 3, 2),
  ]
}

// ==========================
// 12. Estadio Azteca
// ==========================
function azteca(): StadiumPrimitive[] {
  const seats = '#166534'
  const seatsUpper = '#15803d'
  const concrete = '#a8a29e'
  const steel = '#78716c'
  return [
    ...commonDetails(),
    // Lower tier — VERY steep
    ...bleacherRows('left', -33, 1, 13, 10, seats, 100, 0.3, 1.1, 1.3),
    ...bleacherRows('right', 33, 1, 13, 10, seats, 100, 0.3, 1.1, 1.3),
    ...bleacherRows('back', 0, 1, 48, 8, seats, 85, 0.3, 1.1, 1.3),
    ...bleacherRows('front', 0, 1, -22, 8, seats, 85, 0.3, 1.1, 1.3),
    // Concourse gap
    box([-44, 13, 13], [4, 2.5, 102], concrete),
    box([44, 13, 13], [4, 2.5, 102], concrete),
    // Upper tier — MASSIVE steep overhanging
    ...bleacherRows('left', -48, 15, 13, 10, seatsUpper, 95, 0.4, 1.3, 1.7),
    ...bleacherRows('right', 48, 15, 13, 10, seatsUpper, 95, 0.4, 1.3, 1.7),
    ...bleacherRows('back', 0, 15, 55, 8, seatsUpper, 85, 0.4, 1.3, 1.7),
    ...bleacherRows('front', 0, 15, -29, 8, seatsUpper, 85, 0.4, 1.3, 1.7),
    // Upper tier lip/overhang
    box([-46, 29, 13], [14, 1.5, 98], concrete, [0, 0, 0], { isRoof: true }),
    box([46, 29, 13], [14, 1.5, 98], concrete, [0, 0, 0], { isRoof: true }),
    box([0, 29, 53], [84, 1.5, 14], concrete, [0, 0, 0], { isRoof: true }),
    box([0, 29, -27], [84, 1.5, 14], concrete, [0, 0, 0], { isRoof: true }),
    // Supports
    ...supportStructure('left', -55, 8, 13, 95, 16, concrete),
    ...supportStructure('right', 55, 8, 13, 95, 16, concrete),
    // Corner light towers
    ...floodlightTower(-50, 52, 42, steel),
    ...floodlightTower(50, 52, 42, steel),
    ...floodlightTower(-50, -26, 42, steel),
    ...floodlightTower(50, -26, 42, steel),
    // Scoreboard
    box([0, 27, -35], [28, 9, 1.5], '#111111'),
    box([0, 23, -35], [30, 0.8, 1.8], '#166534'),
    // Rim walls
    box([-60, 14, 13], [1.5, 28, 112], concrete),
    box([60, 14, 13], [1.5, 28, 112], concrete),
    // Vomitories
    ...vomitory(-44, 5, 5, 3, 3, 2),
    ...vomitory(-44, 5, 21, 3, 3, 2),
    ...vomitory(44, 5, 5, 3, 3, 2),
    ...vomitory(44, 5, 21, 3, 3, 2),
  ]
}

// ==========================
// 13. Estadio Akron
// ==========================
function akron(): StadiumPrimitive[] {
  const seats = '#dc2626'
  const seatsAlt = '#ffffff'
  const lattice = '#a8a29e'
  const canopy = '#e5e7eb'
  return [
    ...commonDetails(),
    // Lower tier (alternating red/white for Chivas)
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 8, seatsAlt, 100),
    ...bleacherRows('back', 0, 1, 48, 6, seats, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seatsAlt, 85),
    // Upper tier
    ...bleacherRows('left', -46, 12, 13, 7, seats, 108),
    ...bleacherRows('right', 46, 12, 13, 7, seatsAlt, 108),
    ...bleacherRows('back', 0, 12, 56, 5, seats, 98),
    ...bleacherRows('front', 0, 12, -30, 5, seatsAlt, 98),
    // LATTICE EXTERIOR — ring of pillars
    ...Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2
      const r = 60
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r + 13
      return box([x, 14, z], [2, 28, 2], lattice, [0, angle, 0])
    }),
    // Horizontal ring connecting pillars
    ...Array.from({ length: 24 }, (_, i) => {
      const angle = ((i + 0.5) / 24) * Math.PI * 2
      const r = 60
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r + 13
      return box([x, 24, z], [8, 0.8, 2], lattice, [0, angle, 0])
    }),
    // Partial canopy
    ...Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2
      const r = 56
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r + 13
      return box([x, 30, z], [12, 0.8, 5], canopy, [0, angle, 0], { isRoof: true })
    }),
    // Volcanic rock base wall
    cyl([0, 2, 13], [53, 56, 3.5, 24, 1, true], '#57534e'),
  ]
}

// ==========================
// 14. Estadio BBVA (Monterrey)
// ==========================
function monterrey(): StadiumPrimitive[] {
  const seats = '#1e3a8a'
  const seatsAlt = '#f8fafc'
  const canopy = '#e5e7eb'
  const steel = '#6b7280'
  return [
    ...commonDetails(),
    // Lower tier
    ...bleacherRows('left', -33, 1, 13, 8, seats, 100),
    ...bleacherRows('right', 33, 1, 13, 6, seatsAlt, 85),
    ...bleacherRows('back', 0, 1, 48, 6, seats, 85),
    ...bleacherRows('front', 0, 1, -22, 6, seats, 85),
    // Upper tier — west (left) and ends only
    ...bleacherRows('left', -47, 12, 13, 8, seats, 108),
    ...bleacherRows('back', 0, 12, 56, 5, seats, 95),
    ...bleacherRows('front', 0, 12, -30, 5, seats, 95),
    // DRAMATIC CANTILEVER ROOF (west only)
    box([-45, 29, 13], [33, 1.5, 105], canopy, [0, 0, -Math.PI / 14], { isRoof: true }),
    // Support trusses
    box([-60, 17, -12], [3, 26, 3], steel, [0, 0, 0], { isRoof: true }),
    box([-60, 17, 13], [3, 26, 3], steel, [0, 0, 0], { isRoof: true }),
    box([-60, 17, 38], [3, 26, 3], steel, [0, 0, 0], { isRoof: true }),
    // East side (right) — low single tier
    ...bleacherRows('right', 40, 7, 13, 3, seatsAlt, 80),
    // Supports
    ...supportStructure('left', -52, 6, 13, 108, 12, steel),
    // Scoreboard
    box([0, 23, -36], [28, 11, 1.5], '#111111'),
    box([0, 18, -36], [30, 0.8, 1.8], '#1e3a8a'),
    // Outer wall west
    box([-62, 15, 13], [1.5, 30, 112], steel),
    // East wall (low)
    box([47, 6, 13], [1, 12, 88], '#e5e7eb'),
    // Vomitories
    ...vomitory(-44, 5, 5, 3, 3, 2),
    ...vomitory(-44, 5, 21, 3, 3, 2),
  ]
}

// ==========================
// 15. BMO Field
// ==========================
function bmo(): StadiumPrimitive[] {
  const seats = '#dc2626'
  const seatsAlt = '#1e3a8a'
  const canopy = '#d1d5db'
  const steel = '#6b7280'
  return [
    ...commonDetails(),
    // Lower tier (intimate)
    ...bleacherRows('left', -30, 1, 13, 7, seats, 92),
    ...bleacherRows('right', 30, 1, 13, 7, seatsAlt, 92),
    ...bleacherRows('back', 0, 1, 44, 5, seats, 72),
    ...bleacherRows('front', 0, 1, -18, 5, seatsAlt, 72),
    // Upper tier — sidelines
    ...bleacherRows('left', -40, 10, 13, 5, seats, 82),
    ...bleacherRows('right', 40, 10, 13, 5, seatsAlt, 82),
    // EAST STAND CANOPY
    box([38, 18, 13], [20, 1.5, 88], canopy, [0, 0, Math.PI / 18], { isRoof: true }),
    box([48, 10, -10], [2.5, 18, 2.5], steel, [0, 0, 0], { isRoof: true }),
    box([48, 10, 13], [2.5, 18, 2.5], steel, [0, 0, 0], { isRoof: true }),
    box([48, 10, 36], [2.5, 18, 2.5], steel, [0, 0, 0], { isRoof: true }),
    // Open end zone stand
    ...bleacherRows('back', 0, 4, 47, 3, seats, 65),
    // Supports
    ...supportStructure('left', -38, 4, 13, 82, 8, steel),
    ...supportStructure('right', 38, 4, 13, 82, 8, steel),
    // Corner light poles
    ...floodlightTower(-40, 42, 30, steel),
    ...floodlightTower(40, 42, 30, steel),
    ...floodlightTower(-40, -16, 30, steel),
    ...floodlightTower(40, -16, 30, steel),
    // Outer walls
    box([-44, 7, 13], [1, 14, 96], '#e5e7eb'),
    box([44, 7, 13], [1, 14, 96], '#e5e7eb'),
  ]
}

// ==========================
// 16. Geodome at TQL Stadium
// ==========================
function geodome(): StadiumPrimitive[] {
  const seats = '#ea580c'
  const seatsAlt = '#1e3a8a'
  const canopy = '#d1d5db'
  const steel = '#6b7280'
  return [
    ...commonDetails(),
    // Lower tier — very steep, close to pitch
    ...bleacherRows('left', -32, 1, 13, 9, seats, 96, 0.3, 1.1, 1.3),
    ...bleacherRows('right', 32, 1, 13, 9, seatsAlt, 96, 0.3, 1.1, 1.3),
    ...bleacherRows('back', 0, 1, 46, 7, seats, 78, 0.3, 1.1, 1.3),
    ...bleacherRows('front', 0, 1, -20, 7, seatsAlt, 78, 0.3, 1.1, 1.3),
    // Upper tier — sidelines
    ...bleacherRows('left', -44, 12, 13, 7, seats, 88, 0.4, 1.3, 1.6),
    ...bleacherRows('right', 44, 12, 13, 7, seatsAlt, 88, 0.4, 1.3, 1.6),
    // WEST STAND OVERHANG
    box([-42, 27, 13], [24, 1.5, 94], canopy, [0, 0, -Math.PI / 16], { isRoof: true }),
    box([-54, 16, -8], [2.5, 22, 2.5], steel, [0, 0, 0], { isRoof: true }),
    box([-54, 16, 34], [2.5, 22, 2.5], steel, [0, 0, 0], { isRoof: true }),
    box([-54, 16, 13], [2.5, 22, 2.5], steel, [0, 0, 0], { isRoof: true }),
    // End zone stands (smaller)
    ...bleacherRows('back', 0, 8, 49, 3, seats, 68),
    ...bleacherRows('front', 0, 8, -23, 3, seatsAlt, 68),
    // Supports
    ...supportStructure('left', -48, 6, 13, 88, 12, steel),
    ...supportStructure('right', 48, 6, 13, 88, 12, steel),
    // Scoreboard
    box([0, 21, 55], [23, 9, 1.5], '#111111'),
    box([0, 17, 55], [25, 0.8, 1.8], '#ea580c'),
    // Corner accent pillars (FCC branding)
    box([-42, 14, 45], [3, 18, 3], '#ea580c'),
    box([42, 14, 45], [3, 18, 3], '#1e3a8a'),
    box([-42, 14, -19], [3, 18, 3], '#ea580c'),
    box([42, 14, -19], [3, 18, 3], '#1e3a8a'),
    // Outer walls
    box([-50, 10, 13], [1, 20, 98], '#e5e7eb'),
    box([50, 10, 13], [1, 20, 98], '#e5e7eb'),
  ]
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------
const STADIUM_BUILDERS: Record<string, () => StadiumPrimitive[]> = {
  metlife,
  rosebowl,
  sofi,
  levi,
  att,
  nrg,
  mercedes,
  lincoln,
  gillette,
  centurylink: lumen,
  bcplace,
  azteca,
  akron,
  monterrey,
  bmo,
  geodome,
}

export function getStadiumPrimitives(stadiumId: string, hideRoof: boolean = false): StadiumPrimitive[] {
  const builder = STADIUM_BUILDERS[stadiumId]
  if (!builder) {
    return metlife()
  }

  const primitives = builder()

  if (hideRoof) {
    return primitives.filter(p => !p.isRoof)
  }

  return primitives
}
