import { useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { SessionProvider }  from './lib/SessionContext';
import { ThemeProvider }    from './lib/ThemeContext';
import { JamProvider, useJam } from './lib/jamContext';
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
import JamQueueDrawer       from './components/JamQueueDrawer';
import JamMemberList        from './components/JamMemberList';
import JamSessionLayout     from './components/JamSessionLayout';
import BottomNav            from './components/dashboard/BottomNav';

import './styles/app.css';

// Pages handled by the swipeable 5-panel layout
const SWIPE_PATHS = new Set(['/jam', '/menu', '/search', '/tuner', '/settings']);

function AppShell() {
  const location = useLocation();
  const jam       = useJam();
  const isWelcome   = location.pathname === '/';
  const isSwipeable = SWIPE_PATHS.has(location.pathname);
  const isRTL       = document.documentElement.dir === 'rtl';

  const [isQueueOpen,   setIsQueueOpen]   = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  return (
    <div className="app-root">
      {/* Jam banner only on non-welcome pages and when no active session (session has its own header) */}
      {!isWelcome && !jam.sessionCode && (
        <JamBanner
          onOpenQueue={() => setIsQueueOpen(true)}
          onOpenMembers={() => setIsMembersOpen(true)}
          onLeft={() => { setIsQueueOpen(false); setIsMembersOpen(false); }}
        />
      )}

      {isWelcome ? (
        /* ── Landing page ─────────────────────────────────────────────── */
        <WelcomePage />
      ) : isSwipeable ? (
        /* ── 3-panel swipeable layout (Search / Tile / Tuner) ─────────── */
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
              <Route path="*"             element={<WelcomePage />} />
            </Routes>
          </div>
          <BottomNav />
        </>
      )}

      {/* Jam overlays for when no full-screen session is active */}
      {!jam.sessionCode && (
        <>
          <JamQueueDrawer
            isOpen={isQueueOpen}
            onClose={() => setIsQueueOpen(false)}
            isRTL={isRTL}
          />
          <JamMemberList
            isOpen={isMembersOpen}
            onClose={() => setIsMembersOpen(false)}
            isRTL={isRTL}
          />
        </>
      )}

      {/* Full-screen jam session overlay — covers everything when session is active */}
      {jam.sessionCode && <JamSessionLayout />}
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
