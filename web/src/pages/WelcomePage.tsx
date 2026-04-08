import { useNavigate } from 'react-router-dom';

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'relative',
      height: '100vh',
      width: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 80,
    }}>
      {/* Background — photo if available, rich gradient fallback otherwise */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(160deg, #0d0d1a 0%, #0f1f3d 30%, #1a1060 55%, #2d0a3a 80%, #0d0d1a 100%)',
      }} />
      {/* Decorative music-note blobs for depth */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.18,
        fontSize: 120, userSelect: 'none', pointerEvents: 'none',
      }}>
        <span style={{ position: 'absolute', top: '8%',  left: '5%',  transform: 'rotate(-20deg)' }}>🎸</span>
        <span style={{ position: 'absolute', top: '12%', right: '8%', transform: 'rotate(15deg)',  fontSize: 90 }}>🎹</span>
        <span style={{ position: 'absolute', top: '55%', left: '2%',  transform: 'rotate(10deg)',  fontSize: 80 }}>🎵</span>
        <span style={{ position: 'absolute', top: '40%', right: '3%', transform: 'rotate(-12deg)', fontSize: 100 }}>🎶</span>
        <span style={{ position: 'absolute', bottom: '18%', left: '30%', fontSize: 70 }}>🎼</span>
      </div>
      <img
        src="/Band.jpg"
        alt="MuZalkin band"
        className="welcome-band-img"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />

      {/* Dark gradient overlay — stronger at bottom for button readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.75) 100%)',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
      }}>
        {/* App title */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 52,
            fontWeight: 900,
            color: '#ffffff',
            margin: 0,
            letterSpacing: -1,
            textShadow: '0 2px 16px rgba(0,0,0,0.5)',
          }}>
            MuZalkin
          </h1>
          <p style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.85)',
            margin: '6px 0 0',
            letterSpacing: 1,
            textShadow: '0 1px 6px rgba(0,0,0,0.5)',
          }}>
            חיפוש אקורדים • Chord Search
          </p>
        </div>

        {/* Start Playing button */}
        <button
          onClick={() => navigate('/search')}
          style={{
            paddingInline: 48,
            paddingBlock: 16,
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
            backgroundColor: '#4285F4',
            border: 'none',
            borderRadius: 50,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(66,133,244,0.5)',
            letterSpacing: 0.5,
          }}
        >
          Start Playing 🎸
        </button>
      </div>
    </div>
  );
}
