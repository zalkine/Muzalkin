import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../lib/SessionContext';
import { supabase } from '../../lib/supabase';

// Nav order: Menu | Jam | Playlists | Search | Tuner | Connect/Sign Out | Settings
// Swipeable panels (SwipeableMain PAGE_ORDER) follow the same order for Menu/Jam/Search/Tuner/Settings

type NavItem = {
  id: string;
  label: string;
  path?: string;
  isActive?: (pathname: string) => boolean;
  icon: (active: boolean) => React.ReactNode;
};

const S = (active: boolean) => active ? '#5B8DFF' : 'rgba(255,255,255,0.4)';

const BASE_ITEMS: NavItem[] = [
  {
    id: 'menu',
    path: '/menu',
    label: 'Menu',
    icon: (a) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={S(a)} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    ),
  },
  {
    id: 'jam',
    path: '/jam',
    label: 'Jam',
    icon: (a) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={S(a)} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: 'playlists',
    path: '/playlists',
    label: 'Lists',
    isActive: (p) => p === '/playlists' || p.startsWith('/playlist/'),
    icon: (a) => {
      const c = S(a);
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
    },
  },
  {
    id: 'search',
    path: '/search',
    label: 'Search',
    isActive: (p) => p === '/search' || p === '/' || p === '',
    icon: (a) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={S(a)} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    id: 'tuner',
    path: '/tuner',
    label: 'Tuner',
    icon: (a) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={S(a)} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="12" x2="15" y2="15"/>
      </svg>
    ),
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: (a) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={S(a)} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const session   = useSession();
  const isLoggedIn = !!session;

  const authColor = isLoggedIn ? 'rgba(255,120,120,0.7)' : 'rgba(255,255,255,0.35)';

  const AuthIcon = () => isLoggedIn ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,120,120,0.6)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,0.4)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6"/>
      <path d="M10 14L21 3"/>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    </svg>
  );

  const btnStyle = (active: boolean, color?: string): React.CSSProperties => ({
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
    color: color ?? (active ? '#5B8DFF' : 'rgba(255,255,255,0.35)'),
    fontSize: 9,
    fontWeight: active ? 700 : 500,
    letterSpacing: 0.3,
    transition: 'color 0.2s',
    position: 'relative',
  });

  const Indicator = () => (
    <span style={{
      position: 'absolute', top: 0, left: '20%', right: '20%',
      height: 2, borderRadius: '0 0 2px 2px',
      background: '#5B8DFF', boxShadow: '0 0 8px rgba(91,141,255,0.7)',
    }} />
  );

  // Inject auth item between Tuner and Settings
  const allItems = [
    ...BASE_ITEMS.slice(0, 5),   // Menu | Jam | Playlists | Search | Tuner
    { id: 'auth' },               // Connect / Sign Out
    BASE_ITEMS[5],                // Settings
  ];

  return (
    <nav dir="ltr" style={{
      display: 'flex',
      background: 'rgba(12,12,26,0.97)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      backdropFilter: 'blur(20px)',
    }}>
      {allItems.map((item) => {
        if (item.id === 'auth') {
          return (
            <button key="auth"
              onClick={() => isLoggedIn ? supabase.auth.signOut() : navigate('/login')}
              style={btnStyle(false, authColor)}
            >
              <AuthIcon />
              <span>{isLoggedIn ? 'Sign Out' : 'Connect'}</span>
            </button>
          );
        }
        const { id, path, label, icon, isActive } = item as NavItem;
        const active = isActive ? isActive(location.pathname) : location.pathname === path;
        return (
          <button key={id}
            onClick={() => path && navigate(path)}
            style={btnStyle(active)}
          >
            {active && <Indicator />}
            {icon(active)}
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
