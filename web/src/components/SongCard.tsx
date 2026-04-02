import { Link } from 'react-router-dom';
import type { Song } from '../utils/chords';

interface SongCardProps {
  song: Song;
  isRTL: boolean;
}

export default function SongCard({ song, isRTL }: SongCardProps) {
  return (
    <Link
      to={`/song/${song.id}`}
      style={{
        display: 'block',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '16px 20px',
        textDecoration: 'none',
        transition: 'background 0.2s, border-color 0.2s',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-surface-hover)';
        e.currentTarget.style.borderColor = 'var(--color-accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--color-surface)';
        e.currentTarget.style.borderColor = 'var(--color-border)';
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--color-text)',
          marginBottom: 4,
          fontFamily: song.language === 'he' ? 'var(--font-hebrew)' : 'var(--font-english)',
        }}
      >
        {song.title}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          fontFamily: song.language === 'he' ? 'var(--font-hebrew)' : 'var(--font-english)',
        }}
      >
        {song.artist}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: 'var(--color-accent)',
          fontFamily: 'var(--font-english)',
        }}
      >
        {song.language === 'he' ? '🇮🇱 עברית' : '🇬🇧 English'}
      </div>
    </Link>
  );
}
