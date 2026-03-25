import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/SessionContext';
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
      borderTop: '1px solid #e0e0e0',
      backgroundColor: '#fff',
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
            color: isActive ? '#4285F4' : '#888',
            fontSize: 11,
            fontWeight: isActive ? 700 : 400,
            borderTop: isActive ? '2px solid #4285F4' : '2px solid transparent',
          })}
        >
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span>{t(labelKey)}</span>
        </NavLink>
      ))}

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
          color: '#888',
          fontSize: 11,
        }}
      >
        <span style={{ fontSize: 20 }}>{session ? '👤' : '🔑'}</span>
        <span>{session ? t('sign_out') : t('sign_in_google')}</span>
      </button>
    </nav>
  );
}
