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
  const isRTL  = i18n.language === 'he';
  const session = useSession();
  const navigate = useNavigate();
  const jam      = useJam();

  const handleAuth = async () => {
    if (session) {
      await signOut();
    } else {
      navigate('/login');
    }
  };

  return (
    <nav style={{
      display: 'flex',
      flexDirection: isRTL ? 'row-reverse' : 'row',
      borderTop: '1px solid var(--border)',
      backgroundColor: 'var(--bg)',
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
            padding: '10px 0',
            gap: 3,
            color: isActive ? 'var(--accent)' : 'var(--text3)',
            fontSize: 11,
            fontWeight: isActive ? 700 : 400,
            borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
          })}
        >
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span>{t(labelKey)}</span>
        </NavLink>
      ))}

      {/* Join Jam — pulsing icon when a session is active */}
      <NavLink
        to="/jam"
        style={({ isActive }) => ({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 0',
          gap: 3,
          color: jam.sessionCode ? 'var(--accent)' : (isActive ? 'var(--accent)' : 'var(--text3)'),
          fontSize: 11,
          fontWeight: jam.sessionCode || isActive ? 700 : 400,
          borderTop: (jam.sessionCode || isActive) ? '2px solid var(--accent)' : '2px solid transparent',
          textDecoration: 'none',
        })}
      >
        <span style={{ fontSize: 20, animation: jam.sessionCode ? 'jam-pulse 1.4s ease-in-out infinite' : 'none' }}>
          🎸
        </span>
        <span>{t('jam_nav')}</span>
      </NavLink>

      {/* Sign in / Sign out */}
      <button
        onClick={handleAuth}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 0',
          gap: 3,
          background: 'none',
          border: 'none',
          borderTop: '2px solid transparent',
          cursor: 'pointer',
          color: 'var(--text3)',
          fontSize: 11,
        }}
      >
        <span style={{ fontSize: 20 }}>{session ? '👤' : '🔑'}</span>
        <span>{session ? t('sign_out') : t('sign_in_google')}</span>
      </button>
    </nav>
  );
}
