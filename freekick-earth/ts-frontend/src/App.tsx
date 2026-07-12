/**
 * FreeKick Earth — Main App
 * Full-screen sequential wizard flow.
 */

import { useState } from 'react'
import StepWizard from './components/StepWizard'
import MultiplayerWizard from './components/MultiplayerWizard'

function App() {
  const [multiMode, setMultiMode] = useState<{ mode: 'create' | 'join', roomCode?: string } | null>(null)

  if (multiMode) {
    return <MultiplayerWizard mode={multiMode.mode} roomCode={multiMode.roomCode} onExit={() => setMultiMode(null)} />
  }

  return <StepWizard onMultiplayerMode={(mode, roomCode) => setMultiMode({ mode, roomCode })} />
}

export default App
