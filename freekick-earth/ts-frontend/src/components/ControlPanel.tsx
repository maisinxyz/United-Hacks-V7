/**
 * ControlPanel — Left sidebar with stadium selection,
 * environment display, kick parameter sliders, and simulate button.
 */

import { useEffect, useState } from 'react'
import {
  fetchStadiums,
  fetchConditions,
  runSimulation,
  type Stadium,
  type StadiumConditions,
  type SimulateResult,
} from '../api'

interface Props {
  onSimulationResult: (result: SimulateResult) => void
}

export default function ControlPanel({ onSimulationResult }: Props) {
  // --- State ---
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [conditions, setConditions] = useState<StadiumConditions | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SimulateResult | null>(null)

  // Kick parameters
  const [power, setPower] = useState(28)
  const [hAngle, setHAngle] = useState(0)
  const [vAngle, setVAngle] = useState(22)
  const [spinRate, setSpinRate] = useState(8)
  const [spinAxisX, setSpinAxisX] = useState(0)
  const [spinAxisY, setSpinAxisY] = useState(1)
  const [spinAxisZ, setSpinAxisZ] = useState(0)

  // --- Load stadiums on mount ---
  useEffect(() => {
    fetchStadiums()
      .then((list) => {
        setStadiums(list)
        if (list.length > 0) {
          setSelectedId(list[0].id)
        }
      })
      .catch(console.error)
  }, [])

  // --- Fetch conditions when stadium changes ---
  useEffect(() => {
    if (!selectedId) return
    fetchConditions(selectedId)
      .then(setConditions)
      .catch(console.error)
  }, [selectedId])

  // --- Simulate ---
  const handleSimulate = async () => {
    if (!selectedId) return
    setLoading(true)
    setResult(null)

    try {
      const simResult = await runSimulation({
        stadium_id: selectedId,
        power,
        horizontal_angle: hAngle,
        vertical_angle: vAngle,
        spin_rate: spinRate,
        spin_axis_x: spinAxisX,
        spin_axis_y: spinAxisY,
        spin_axis_z: spinAxisZ,
      })
      setResult(simResult)
      onSimulationResult(simResult)
    } catch (err) {
      console.error('Simulation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const resultLabel: Record<string, string> = {
    goal: '⚽ GOAL!',
    miss_high: '📈 Over the bar!',
    miss_wide: '↔️ Wide of the post!',
    miss_short: '📉 Fell short!',
  }

  return (
    <div className="control-panel">
      {/* Header */}
      <div className="panel-header">
        <h1>⚽ FreeKick Earth</h1>
        <p>Master the environment before you master the ball.</p>
      </div>

      {/* Stadium Selector */}
      <div className="panel-section">
        <div className="section-title">Select Stadium</div>
        <select
          className="stadium-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {stadiums.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.city}
            </option>
          ))}
        </select>
      </div>

      {/* Environment Dashboard */}
      {conditions && (
        <div className="panel-section">
          <div className="section-title">Environment Conditions</div>
          <div className="env-grid">
            <div className="env-card">
              <div className="env-label">🏔 Altitude</div>
              <div className="env-value">
                {conditions.stadium.altitude_meters}
                <span className="env-unit">m</span>
              </div>
            </div>
            <div className="env-card">
              <div className="env-label">🌡 Temperature</div>
              <div className="env-value">
                {conditions.temperature_celsius.toFixed(1)}
                <span className="env-unit">°C</span>
              </div>
            </div>
            <div className="env-card">
              <div className="env-label">💧 Humidity</div>
              <div className="env-value">
                {conditions.humidity_percent.toFixed(0)}
                <span className="env-unit">%</span>
              </div>
            </div>
            <div className="env-card">
              <div className="env-label">💨 Wind</div>
              <div className="env-value">
                {conditions.wind_speed_m_s.toFixed(1)}
                <span className="env-unit">m/s</span>
              </div>
            </div>
            <div className="env-card density-highlight">
              <div className="env-label">🌬 Air Density (ρ)</div>
              <div className="env-value">
                {conditions.air_density.toFixed(4)}
                <span className="env-unit">kg/m³</span>
              </div>
            </div>
          </div>
          <div
            className="mt-2 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Source: {conditions.data_source === 'live' ? '🟢 Live' : '🔵 Estimated (ISA model)'}
          </div>
        </div>
      )}

      {/* Kick Controls */}
      <div className="panel-section">
        <div className="section-title">Kick Parameters</div>

        <Slider
          label="Power"
          value={power}
          min={10}
          max={40}
          step={0.5}
          unit="m/s"
          onChange={setPower}
        />
        <Slider
          label="Horizontal Angle"
          value={hAngle}
          min={-30}
          max={30}
          step={0.5}
          unit="°"
          onChange={setHAngle}
        />
        <Slider
          label="Vertical Pitch"
          value={vAngle}
          min={5}
          max={45}
          step={0.5}
          unit="°"
          onChange={setVAngle}
        />
        <Slider
          label="Spin Rate"
          value={spinRate}
          min={0}
          max={60}
          step={1}
          unit="rad/s"
          onChange={setSpinRate}
        />
      </div>

      {/* Spin Axis (compact) */}
      <div className="panel-section">
        <div className="section-title">Spin Axis</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <MiniSlider label="X" value={spinAxisX} onChange={setSpinAxisX} />
          <MiniSlider label="Y" value={spinAxisY} onChange={setSpinAxisY} />
          <MiniSlider label="Z" value={spinAxisZ} onChange={setSpinAxisZ} />
        </div>
      </div>

      {/* Simulate Button */}
      <div className="panel-section" style={{ marginTop: 'auto' }}>
        {result && (
          <div
            className={`result-banner ${result.result === 'goal' ? 'goal' : 'miss'}`}
            style={{ marginBottom: 12 }}
          >
            {resultLabel[result.result] ?? result.result}
          </div>
        )}
        <button
          className={`simulate-btn ${loading ? 'loading' : ''}`}
          onClick={handleSimulate}
          disabled={loading || !selectedId}
        >
          {loading ? 'Simulating…' : '🚀 Simulate Kick'}
        </button>
      </div>
    </div>
  )
}

// --- Reusable Slider Component ---

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="slider-group">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

// --- Mini Slider for Spin Axis ---

function MiniSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ flex: 1 }}>
      <div
        className="slider-header"
        style={{ fontSize: '0.75rem' }}
      >
        <span className="slider-label">{label}</span>
        <span className="slider-value" style={{ fontSize: '0.72rem' }}>
          {value.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}
