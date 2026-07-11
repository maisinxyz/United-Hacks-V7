/**
 * StadiumOverlay — Floating stadium selector for Step 1.
 */

import { useEffect, useState } from 'react'
import { fetchStadiums, fetchConditions, type Stadium, type StadiumConditions } from '../api'
import type { KickConfig } from './StepWizard'

interface Props {
  config: KickConfig
  onUpdate: (patch: Partial<KickConfig>) => void
  onNext: () => void
}

export default function StadiumOverlay({ config, onUpdate, onNext }: Props) {
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [conditions, setConditions] = useState<StadiumConditions | null>(config.conditions)

  useEffect(() => {
    fetchStadiums()
      .then((list) => {
        setStadiums(list)
        if (!config.stadiumId && list.length > 0) {
          onUpdate({ stadiumId: list[0].id })
        }
      })
      .catch(console.error)
  }, [])

  const selectedId = config.stadiumId
  useEffect(() => {
    if (!selectedId) return
    fetchConditions(selectedId)
      .then((c) => {
        setConditions(c)
        onUpdate({ conditions: c })
      })
      .catch(console.error)
  }, [selectedId])

  const handleNext = () => {
    if (selectedId && conditions) onNext()
  }

  return (
    <div className="overlay-card frosted">
      <div className="step-header">
        <span className="step-number">01</span>
        <h2>Choose Stadium</h2>
      </div>

      <div className="stadium-selector-full">
        <select
          className="stadium-select-large"
          value={selectedId}
          onChange={(e) => onUpdate({ stadiumId: e.target.value })}
        >
          <option value="" disabled>Select a stadium…</option>
          {stadiums.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.city}, {s.country}
            </option>
          ))}
        </select>
      </div>

      {conditions && (
        <div className="conditions-grid small-margin">
          <ConditionCard icon="🏔" label="Altitude" value={`${conditions.stadium.altitude_meters}m`} />
          <ConditionCard icon="🌡" label="Temp" value={`${conditions.temperature_celsius.toFixed(1)}°`} />
          <ConditionCard icon="💨" label="Wind" value={`${conditions.wind_speed_m_s.toFixed(1)} m/s`} />
          <div className="condition-card highlight">
            <span className="condition-icon">🌬</span>
            <div>
              <div className="condition-label">Air Density (ρ)</div>
              <div className="condition-value">{conditions.air_density.toFixed(4)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="step-actions right">
        <button className="wizard-btn primary" onClick={handleNext} disabled={!selectedId || !conditions}>
          Next →
        </button>
      </div>
    </div>
  )
}

function ConditionCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="condition-card">
      <span className="condition-icon">{icon}</span>
      <div>
        <div className="condition-label">{label}</div>
        <div className="condition-value">{value}</div>
      </div>
    </div>
  )
}
