import { useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { SessionProvider } from './lib/SessionContext';
import { ThemeProvider }   from './lib/ThemeContext';
import { JamProvider }     from './lib/jamContext';
import AuthCallback        from './pages/AuthCallback';
import WelcomePage         from './pages/WelcomePage';
import SearchPage          from './pages/SearchPage';
import SongDetailPage      from './pages/SongDetailPage';
import PlaylistsPage       from './pages/PlaylistsPage';
import PlaylistDetailPage  from './pages/PlaylistDetailPage';
import SettingsPage        from './pages/SettingsPage';
import LoginPage           from './pages/LoginPage';
import JoinJamPage         from './pages/JoinJamPage';
import TunerPage           from './pages/TunerPage';
import NavBar              from './components/NavBar';
import JamBanner           from './components/JamBanner';
import JamQueueDrawer      from './components/JamQueueDrawer';
import JamMemberList       from './components/JamMemberList';

import './styles/app.css';

function AppShell() {
  const location = useLocation();
  const showNav  = location.pathname !== '/';
  const isRTL    = document.documentElement.dir === 'rtl';

  const [isQueueOpen,   setIsQueueOpen]   = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  return (
    <div className="app-root">
      {/* Jam session status bar — visible whenever a session is active */}
      <JamBanner
        onOpenQueue={() => setIsQueueOpen(true)}
        onOpenMembers={() => setIsMembersOpen(true)}
        onLeft={() => { setIsQueueOpen(false); setIsMembersOpen(false); }}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Routes>
          <Route path="/"              element={<WelcomePage />} />
          <Route path="/search"        element={<SearchPage />} />
          <Route path="/song/:id"      element={<SongDetailPage />} />
          <Route path="/playlists"          element={<PlaylistsPage />} />
          <Route path="/playlist/:id"       element={<PlaylistDetailPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/jam/:code"     element={<JoinJamPage />} />
          <Route path="/jam"           element={<JoinJamPage />} />
          <Route path="/tuner"         element={<TunerPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*"              element={<WelcomePage />} />
        </Routes>
      </div>
      {showNav && <NavBar />}

      {/* Jam overlays */}
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
