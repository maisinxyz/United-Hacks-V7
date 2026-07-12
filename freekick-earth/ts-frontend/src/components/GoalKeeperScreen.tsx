import { useState, useEffect } from 'react'

interface Props {
  stadiumName?: string
  step: number
  onReact: (x: number, y: number) => void
}

export default function GoalKeeperScreen({ stadiumName, step, onReact }: Props) {
  const [timeLeft, setTimeLeft] = useState(1.5)

  useEffect(() => {
    if (step === 4.5) {
      setTimeLeft(1.5)
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0.1) {
            clearInterval(interval)
            return 0
          }
          return prev - 0.1
        })
      }, 100)
      return () => clearInterval(interval)
    }
  }, [step])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 4.5) return
    const rect = e.currentTarget.getBoundingClientRect()
    // Goal width is 7.32m (-3.66 to 3.66)
    // Goal height is 2.44m (0 to 2.44)
    const x = ((e.clientX - rect.left) / rect.width) * 7.32 - 3.66
    const y = (1 - (e.clientY - rect.top) / rect.height) * 2.44
    onReact(x, y)
  }

  if (step === 4.5) {
    return (
      <div className="overlay-card frosted center-panel select-none" style={{ textAlign: 'center', padding: '2rem', width: '80%', maxWidth: '800px' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#ef4444' }}>REACT NOW!</h2>
        <div style={{ width: '100%', height: '10px', background: '#333', borderRadius: '5px', overflow: 'hidden', marginBottom: '1rem' }}>
          <div style={{ width: `${(timeLeft / 1.5) * 100}%`, height: '100%', background: timeLeft > 0.5 ? '#ef4444' : '#b91c1c', transition: 'width 0.1s linear' }} />
        </div>
        <p style={{ marginBottom: '1rem', color: '#cbd5e1' }}>Click where you think the ball is going!</p>
        
        {/* Goal Grid */}
        <div 
          onClick={handleClick}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '7.32 / 2.44', // Proportional to a real soccer goal
            border: '4px solid #fff',
            borderBottom: '4px solid #4ade80', // Ground line
            cursor: 'crosshair',
            background: 'rgba(255, 255, 255, 0.1)',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
            backgroundSize: '20% 33.33%', // 5x3 grid
            boxShadow: '0 0 20px rgba(0,0,0,0.5) inset'
          }}
        >
        </div>
      </div>
    )
  }

  return (
    <div className="overlay-card frosted center-panel select-none" style={{ textAlign: 'center', padding: '3rem' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#38bdf8' }}>You are the Goalkeeper!</h2>
      <p style={{ fontSize: '1.2rem', color: '#475569' }}>
        Get ready to defend the net at {stadiumName || 'the stadium'}.
      </p>
      <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.05)', borderRadius: '12px' }}>
        <p style={{ fontStyle: 'italic', color: '#94a3b8' }}>
          {step < 0 ? "Waiting for the game to start..." : "Watch the kicker's run-up carefully. Be ready to react!"}
        </p>
      </div>
    </div>
  )
}
