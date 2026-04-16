import type { Song } from './types';

// Atmospheric concert-style gradients per index
const ARTWORKS = [
  'linear-gradient(135deg, #1a0a2e 0%, #6b1e6e 50%, #c0392b 100%)',
  'linear-gradient(135deg, #0a1a2e 0%, #1e3a6e 50%, #6b1ec0 100%)',
  'linear-gradient(135deg, #0a2e1a 0%, #1e6e3a 50%, #c0c01e 100%)',
  'linear-gradient(135deg, #2e0a0a 0%, #6e1e1e 50%, #c03a3a 100%)',
  'linear-gradient(135deg, #2e1a0a 0%, #6e3a1e 50%, #c06b1e 100%)',
  'linear-gradient(135deg, #1e0a2e 0%, #4a1e6e 50%, #9b1ec0 100%)',
];

const DIFFICULTY_STYLE: Record<string, { bg: string; color: string }> = {
  Beginner:     { bg: 'rgba(52,211,153,0.15)',  color: '#34d399' },
  Intermediate: { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
  Advanced:     { bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
};

const SOURCE_ICON: Record<string, string> = {
  tab4u:          '🎼',
  nagnu:          '🎵',
  'ultimate-guitar': '🎸',
};

// Loading skeleton
export function SongCardSkeleton() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 16,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        width: 50, height: 50, borderRadius: 14, flexShrink: 0,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200%',
        animation: 'shimmer 1.5s linear infinite',
      }} />
      <div style={{ flex: 1, gap: 8, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          height: 12, width: '65%', borderRadius: 6,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)',
          backgroundSize: '200%',
          animation: 'shimmer 1.5s linear infinite',
        }} />
        <div style={{
          height: 10, width: '40%', borderRadius: 6,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)',
          backgroundSize: '200%',
          animation: 'shimmer 1.5s linear infinite 0.15s',
        }} />
      </div>
    </div>
  );
}

interface SongCardProps {
  song: Song;
  index?: number;
  onSelect: (song: Song) => void;
  isLoading?: boolean;
  onAddToQueue?: (song: Song) => void;
  showQueueBtn?: boolean;
}

export default function SongCard({
  song, index = 0, onSelect, isLoading = false, onAddToQueue, showQueueBtn = false,
}: SongCardProps) {
  const artwork = ARTWORKS[index % ARTWORKS.length];
  const diff = song.difficulty ? DIFFICULTY_STYLE[song.difficulty] : null;
  const srcIcon = SOURCE_ICON[song.source] ?? '🎵';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        transition: 'background 0.2s, border-color 0.2s',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        animation: 'fadeInUp 0.25s ease both',
        animationDelay: `${index * 55}ms`,
      }}
      onClick={() => onSelect(song)}
    >
      {/* Artwork */}
      <div style={{
        width: 50,
        height: 50,
        borderRadius: 14,
        background: artwork,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Bokeh spots */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
        <span style={{ position: 'relative', zIndex: 1 }}>{srcIcon}</span>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {song.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{song.artist}</span>
          {song.source && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.07)',
              padding: '1px 7px',
              borderRadius: 20,
            }}>
              {song.source.replace('-', ' ')}
            </span>
          )}
        </div>
        {diff && (
          <span style={{
            display: 'inline-block',
            marginTop: 4,
            fontSize: 10,
            fontWeight: 700,
            color: diff.color,
            background: diff.bg,
            padding: '1px 8px',
            borderRadius: 20,
          }}>
            ● {song.difficulty}
          </span>
        )}
      </div>

      {/* Right side */}
      {showQueueBtn && onAddToQueue ? (
        <button
          onClick={e => { e.stopPropagation(); onAddToQueue(song); }}
          style={{
            flexShrink: 0,
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(91,141,255,0.15)',
            border: '1px solid rgba(91,141,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B8DFF" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      ) : isLoading ? (
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: '#5B8DFF',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0,
        }} />
      ) : (
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(255,107,157,0.8), rgba(160,64,255,0.8))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 10px rgba(160,64,255,0.3)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M9 18c-4.51 2-5-2-7-2V5l7 2m0 11V7m0 11c2.22.69 4.61.69 7 0M9 7c2.5-.5 5.5-.5 7 0m0 11V7" strokeWidth="1" stroke="rgba(255,255,255,0.3)" strokeLinecap="round" fill="none"/>
            <path d="M12 3v10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="13" r="3" fill="white" opacity="0.9"/>
          </svg>
        </div>
      )}
    </div>
  );
}
