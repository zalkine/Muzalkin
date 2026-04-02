import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SongCard from '../components/SongCard';
import { mockSongs } from '../data/mockSongs';

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return mockSongs;
    const q = query.trim().toLowerCase();
    return mockSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q),
    );
  }, [query]);

  const hebrewSongs = filtered.filter((s) => s.language === 'he');
  const englishSongs = filtered.filter((s) => s.language === 'en');

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            marginBottom: 8,
            background: 'linear-gradient(135deg, var(--color-accent), var(--color-chord))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          MuZalkin
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 16 }}>
          {isRTL ? 'אקורדים לשירים בעברית ובאנגלית' : 'Chords for songs in Hebrew and English'}
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 32 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search') + '...'}
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{
            width: '100%',
            padding: '14px 20px',
            fontSize: 16,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            color: 'var(--color-text)',
            outline: 'none',
            fontFamily: isRTL ? 'var(--font-hebrew)' : 'var(--font-english)',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
        />
      </div>

      {/* Hebrew songs */}
      {hebrewSongs.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 12,
              color: 'var(--color-text-secondary)',
              direction: 'rtl',
              fontFamily: 'var(--font-hebrew)',
            }}
          >
            🇮🇱 שירים בעברית
          </h2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {hebrewSongs.map((song) => (
              <SongCard key={song.id} song={song} isRTL />
            ))}
          </div>
        </section>
      )}

      {/* English songs */}
      {englishSongs.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 12,
              color: 'var(--color-text-secondary)',
              direction: 'ltr',
              fontFamily: 'var(--font-english)',
            }}
          >
            🇬🇧 English Songs
          </h2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {englishSongs.map((song) => (
              <SongCard key={song.id} song={song} isRTL={false} />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 40 }}>
          {t('no_results')}
        </p>
      )}
    </div>
  );
}
