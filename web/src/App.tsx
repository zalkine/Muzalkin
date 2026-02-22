import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import LoginPage      from './pages/LoginPage';
import AuthCallback   from './pages/AuthCallback';
import SearchPage     from './pages/SearchPage';
import SongDetailPage from './pages/SongDetailPage';
import PlaylistsPage  from './pages/PlaylistsPage';
import SettingsPage   from './pages/SettingsPage';
import NavBar         from './components/NavBar';

import './styles/app.css';

export default function App() {
  const [session,  setSession]  = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span style={{ color: '#888', fontSize: 16 }}>טוען…</span>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Routes>
          <Route path="/"              element={<Navigate to="/search" replace />} />
          <Route path="/search"        element={<SearchPage />} />
          <Route path="/song/:id"      element={<SongDetailPage />} />
          <Route path="/playlists"     element={<PlaylistsPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*"              element={<Navigate to="/search" replace />} />
        </Routes>
      </div>
      <NavBar />
    </div>
  );
}
