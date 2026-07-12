import { useEffect } from 'react'
import type { StadiumConditions } from '../api'

interface Props {
  stadiumName: string
  location: string
  conditions: StadiumConditions | null
  onComplete: () => void
}

export default function FlyoverScreen({ stadiumName, location, conditions, onComplete }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, 5000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="overlay-container" style={{ pointerEvents: 'none', justifyContent: 'center' }}>
      {/* Center: Stadium Name and Location */}
      <div style={{ textAlign: 'center', animation: 'fadeIn 1s ease-out' }}>
        <h1 style={{ 
          fontSize: '4rem', 
          fontWeight: 800, 
          color: 'white', 
          textShadow: '0 4px 12px rgba(0,0,0,0.5)',
          margin: 0,
          letterSpacing: '2px'
        }}>
          {stadiumName.toUpperCase()}
        </h1>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 400, 
          color: 'rgba(255, 255, 255, 0.9)', 
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          marginTop: '8px'
        }}>
          {location}
        </h2>
      </div>

      {/* Right side: Environmental Factors */}
      {conditions && (
        <div style={{
          position: 'absolute',
          right: '40px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(12px)',
          padding: '24px',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: 'slideInRight 1s ease-out 0.5s both'
        }}>
          <Factor emoji="🌡️" label="Temperature" value={`${Math.round(conditions.temperature_celsius)}°C`} />
          <Factor emoji="💨" label="Wind" value={`${conditions.wind_speed_m_s.toFixed(1)} m/s`} />
          <Factor emoji="⛰️" label="Altitude" value={`${Math.round(conditions.stadium.altitude_meters)} m`} />
          <Factor emoji="☁️" label="Air Density" value={`${conditions.air_density.toFixed(2)} kg/m³`} />
        </div>
      )}
    </div>
  )
}

function Factor({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <span style={{ fontSize: '2rem' }}>{emoji}</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {label}
        </span>
        <span style={{ fontSize: '1.2rem', color: 'white', fontWeight: 600 }}>
          {value}
        </span>
      </div>
    </div>
  )
}
