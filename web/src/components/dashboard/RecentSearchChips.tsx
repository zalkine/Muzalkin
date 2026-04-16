import { useTranslation } from 'react-i18next';

interface RecentSearchChipsProps {
  searches: string[];
  onSelect: (q: string) => void;
  onClear: () => void;
}

export default function RecentSearchChips({ searches, onSelect, onClear }: RecentSearchChipsProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  if (searches.length === 0) return null;

  return (
    <div className="mt-4 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-white/30">
          🕐 {isRTL ? 'חיפושים אחרונים' : 'Recent'}
        </span>
        <button
          onClick={onClear}
          className="text-xs text-white/30 transition-colors hover:text-white/60"
        >
          {isRTL ? 'נקה' : 'Clear'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {searches.map(q => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5
                       px-3 py-1.5 text-xs text-white/60 transition-all
                       hover:border-accent/50 hover:bg-accent/10 hover:text-white
                       active:scale-95"
          >
            🔍 {q}
          </button>
        ))}
      </div>
    </div>
  );
}
