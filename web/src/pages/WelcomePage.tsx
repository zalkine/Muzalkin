import { useNavigate } from 'react-router-dom';

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'relative',
      height: '100dvh',
      width: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 72,
    }}>

      {/* ── Deep space / concert background ─────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: '#07061a',
      }} />

      {/* Bokeh light orbs — simulates stage lighting */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '20%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(160,64,255,0.55) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', top: '5%', right: '10%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,60,180,0.45) 0%, transparent 70%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', top: '35%', left: '-5%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,141,255,0.4) 0%, transparent 70%)', filter: 'blur(35px)' }} />
        <div style={{ position: 'absolute', top: '50%', right: '5%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,80,120,0.3) 0%, transparent 70%)', filter: 'blur(45px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '30%', width: 400, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,30,200,0.5) 0%, transparent 70%)', filter: 'blur(60px)' }} />

        {/* Subtle sparkle dots */}
        {[
          { top: '15%', left: '8%', size: 3 }, { top: '22%', left: '75%', size: 2 },
          { top: '40%', left: '60%', size: 2 }, { top: '55%', left: '15%', size: 3 },
          { top: '30%', left: '45%', size: 2 }, { top: '68%', left: '80%', size: 2 },
          { top: '12%', left: '50%', size: 2 }, { top: '75%', left: '35%', size: 3 },
          { top: '20%', left: '30%', size: 2 }, { top: '60%', left: '55%', size: 2 },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', top: s.top, left: s.left,
            width: s.size, height: s.size, borderRadius: '50%',
            background: 'rgba(255,255,255,0.7)',
            boxShadow: '0 0 6px rgba(255,255,255,0.8)',
          }} />
        ))}
      </div>

      {/* Stage floor glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(to top, rgba(91,0,180,0.3) 0%, transparent 100%)',
      }} />

      {/* Dark vignette for text readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.6) 100%)',
      }} />

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 32,
        padding: '0 24px',
        width: '100%',
        maxWidth: 400,
      }}>
        {/* Logo / title */}
        <div style={{ textAlign: 'center' }}>
          {/* Guitar icon ring */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #5B8DFF, #A040FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, margin: '0 auto 20px',
            boxShadow: '0 0 40px rgba(91,141,255,0.5), 0 0 80px rgba(160,64,255,0.3)',
          }}>
            🎸
          </div>

          <h1 style={{
            fontSize: 56, fontWeight: 900, color: '#fff',
            margin: 0, letterSpacing: -1.5,
            textShadow: '0 0 40px rgba(160,64,255,0.6), 0 2px 20px rgba(0,0,0,0.5)',
          }}>
            MuZalkin
          </h1>
          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.6)',
            margin: '8px 0 0', letterSpacing: 2,
            textTransform: 'uppercase', fontWeight: 600,
          }}>
            Find Chords · Play Instantly
          </p>
        </div>

        {/* Start button */}
        <button
          onClick={() => navigate('/search')}
          style={{
            width: '100%',
            padding: '18px 0',
            fontSize: 18, fontWeight: 800, color: '#fff',
            background: 'linear-gradient(90deg, #5B8DFF 0%, #A040FF 100%)',
            border: 'none', borderRadius: 50, cursor: 'pointer',
            boxShadow: '0 0 30px rgba(91,141,255,0.6), 0 8px 32px rgba(0,0,0,0.4)',
            letterSpacing: 0.5,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
        >
          Start Playing 🎸
        </button>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0, textAlign: 'center' }}>
          Hebrew &amp; English chords · Guitar &amp; Piano
        </p>
      </div>
    </div>
  );
}
