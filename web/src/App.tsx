import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import SongPage from './pages/SongPage';

export default function App() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ fontFamily: isRTL ? 'var(--font-hebrew)' : 'var(--font-english)' }}>
      <Header />
      <main style={{ flex: 1, maxWidth: 900, margin: '0 auto', width: '100%', padding: '0 16px' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/song/:id" element={<SongPage />} />
        </Routes>
      </main>
    </div>
  );
}
