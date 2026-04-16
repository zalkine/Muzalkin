import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/SessionContext';
import { useJam } from '../lib/jamContext';

type Tile = {
  icon: string;
  label: string;
  gradient: string;
  action: () => void;
};

export default function TilePage() {
  const navigate = useNavigate();
  const session  = useSession();
  const jam      = useJam();

  const userName = session?.user?.user_metadata?.full_name ?? session?.user?.email?.split('@')[0] ?? null;
  const avatarLetter = userName?.[0]?.toUpperCase() ?? '?';

  // Build tile grid — 3 columns × 3 rows
  const tiles: Tile[] = [
    {
      icon: '🎵',
      label: 'Continue\nPlaying',
      gradient: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)',
      action: () => navigate('/search'),
    },
    {
      icon: '📋',
      label: 'My\nPlaylists',
      gradient: 'linear-gradient(135deg, #6c3483 0%, #4a235a 100%)',
      action: () => navigate('/playlists'),
    },
    {
      icon: '❤️',
      label: 'Favorites',
      gradient: 'linear-gradient(135deg, #c0392b 0%, #8e1e6e 100%)',
      action: () => navigate('/playlists'),
    },
    {
      icon: '🎸',
      label: 'Start\nJam',
      gradient: 'linear-gradient(135deg, #c0392b 0%, #7d1a1a 100%)',
      action: () => navigate('/jam'),
    },
    {
      icon: '🔑',
      label: 'Join\nJam',
      gradient: 'linear-gradient(135deg, #148f77 0%, #0e6655 100%)',
      action: () => navigate('/jam'),
    },
    {
      icon: '🎶',
      label: 'Jam\nSessions',
      gradient: 'linear-gradient(135deg, #1f618d 0%, #154360 100%)',
      action: () => navigate('/jam'),
    },
    {
      icon: '🕐',
      label: 'Recent\nSongs',
      gradient: 'linear-gradient(135deg, #148f77 0%, #0b5345 100%)',
      action: () => navigate('/search'),
    },
    {
      icon: '🎙️',
      label: 'Tuner',
      gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      action: () => navigate('/tuner'),
    },
    {
      icon: '⚙️',
      label: 'Settings',
      gradient: 'linear-gradient(135deg, #1c2833 0%, #0e1a24 100%)',
      action: () => navigate('/settings'),
    },
  ];

  return (
    <div style={{ minHeight: '100%', background: '#0c0c1a', padding: '0 0 40px' }}>

      {/* ── Profile header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '48px 20px 20px',
        background: `
          radial-gradient(ellipse at 80% 20%, rgba(180,60,220,0.25) 0%, transparent 50%),
          radial-gradient(ellipse at 20% 70%, rgba(91,141,255,0.2) 0%, transparent 50%),
          #0c0c1a
        `,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          {/* Avatar */}
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #5B8DFF, #A040FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 20px rgba(91,141,255,0.4)',
            flexShrink: 0,
          }}>
            {session ? avatarLetter : '👤'}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>
              {userName ?? 'Profile'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {session?.user?.email ?? 'Sign in to save your songs'}
            </p>
          </div>
        </div>

        {/* User name row */}
        {userName && (
          <button
            onClick={() => navigate('/settings')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 14,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{userName}</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── 3×3 Tile grid ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        padding: '8px 20px 0',
      }}>
        {tiles.map((tile, i) => (
          <button
            key={i}
            onClick={tile.action}
            style={{
              borderRadius: 20,
              border: 'none',
              background: tile.gradient,
              padding: '18px 12px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              aspectRatio: '1',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              animation: 'fadeInUp 0.3s ease both',
              animationDelay: `${i * 60}ms`,
            }}
          >
            {/* Subtle shine overlay */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, transparent 100%)',
              borderRadius: '20px 20px 0 0',
              pointerEvents: 'none',
            }} />

            {/* Icon */}
            <div style={{ fontSize: 30, position: 'relative', zIndex: 1, lineHeight: 1 }}>
              {tile.icon}
            </div>

            {/* Label */}
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              textAlign: 'center',
              lineHeight: 1.3,
              position: 'relative',
              zIndex: 1,
              whiteSpace: 'pre-line',
            }}>
              {tile.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
