import { useState, useEffect } from 'react'

interface Props {
  stadiumName?: string
  step: number
  onReact?: (x: number, y: number) => void
}

export default function GoalKeeperScreen({ stadiumName, step }: Props) {
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
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 100,
        textShadow: '0 4px 12px rgba(0,0,0,0.8)'
      }}>
        <h2 style={{ fontSize: '4rem', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          GET READY!
        </h2>
        <p style={{ fontSize: '1.5rem', color: 'white', fontWeight: 600 }}>Click the target inside the net!</p>
      </div>
    )
  }

  if (showIntro && step < 4.5) {
    return (
      <div className="overlay-card frosted center-panel select-none" style={{ textAlign: 'center', padding: '3rem', pointerEvents: 'none' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#38bdf8' }}>You are the Goalkeeper!</h2>
        <p style={{ fontSize: '1.2rem', color: '#475569' }}>
          Get ready to defend the net at {stadiumName || 'the stadium'}.
        </p>
      </div>
    )
  }

  return null
}
