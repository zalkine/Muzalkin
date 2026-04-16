import { Route, Routes, useLocation } from 'react-router-dom';

import { SessionProvider }  from './lib/SessionContext';
import { ThemeProvider }    from './lib/ThemeContext';
import { JamProvider }      from './lib/jamContext';
import AuthCallback         from './pages/AuthCallback';
import WelcomePage          from './pages/WelcomePage';
import SongDetailPage       from './pages/SongDetailPage';
import PlaylistsPage        from './pages/PlaylistsPage';
import PlaylistDetailPage   from './pages/PlaylistDetailPage';
import SettingsPage         from './pages/SettingsPage';
import LoginPage            from './pages/LoginPage';
import JoinJamPage          from './pages/JoinJamPage';
import SwipeableMain        from './components/SwipeableMain';
import JamBanner            from './components/JamBanner';
import BottomNav            from './components/dashboard/BottomNav';

import './styles/app.css';

// Pages handled by the swipeable 3-panel layout
const SWIPE_PATHS = new Set(['/search', '/menu', '/tuner']);

function AppShell() {
  const location = useLocation();
  const isWelcome  = location.pathname === '/';
  const isSwipeable = SWIPE_PATHS.has(location.pathname);

  return (
    <div className="app-root">
      {/* Jam banner only on non-welcome pages */}
      {!isWelcome && <JamBanner />}

      {isWelcome ? (
        /* ── Landing page ─────────────────────────────────────────────── */
        <WelcomePage />
      ) : isSwipeable ? (
        /* ── 3-panel swipeable layout (Search / Tile / Tuner) ─────────── */
        /* Wrapper must be flex:1 so SwipeableMain fills the remaining      *
         * height after JamBanner. key="swipe" prevents remounting when    *
         * navigating between the 3 swipeable routes.                      */
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SwipeableMain key="swipe" />
        </div>
      ) : (
        /* ── Regular routed pages ─────────────────────────────────────── */
        <>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Routes>
              <Route path="/song/:id"      element={<SongDetailPage />} />
              <Route path="/playlists"     element={<PlaylistsPage />} />
              <Route path="/playlist/:id"  element={<PlaylistDetailPage />} />
              <Route path="/settings"      element={<SettingsPage />} />
              <Route path="/login"         element={<LoginPage />} />
              <Route path="/jam/:code"     element={<JoinJamPage />} />
              <Route path="/jam"           element={<JoinJamPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="*"              element={<WelcomePage />} />
            </Routes>
          </div>
          <BottomNav />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <JamProvider>
          <AppShell />
        </JamProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
