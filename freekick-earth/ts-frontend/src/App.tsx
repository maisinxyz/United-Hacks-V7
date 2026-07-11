/**
 * FreeKick Earth — Main App
 *
 * Side-by-side layout:
 *   Left:  Control panel (stadium, conditions, kick params)
 *   Right: 3D pitch scene (revealed after first simulation)
 */

import { useState } from 'react'
import ControlPanel from './components/ControlPanel'
import PitchScene from './components/PitchScene'
import type { SimulateResult } from './api'

function App() {
  const [simResult, setSimResult] = useState<SimulateResult | null>(null)

  return (
    <div className="app-layout">
      {/* Left panel */}
      <ControlPanel onSimulationResult={setSimResult} />

      {/* Right — 3D scene or placeholder */}
      <div className="scene-container">
        {simResult ? (
          <PitchScene
            trajectory={simResult.trajectory}
            ghostTrajectory={simResult.ghost_trajectory}
            result={simResult.result}
          />
        ) : (
          <div className="scene-placeholder">
            <div className="icon">⚽</div>
            <p>
              Select a stadium, configure your kick, and hit
              <strong> Simulate</strong> to see the trajectory in 3D.
            </p>
            <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
              The same kick behaves differently at each stadium due to altitude,
              temperature, and air density.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
