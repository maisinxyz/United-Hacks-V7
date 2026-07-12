import { useEffect, useRef } from 'react'

export default function SnowOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = canvas.width = window.innerWidth
    let h = canvas.height = window.innerHeight

    const handleResize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    const particles: {x: number, y: number, r: number, vx: number, vy: number}[] = []
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 3 + 1,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 1,
      })
    }

    let animationId: number
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.beginPath()
      for (const p of particles) {
        ctx.moveTo(p.x, p.y)
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2, true)
      }
      ctx.fill()

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.y > h) {
          p.y = 0
          p.x = Math.random() * w
        }
        if (p.x > w) p.x = 0
        if (p.x < 0) p.x = w
      }

      animationId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      <div className="absolute inset-0 opacity-40 mix-blend-overlay"
           style={{
             boxShadow: 'inset 0 0 150px rgba(255,255,255,0.8), inset 0 0 50px rgba(200,220,255,0.6)',
             background: 'radial-gradient(circle, transparent 40%, rgba(200, 220, 255, 0.2) 100%)'
           }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 opacity-60 mix-blend-screen" />
    </div>
  )
}
