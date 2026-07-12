/**
 * FreeKick Earth — Main App
 * Full-screen sequential wizard flow.
 */

import { useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import StepWizard from './components/StepWizard'
import MultiplayerWizard from './components/MultiplayerWizard'
import SpotifyPlayer from './components/SpotifyPlayer'

function App() {
  const [multiMode, setMultiMode] = useState<{ mode: 'create' | 'join', roomCode?: string } | null>(null)

  return (
    <>
      {multiMode ? (
        <MultiplayerWizard mode={multiMode.mode} roomCode={multiMode.roomCode} onExit={() => setMultiMode(null)} />
      ) : (
        <StepWizard onMultiplayerMode={(mode, roomCode) => setMultiMode({ mode, roomCode })} />
      )}
      <SpotifyPlayer />
      <Analytics />
    </>
  )
}

export default App
