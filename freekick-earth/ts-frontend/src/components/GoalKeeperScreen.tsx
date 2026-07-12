/**
 * GoalKeeperScreen — View for the goalkeeper player.
 */

interface Props {
  stadiumName?: string
}

export default function GoalKeeperScreen({ stadiumName }: Props) {
  return (
    <div className="overlay-card frosted center-panel select-none" style={{ textAlign: 'center', padding: '3rem' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#38bdf8' }}>You are the Goalkeeper!</h2>
      <p style={{ fontSize: '1.2rem', color: '#475569' }}>
        Get ready to defend the net at {stadiumName || 'the stadium'}.
      </p>
      <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.05)', borderRadius: '12px' }}>
        <p style={{ fontStyle: 'italic', color: '#94a3b8' }}>
          (Goalkeeper mechanics coming soon. Watch the incoming shot!)
        </p>
      </div>
    </div>
  )
}
