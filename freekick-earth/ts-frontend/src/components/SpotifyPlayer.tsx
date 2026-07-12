import { useState } from 'react'

export default function SpotifyPlayer() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={`spotify-player-widget ${isOpen ? 'open' : ''}`}>
      <div className="spotify-iframe-container">
        <iframe 
          style={{ borderRadius: '12px' }}
          src="https://open.spotify.com/embed/playlist/37i9dQZF1DX4vgOVqe6BJn?utm_source=generator&theme=0" 
          width="100%" 
          height="152" 
          frameBorder="0" 
          allowFullScreen={false}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
          loading="lazy"
        ></iframe>
      </div>
      <button 
        className="spotify-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle EA SPORTS FIFA 23 Soundtrack"
      >
        🎵 FIFA Soundtrack
      </button>
    </div>
  )
}
