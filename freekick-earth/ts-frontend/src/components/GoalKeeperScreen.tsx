import { useState, useEffect } from 'react'

interface Props {
  stadiumName?: string
  step: number
  outcome?: 'save' | 'goal' | null
  onReact?: (x: number, y: number) => void
}

export default function GoalKeeperScreen({ stadiumName, step, outcome }: Props) {
  const [showIntro, setShowIntro] = useState(true)

  useEffect(() => {
    // Hide the "YOU ARE THE GOAL KEEPER" banner after 3 seconds
    const timer = setTimeout(() => {
      setShowIntro(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  if (step === 4.5) {
    return (
      <div style={{
        position: 'absolute',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        pointerEvents: 'none',
        textAlign: 'center',
        padding: '0.85rem 1.25rem',
        borderRadius: '999px',
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'white',
        textShadow: '0 2px 8px rgba(0,0,0,0.8)'
      }}>
        <div style={{ fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fca5a5', fontWeight: 800 }}>
          Keeper View
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700 }}>
          Click the target in the goal to save the shot.
        </div>
      </div>
    )
  }

  if (step >= 4.6 && outcome) {
    return (
      <div style={{
        position: 'absolute',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        pointerEvents: 'none',
        textAlign: 'center',
        padding: '0.85rem 1.25rem',
        borderRadius: '999px',
        background: outcome === 'save' ? 'rgba(21, 128, 61, 0.65)' : 'rgba(153, 27, 27, 0.65)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'white',
        textShadow: '0 2px 8px rgba(0,0,0,0.8)'
      }}>
        <div style={{ fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }}>
          {outcome === 'save' ? 'Save Confirmed' : 'Shot Finished'}
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700 }}>
          {outcome === 'save' ? 'Nice stop.' : 'Keep tracking the goal.'}
        </div>
      </div>
    )
  }

  if (showIntro && step < 4.5) {
    return (
      <div className="overlay-card frosted center-panel select-none" style={{ textAlign: 'center', padding: '2rem 2.5rem', pointerEvents: 'none', maxWidth: '420px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#38bdf8' }}>You are the Goalkeeper!</h2>
        <p style={{ fontSize: '1.2rem', color: '#475569' }}>
          Get ready to defend the net at {stadiumName || 'the stadium'}.
        </p>
      </div>
    )
  }

  return null
}
