import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../lib/SessionContext';
import { supabase } from '../../lib/supabase';

// Order matches SwipeableMain PAGE_ORDER: Jam | Menu | Search | Tuner | Settings
// Plus Playlists and Connect/Disconnect which navigate to regular routes
const SWIPE_ITEMS = [
  {
    path: '/jam',
    label: 'Jam',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#5B8DFF' : 'rgba(255,255,255,0.4)'}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    path: '/menu',
    label: 'Menu',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#5B8DFF' : 'rgba(255,255,255,0.4)'}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    ),
  },
  {
    path: '/search',
    label: 'Search',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#5B8DFF' : 'rgba(255,255,255,0.4)'}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    path: '/tuner',
    label: 'Tuner',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#5B8DFF' : 'rgba(255,255,255,0.4)'}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="12" x2="15" y2="15"/>
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#5B8DFF' : 'rgba(255,255,255,0.4)'}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

function PlaylistsIcon({ active }: { active: boolean }) {
  const c = active ? '#5B8DFF' : 'rgba(255,255,255,0.4)';
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6"  x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="3" cy="6"  r="1.2" fill={c} stroke="none"/>
      <circle cx="3" cy="12" r="1.2" fill={c} stroke="none"/>
      <circle cx="3" cy="18" r="1.2" fill={c} stroke="none"/>
    </svg>
  );
}

function ConnectIcon({ active }: { active: boolean }) {
  const c = active ? '#5B8DFF' : 'rgba(255,255,255,0.4)';
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6"/>
      <path d="M10 14L21 3"/>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    </svg>
  );
}

function DisconnectIcon({ active }: { active: boolean }) {
  const c = active ? '#FF6B6B' : 'rgba(255,120,120,0.6)';
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

export default function BottomNav() {
  const location = useLocation();
  const navigate  = useNavigate();
  const session   = useSession();
  const isLoggedIn = !!session;

  const handleAuth = () => {
    if (isLoggedIn) {
      supabase.auth.signOut();
    } else {
      navigate('/login');
    }
  };

  return (
    <nav dir="ltr" style={{
      display: 'flex',
      background: 'rgba(12,12,26,0.97)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      backdropFilter: 'blur(20px)',
    }}>
      {SWIPE_ITEMS.map(({ path, label, icon }) => {
        const active = location.pathname === path ||
          (path === '/search' && (location.pathname === '/' || location.pathname === ''));
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '7px 0 6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? '#5B8DFF' : 'rgba(255,255,255,0.35)',
              fontSize: 9,
              fontWeight: active ? 700 : 500,
              letterSpacing: 0.3,
              transition: 'color 0.2s',
              position: 'relative',
            }}
          >
            {active && (
              <span style={{
                position: 'absolute', top: 0, left: '20%', right: '20%',
                height: 2, borderRadius: '0 0 2px 2px',
                background: '#5B8DFF', boxShadow: '0 0 8px rgba(91,141,255,0.7)',
              }} />
            )}
            {icon(active)}
            <span>{label}</span>
          </button>
        );
      })}

      {/* Playlists */}
      {(() => {
        const active = location.pathname === '/playlists' || location.pathname.startsWith('/playlist');
        return (
          <button
            onClick={() => navigate('/playlists')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '7px 0 6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? '#5B8DFF' : 'rgba(255,255,255,0.35)',
              fontSize: 9,
              fontWeight: active ? 700 : 500,
              letterSpacing: 0.3,
              transition: 'color 0.2s',
              position: 'relative',
            }}
          >
            {active && (
              <span style={{
                position: 'absolute', top: 0, left: '20%', right: '20%',
                height: 2, borderRadius: '0 0 2px 2px',
                background: '#5B8DFF', boxShadow: '0 0 8px rgba(91,141,255,0.7)',
              }} />
            )}
            <PlaylistsIcon active={active} />
            <span>Lists</span>
          </button>
        );
      })()}

      {/* Connect / Disconnect */}
      <button
        onClick={handleAuth}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          padding: '7px 0 6px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: isLoggedIn ? 'rgba(255,120,120,0.7)' : 'rgba(255,255,255,0.35)',
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: 0.3,
          transition: 'color 0.2s',
          position: 'relative',
        }}
      >
        {isLoggedIn
          ? <DisconnectIcon active={false} />
          : <ConnectIcon active={false} />
        }
        <span>{isLoggedIn ? 'Sign Out' : 'Connect'}</span>
      </button>
    </nav>
  );
}
