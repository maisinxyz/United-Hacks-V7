/**
 * EntranceScreen - Initial title screen before the game starts.
 */

import { useState } from 'react'

interface Props {
  onPlaySingle: () => void
  onPlayMulti: (mode: 'create' | 'join', roomCode?: string) => void
}

export default function EntranceScreen({ onPlaySingle, onPlayMulti }: Props) {
  const [mode, setMode] = useState<'menu' | 'multi'>('menu')
  const [roomCode, setRoomCode] = useState('')

  return (
    <div className="entrance-screen">
      <div className="entrance-content">
        <h1 className="game-title">[TITLE]</h1>
        
        <div className="entrance-actions" style={{ marginTop: '2rem' }}>
          {mode === 'menu' && (
            <>
              <button className="wizard-btn primary huge" onClick={onPlaySingle} style={{ boxShadow: 'none', marginBottom: '1rem' }}>
                ▶ SINGLE PLAYER
              </button>
              <button className="wizard-btn secondary huge" onClick={() => setMode('multi')} style={{ boxShadow: 'none' }}>
                🌐 MULTIPLAYER
              </button>
              <div className="future-buttons">
                <button className="wizard-btn outline small" disabled>Tutorial (Coming Soon)</button>
                <button className="wizard-btn outline small" disabled>Settings (Coming Soon)</button>
              </div>
            </>
          )}

          {mode === 'multi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <button className="wizard-btn primary huge" onClick={() => onPlayMulti('create')} style={{ boxShadow: 'none', width: '100%' }}>
                ➕ CREATE ROOM
              </button>
              
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <input 
                  type="text" 
                  placeholder="ROOM CODE" 
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  style={{ flex: 1, padding: '12px', fontSize: '1.2rem', textAlign: 'center', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', color: 'white', textTransform: 'uppercase' }}
                />
                <button 
                  className="wizard-btn secondary huge" 
                  onClick={() => onPlayMulti('join', roomCode)}
                  disabled={roomCode.length !== 4}
                  style={{ boxShadow: 'none', padding: '0 20px' }}
                >
                  JOIN
                </button>
              </div>

              <button className="wizard-btn outline small" onClick={() => setMode('menu')} style={{ marginTop: '1rem' }}>
                ← BACK
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
