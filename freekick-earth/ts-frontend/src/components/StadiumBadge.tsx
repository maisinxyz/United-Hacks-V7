/**
 * StadiumBadge — Sleek frosted-glass badge showing stadium info & conditions.
 */

import type { StadiumConditions } from '../api'

interface Props {
  conditions: StadiumConditions
}

function windDirectionLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

export default function StadiumBadge({ conditions }: Props) {
  return (
    <div className="stadium-badge">
      <div className="badge-header">
        <span className="badge-icon">🏟️</span>
        <div className="badge-title">
          <h3>{conditions.stadium.name}</h3>
          <p>{conditions.stadium.city}, {conditions.stadium.country}</p>
        </div>
      </div>
      <div className="badge-stats">
        <div className="badge-stat">
          <span className="badge-stat-icon">⛰️</span>
          <span className="badge-stat-value">{conditions.stadium.altitude_meters.toLocaleString()}m</span>
        </div>
        <div className="badge-stat">
          <span className="badge-stat-icon">🌡️</span>
          <span className="badge-stat-value">{conditions.temperature_celsius.toFixed(1)}°C</span>
        </div>
        <div className="badge-stat">
          <span className="badge-stat-icon">💨</span>
          <span className="badge-stat-value">{conditions.wind_speed_m_s.toFixed(1)} m/s {windDirectionLabel(conditions.wind_direction_deg)}</span>
        </div>
        <div className="badge-stat highlight">
          <span className="badge-stat-icon">🌬️</span>
          <span className="badge-stat-value">ρ = {conditions.air_density.toFixed(4)}</span>
        </div>
      </div>
    </div>
  )
}
