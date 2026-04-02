import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ChordDisplay from '../components/ChordDisplay';
import TransposeControls from '../components/TransposeControls';
import { transposeSong } from '../utils/chords';
import { mockSongs } from '../data/mockSongs';

export default function SongPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const song = mockSongs.find((s) => s.id === id);

  const [transpose, setTranspose] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [autoScroll, setAutoScroll] = useState(false);
  const scrollRef = useRef<number | null>(null);

  const displayData = useMemo(
    () => (song ? transposeSong(song.chordsData, transpose) : []),
    [song, transpose],
  );

  const scrollTick = useCallback(() => {
    window.scrollBy(0, 1);
    scrollRef.current = requestAnimationFrame(scrollTick);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      scrollRef.current = requestAnimationFrame(scrollTick);
    }
    return () => {
      if (scrollRef.current !== null) cancelAnimationFrame(scrollRef.current);
    };
  }, [autoScroll, scrollTick]);

  if (!song) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ fontSize: 18, color: 'var(--color-text-secondary)' }}>{t('no_results')}</p>
        <Link to="/" style={{ color: 'var(--color-accent)', marginTop: 12, display: 'inline-block' }}>
          ← {t('search')}
        </Link>
      </div>
    );
  }

  const isRTL = song.language === 'he';

  return (
    <div style={{ padding: '24px 0 80px', direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Back link */}
      <Link
        to="/"
        style={{
          color: 'var(--color-text-secondary)',
          fontSize: 14,
          display: 'inline-block',
          marginBottom: 16,
        }}
      >
        {isRTL ? '→ חזרה' : '← Back'}
      </Link>

      {/* Song header */}
      <div style={{ marginBottom: 16 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 4,
            fontFamily: isRTL ? 'var(--font-hebrew)' : 'var(--font-english)',
          }}
        >
          {song.title}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: 'var(--color-text-secondary)',
            fontFamily: isRTL ? 'var(--font-hebrew)' : 'var(--font-english)',
          }}
        >
          {song.artist}
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '8px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <TransposeControls
          transpose={transpose}
          onTransposeChange={setTranspose}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
        />
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          style={{
            background: autoScroll ? 'var(--color-accent)' : 'var(--color-surface-hover)',
            border: '1px solid var(--color-border)',
            color: autoScroll ? '#000' : 'var(--color-text)',
            padding: '6px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {t('auto_scroll')} {autoScroll ? '⏸' : '▶'}
        </button>
      </div>

      {/* Chord sheet */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '16px 24px',
        }}
      >
        <ChordDisplay chordsData={displayData} language={song.language} fontSize={fontSize} />
      </div>
    </div>
  );
}
