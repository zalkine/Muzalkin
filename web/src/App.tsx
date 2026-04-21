import { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { SessionProvider } from './lib/SessionContext';
import { ThemeProvider }   from './lib/ThemeContext';
import { JamProvider, useJam } from './lib/jamContext';
import AuthCallback        from './pages/AuthCallback';
import WelcomePage         from './pages/WelcomePage';
import SearchPage          from './pages/SearchPage';
import SongDetailPage      from './pages/SongDetailPage';
import PlaylistsPage       from './pages/PlaylistsPage';
import PlaylistDetailPage  from './pages/PlaylistDetailPage';
import SettingsPage        from './pages/SettingsPage';
import LoginPage           from './pages/LoginPage';
import JoinJamPage         from './pages/JoinJamPage';
import JamPage             from './pages/JamPage';
import TunerPage           from './pages/TunerPage';
import NavBar              from './components/NavBar';
import JamBanner           from './components/JamBanner';
import JamQueueDrawer      from './components/JamQueueDrawer';
import JamMemberList       from './components/JamMemberList';

import './styles/app.css';

function AppShell() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const showNav   = location.pathname !== '/';
  const isRTL     = document.documentElement.dir === 'rtl';
  const isJamPage = location.pathname === '/jam';
  const isSongPage = location.pathname.startsWith('/song/');
  const jam       = useJam();

  const [isQueueOpen,   setIsQueueOpen]   = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  // Route guard: jamembers in session can only access /jam and /song/:id
  useEffect(() => {
    if (!jam.sessionCode || jam.role !== 'jamember') return;
    const restricted = ['/search', '/playlists', '/settings', '/tuner', '/login'];
    if (restricted.some(r => location.pathname.startsWith(r))) {
      navigate('/jam', { replace: true });
    }
  }, [jam.sessionCode, jam.role, location.pathname, navigate]);

  // Global song-change follower: ALL users in a session follow song changes.
  // This fires for non-leads receiving broadcasts AND for the lead calling selectSong/playNext.
  useEffect(() => {
    if (!jam.sessionCode) return;
    return jam.onSongChange((ref) => {
      if (!ref.songId) {
        navigate('/jam', { replace: true });
      } else {
        navigate(`/song/${ref.songId}`, { replace: true });
      }
    });
  }, [jam.sessionCode, navigate, jam]);

  return (
    <div className="app-root">
      {/* Orange session frame — fixed overlay, pointer-events: none so it doesn't block clicks */}
      {jam.sessionCode && (
        <div style={{
          position: 'fixed', inset: 0,
          border: '4px solid var(--accent)',
          pointerEvents: 'none',
          zIndex: 9999,
          boxSizing: 'border-box',
        }} />
      )}
      {/* Jam session status bar — hidden on /jam and on song pages (song header acts as jam bar there) */}
      {!isJamPage && !(jam.sessionCode && isSongPage) && (
        <JamBanner
          onOpenQueue={() => setIsQueueOpen(true)}
          onOpenMembers={() => setIsMembersOpen(true)}
          onLeft={() => { setIsQueueOpen(false); setIsMembersOpen(false); }}
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Routes>
          <Route path="/"              element={<WelcomePage />} />
          <Route path="/search"        element={<SearchPage />} />
          <Route path="/song/:id"      element={<SongDetailPage />} />
          <Route path="/playlists"          element={<PlaylistsPage />} />
          <Route path="/playlist/:id"       element={<PlaylistDetailPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/tuner"         element={<TunerPage />} />
          <Route path="/jam/:code"     element={<JoinJamPage />} />
          <Route path="/jam"           element={<JamPage />} />
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
