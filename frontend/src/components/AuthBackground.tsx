const RING_DELAYS = ['0s', '2.25s', '4.5s', '6.75s'];

/**
 * Ambient backdrop for the auth screens — an "echo" propagating outwards:
 * concentric ripple rings expanding from behind the card, two slow-drifting
 * accent orbs and a dotted grid that fades towards the edges.
 * Pure CSS animation (transform/opacity only); disabled under reduced motion.
 * Styles: index.css → "Auth background (echo ripples)".
 */
export default function AuthBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="echo-auth-grid absolute inset-0" />

      <div className="echo-auth-orb echo-auth-orb--accent" />
      <div className="echo-auth-orb echo-auth-orb--energy" />

      <div className="absolute left-1/2 top-1/2">
        {RING_DELAYS.map((delay) => (
          <span key={delay} className="echo-auth-ring" style={{ animationDelay: delay }} />
        ))}
      </div>
    </div>
  );
}
