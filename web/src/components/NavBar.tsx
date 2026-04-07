import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/SessionContext';
import { useJam } from '../lib/jamContext';
import { signOut } from '../lib/supabase';

const NAV_ITEMS = [
  { to: '/search',    labelKey: 'search',    icon: '🔍' },
  { to: '/playlists', labelKey: 'playlists', icon: '🎵' },
  { to: '/settings',  labelKey: 'settings',  icon: '⚙️' },
];

export default function NavBar() {
  const { t, i18n } = useTranslation();
  const isRTL   = i18n.language === 'he';
  const session = useSession();
  const navigate = useNavigate();
  const jam      = useJam();

  const handleAuth = async () => {
    if (session) { await signOut(); } else { navigate('/login'); }
  };

  return (
    <nav style={{
      display: 'flex',
      flexDirection: isRTL ? 'row-reverse' : 'row',
      borderTop: '1px solid var(--border)',
      backgroundColor: 'var(--surface)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV_ITEMS.map(({ to, labelKey, icon }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 0 8px',
            gap: 3,
            color: isActive ? 'var(--accent)' : 'var(--text3)',
            fontSize: 11,
            fontWeight: isActive ? 700 : 400,
            textDecoration: 'none',
            position: 'relative',
            transition: 'color 0.15s',
          })}
        >
          {({ isActive }) => (
            <>
              <span style={{
                position: 'absolute',
                top: 0, left: '15%', right: '15%',
                height: 2, borderRadius: 2,
                background: isActive ? 'var(--accent)' : 'transparent',
                boxShadow: isActive ? '0 0 8px var(--accent-glow)' : 'none',
                transition: 'background 0.15s',
              }} />
              <span style={{
                fontSize: 22,
                filter: isActive ? 'drop-shadow(0 0 5px var(--accent-glow))' : 'none',
                transition: 'filter 0.15s',
              }}>
                {icon}
              </span>
              <span>{t(labelKey)}</span>
            </>
          )}
        </NavLink>
      ))}

      {/* Join Jam */}
      <NavLink
        to="/jam"
        style={({ isActive }) => ({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 0 8px',
          gap: 3,
          color: jam.sessionCode ? 'var(--accent)' : (isActive ? 'var(--accent)' : 'var(--text3)'),
          fontSize: 11,
          fontWeight: jam.sessionCode || isActive ? 700 : 400,
          textDecoration: 'none',
          position: 'relative',
          transition: 'color 0.15s',
        })}
      >
        {({ isActive }) => (
          <>
            <span style={{
              position: 'absolute',
              top: 0, left: '15%', right: '15%',
              height: 2, borderRadius: 2,
              background: (jam.sessionCode || isActive) ? 'var(--accent)' : 'transparent',
              boxShadow: (jam.sessionCode || isActive) ? '0 0 8px var(--accent-glow)' : 'none',
            }} />
            <span style={{
              fontSize: 22,
              animation: jam.sessionCode ? 'jam-pulse 1.4s ease-in-out infinite' : 'none',
              filter: (jam.sessionCode || isActive) ? 'drop-shadow(0 0 5px var(--accent-glow))' : 'none',
            }}>
              🎸
            </span>
            <span>{t('jam_nav')}</span>
          </>
        )}
      </NavLink>

      {/* Sign in / out */}
      <button
        onClick={handleAuth}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 0 8px',
          gap: 3,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text3)',
          fontSize: 11,
          position: 'relative',
        }}
      >
        <span style={{ fontSize: 22 }}>{session ? '👤' : '🔑'}</span>
        <span>{session ? t('sign_out') : t('sign_in_google')}</span>
      </button>
    </nav>
  );
}
