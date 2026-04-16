import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSession } from '../../lib/SessionContext';
import { useJam } from '../../lib/jamContext';
import { signOut } from '../../lib/supabase';

const NAV_ITEMS = [
  { to: '/search',    labelKey: 'search',    icon: '🔍' },
  { to: '/playlists', labelKey: 'playlists', icon: '🎵' },
  { to: '/settings',  labelKey: 'settings',  icon: '⚙️' },
];

export default function BottomNav() {
  const { t, i18n } = useTranslation();
  const isRTL   = i18n.language === 'he';
  const session = useSession();
  const navigate = useNavigate();
  const jam      = useJam();

  const handleAuth = async () => {
    if (session) { await signOut(); } else { navigate('/login'); }
  };

  return (
    <nav
      dir={isRTL ? 'rtl' : 'ltr'}
      className="flex border-t border-white/8 bg-surface/80 backdrop-blur-xl"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        borderColor: 'rgba(255,255,255,0.06)',
        background: 'rgba(18,18,42,0.9)',
      }}
    >
      {NAV_ITEMS.map(({ to, labelKey, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5
             text-[10px] font-semibold transition-colors
             ${isActive ? 'text-accent' : 'text-white/35 hover:text-white/60'}`
          }
        >
          {({ isActive }) => (
            <>
              {/* Top indicator bar */}
              <span
                className={`absolute top-0 inset-x-[20%] h-0.5 rounded-b-full transition-colors
                  ${isActive ? 'bg-accent shadow-[0_0_8px_rgba(91,141,255,0.6)]' : 'bg-transparent'}`}
              />
              <span
                className={`text-xl transition-all ${isActive ? 'drop-shadow-[0_0_6px_rgba(91,141,255,0.6)]' : ''}`}
              >
                {icon}
              </span>
              <span>{t(labelKey)}</span>
            </>
          )}
        </NavLink>
      ))}

      {/* Jam nav */}
      <NavLink
        to="/jam"
        className={({ isActive }) =>
          `relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5
           text-[10px] font-semibold transition-colors
           ${jam.sessionCode || isActive ? 'text-accent' : 'text-white/35 hover:text-white/60'}`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={`absolute top-0 inset-x-[20%] h-0.5 rounded-b-full transition-colors
                ${jam.sessionCode || isActive ? 'bg-accent shadow-[0_0_8px_rgba(91,141,255,0.6)]' : 'bg-transparent'}`}
            />
            <span
              className={`text-xl ${jam.sessionCode ? 'animate-jam-pulse' : ''}`}
            >
              🎸
            </span>
            <span>{t('jam_nav')}</span>
          </>
        )}
      </NavLink>

      {/* Auth button */}
      <button
        onClick={handleAuth}
        className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5
                   text-[10px] font-semibold text-white/35 transition-colors hover:text-white/60"
      >
        <span className="text-xl">{session ? '👤' : '🔑'}</span>
        <span>{session ? t('sign_out') : t('sign_in_google')}</span>
      </button>
    </nav>
  );
}
