import { useTranslation } from 'react-i18next';
import type { Song } from './types';

// ── Difficulty badge colour ──────────────────────────────────────────────────
const difficultyColor: Record<string, string> = {
  Beginner:     'bg-emerald-500/20 text-emerald-400',
  Intermediate: 'bg-amber-500/20 text-amber-400',
  Advanced:     'bg-red-500/20 text-red-400',
};

// ── Source icon ───────────────────────────────────────────────────────────────
function sourceIcon(source: string) {
  if (source.includes('tab4u'))          return '🎸';
  if (source.includes('ultimate-guitar')) return '🎵';
  if (source.includes('nagnu'))           return '🎼';
  return '🎵';
}

// ── Gradient accent per song index ───────────────────────────────────────────
const GRADIENTS = [
  'from-accent to-accent2',
  'from-purple-600 to-pink-500',
  'from-emerald-600 to-teal-500',
  'from-orange-600 to-amber-500',
  'from-rose-600 to-accent',
];

// ── Loading skeleton ──────────────────────────────────────────────────────────
export function SongCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
      <div
        className="h-11 w-11 flex-shrink-0 rounded-xl bg-shimmer bg-200%"
        style={{ animation: 'shimmer 1.5s linear infinite' }}
      />
      <div className="flex-1 space-y-2">
        <div
          className="h-3 w-3/4 rounded-full bg-shimmer bg-200%"
          style={{ animation: 'shimmer 1.5s linear infinite', animationDelay: '0.1s' }}
        />
        <div
          className="h-2.5 w-1/2 rounded-full bg-shimmer bg-200%"
          style={{ animation: 'shimmer 1.5s linear infinite', animationDelay: '0.2s' }}
        />
      </div>
    </div>
  );
}

// ── Song card ─────────────────────────────────────────────────────────────────
interface SongCardProps {
  song: Song;
  index?: number;
  onSelect: (song: Song) => void;
  isLoading?: boolean;
  onAddToQueue?: (song: Song) => void;
  showQueueBtn?: boolean;
}

export default function SongCard({
  song,
  index = 0,
  onSelect,
  isLoading = false,
  onAddToQueue,
  showQueueBtn = false,
}: SongCardProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const gradient = GRADIENTS[index % GRADIENTS.length];

  return (
    <div
      className="animate-fade-up flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3
                 transition-all hover:border-accent/20 hover:bg-white/8"
      style={{
        animationDelay: `${index * 50}ms`,
        background: 'rgba(255,255,255,0.04)',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Artwork square */}
      <div
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-xl shadow-md`}
      >
        {sourceIcon(song.source)}
      </div>

      {/* Info */}
      <button
        className="flex-1 min-w-0 text-start"
        onClick={() => onSelect(song)}
        disabled={isLoading}
      >
        <p className="truncate text-sm font-bold text-white">{song.title}</p>
        <p className="mt-0.5 truncate text-xs text-white/50">{song.artist}</p>
        {song.difficulty && (
          <span
            className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${difficultyColor[song.difficulty]}`}
          >
            {song.difficulty}
          </span>
        )}
      </button>

      {/* Queue add button */}
      {showQueueBtn && onAddToQueue && (
        <button
          onClick={e => { e.stopPropagation(); onAddToQueue(song); }}
          className="flex-shrink-0 rounded-xl border border-accent/30 bg-accent/10 p-2 text-accent
                     transition-all hover:bg-accent/20 active:scale-95"
          title="Add to queue"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Arrow */}
      {!showQueueBtn && (
        <button
          onClick={() => onSelect(song)}
          disabled={isLoading}
          className="flex-shrink-0 text-white/30 transition-colors hover:text-accent"
        >
          {isLoading
            ? <span className="inline-block h-4 w-4 rounded-full border-2 border-white/20 border-t-accent animate-spin-fast" />
            : <span className="text-lg">{isRTL ? '‹' : '›'}</span>
          }
        </button>
      )}
    </div>
  );
}
