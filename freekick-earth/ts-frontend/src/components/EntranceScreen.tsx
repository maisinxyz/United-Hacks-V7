/**
 * EntranceScreen - Initial title screen before the game starts.
 */

interface Props {
  onPlay: () => void
}

export default function EntranceScreen({ onPlay }: Props) {
  return (
    <div className="entrance-screen">
      <div className="entrance-content">
        <h1 className="game-title">FreeKick Earth</h1>
        <p className="game-subtitle">Dynamic Weather. Realistic Physics. Can you score?</p>
        
        <div className="entrance-actions">
          <button className="wizard-btn primary huge" onClick={onPlay}>
            ▶ PLAY NOW
          </button>
          
          {/* Placeholders for future buttons */}
          <div className="future-buttons">
            <button className="wizard-btn outline small" disabled>Tutorial (Coming Soon)</button>
            <button className="wizard-btn outline small" disabled>Settings (Coming Soon)</button>
          </div>
        </div>
      </div>
    </div>
  )
}
