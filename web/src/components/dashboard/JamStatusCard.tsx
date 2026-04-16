import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { JamSession } from './types';

interface JamStatusCardProps {
  jam: JamSession;
}

export default function JamStatusCard({ jam }: JamStatusCardProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const navigate = useNavigate();

  if (!jam.active) return null;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="mx-4 mt-3 overflow-hidden rounded-2xl border border-accent/30 bg-accent/10 backdrop-blur-sm animate-fade-up"
      style={{ animationDelay: '50ms' }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Pulsing icon */}
        <div className="relative flex-shrink-0">
          <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center text-xl">
            🎸
          </div>
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-surface animate-jam-pulse" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">
            {isRTL ? 'ג\'אם פעיל' : 'Live Jam'}
            <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-mono text-white/80">
              {jam.code}
            </span>
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">
            {jam.currentSong}
          </p>
          <p className="text-xs text-white/50">
            {jam.participants} {isRTL ? 'מנגנים' : 'playing'}
          </p>
        </div>

        {/* Rejoin button */}
        <button
          onClick={() => navigate(`/jam/${jam.code}`)}
          className="flex-shrink-0 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-accent/30 transition-transform active:scale-95"
        >
          {isRTL ? 'חזור' : 'Rejoin'}
        </button>
      </div>
    </div>
  );
}
