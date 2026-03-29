import { Route, Routes, useLocation } from 'react-router-dom';

import { SessionProvider } from './lib/SessionContext';
import { ThemeProvider }   from './lib/ThemeContext';
import AuthCallback   from './pages/AuthCallback';
import WelcomePage    from './pages/WelcomePage';
import SearchPage     from './pages/SearchPage';
import SongDetailPage from './pages/SongDetailPage';
import PlaylistsPage       from './pages/PlaylistsPage';
import PlaylistDetailPage  from './pages/PlaylistDetailPage';
import SettingsPage   from './pages/SettingsPage';
import LoginPage      from './pages/LoginPage';
import NavBar         from './components/NavBar';

import './styles/app.css';

function AppShell() {
  const location = useLocation();
  const showNav  = location.pathname !== '/';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Routes>
          <Route path="/"              element={<WelcomePage />} />
          <Route path="/search"        element={<SearchPage />} />
          <Route path="/song/:id"      element={<SongDetailPage />} />
          <Route path="/playlists"          element={<PlaylistsPage />} />
          <Route path="/playlist/:id"       element={<PlaylistDetailPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*"              element={<WelcomePage />} />
        </Routes>
      </div>
      {showNav && <NavBar />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AppShell />
      </SessionProvider>
    </ThemeProvider>
  );
}
