import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  isLoading: boolean;
}

export default function SearchBar({ value, onChange, onSearch, isLoading }: SearchBarProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch();
  };

  return (
    <div className="mx-4 mt-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div
        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 backdrop-blur-sm
                   focus-within:border-accent/60 focus-within:bg-white/8 transition-colors"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <span className="flex-shrink-0 text-lg text-white/40">
          {isLoading ? (
            <span className="inline-block h-5 w-5 rounded-full border-2 border-white/20 border-t-accent animate-spin-fast" />
          ) : '🔍'}
        </span>

        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('search_placeholder') || 'Search songs or artists…'}
          dir={isRTL ? 'rtl' : 'ltr'}
          className="h-12 flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        />

        {value.trim() && (
          <button
            onClick={onSearch}
            disabled={isLoading}
            className="flex-shrink-0 rounded-xl bg-accent px-4 py-1.5 text-xs font-bold text-white
                       shadow-md shadow-accent/30 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? '…' : t('search')}
          </button>
        )}
      </div>
    </div>
  );
}
