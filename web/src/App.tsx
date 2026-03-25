import { Route, Routes, Navigate } from 'react-router-dom';

import { SessionProvider } from './lib/SessionContext';
import AuthCallback   from './pages/AuthCallback';
import SearchPage     from './pages/SearchPage';
import SongDetailPage from './pages/SongDetailPage';
import PlaylistsPage  from './pages/PlaylistsPage';
import SettingsPage   from './pages/SettingsPage';
import LoginPage      from './pages/LoginPage';
import NavBar         from './components/NavBar';

import './styles/app.css';

export default function App() {
  return (
    <SessionProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            <Route path="/"              element={<Navigate to="/search" replace />} />
            <Route path="/search"        element={<SearchPage />} />
            <Route path="/song/:id"      element={<SongDetailPage />} />
            <Route path="/playlists"     element={<PlaylistsPage />} />
            <Route path="/settings"      element={<SettingsPage />} />
            <Route path="/login"         element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*"              element={<Navigate to="/search" replace />} />
          </Routes>
        </div>
        <NavBar />
      </div>
    </SessionProvider>
  );
}
