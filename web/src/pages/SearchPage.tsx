import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// A search result may come from the cache (has id) or from a live scrape (has source_url).
type SearchResult = {
  id?: string;
  song_title: string;
  artist: string;
  source: string;
  source_url?: string;
  language?: string;
};

type Status = 'idle' | 'loading' | 'done' | 'error';

const BACKEND_URL = '';

export default function SearchPage() {
  const { t, i18n } = useTranslation();
  const navigate    = useNavigate();
  const isRTL       = i18n.language === 'he';

  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState<SearchResult[]>([]);
  const [status,     setStatus]     = useState<Status>('idle');
  const [fetchingId, setFetchingId] = useState<string | null>(null); // source_url being fetched
  const [searchLang, setSearchLang] = useState<'he' | 'en'>('he'); // language of last search query
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setStatus('loading');
    setResults([]);
    try {
      // Detect language from the query text itself, not the UI language:
      // if the query contains Hebrew characters → search Hebrew sources, else English.
      const lang = /[\u0590-\u05FF]/.test(q) ? 'he' : 'en';
      setSearchLang(lang);
      const url  = `${BACKEND_URL}/api/chords/search?q=${encodeURIComponent(q)}&lang=${lang}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Backend ${resp.status}`);
      const data: SearchResult[] = await resp.json();
      setResults(data);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, [query, i18n.language]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // When user selects a result: if it's already cached (has id), navigate directly.
  // Otherwise call /fetch to scrape+cache it, then navigate.
  const handleSelect = useCallback(async (item: SearchResult) => {
    if (item.id) {
      navigate(`/song/${item.id}`);
      return;
    }
    if (!item.source_url) return;

    setFetchingId(item.source_url);
    try {
      // Use the language detected from the search query, not the UI language.
      // This ensures English songs are stored with language='en' even when
      // the user's UI language is Hebrew.
      const lang = item.language ?? searchLang;
      const resp = await fetch(`${BACKEND_URL}/api/chords/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:    item.source_url,
          title:  item.song_title,
          artist: item.artist,
          source: item.source,
          lang,
        }),
      });
      if (!resp.ok) throw new Error(`Fetch failed ${resp.status}`);
      const row = await resp.json();
      navigate(`/song/${row.id}`);
    } catch {
      alert(t('error_fetch'));
    } finally {
      setFetchingId(null);
    }
  }, [navigate, i18n.language, t]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg)' }}>

      {/* Search bar */}
      <div style={{
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        padding: '12px 16px',
        gap: 8,
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg)',
      }}>
        <input
          ref={inputRef}
          type="search"
          placeholder={t('search_placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{
            flex: 1,
            height: 44,
            border: '1px solid var(--border)',
            borderRadius: 8,
            paddingInline: 12,
            fontSize: 16,
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text)',
            outline: 'none',
            textAlign: isRTL ? 'right' : 'left',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || status === 'loading'}
          style={{
            height: 44,
            paddingInline: 18,
            backgroundColor: (!query.trim() || status === 'loading') ? '#aaa' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: (!query.trim() || status === 'loading') ? 'default' : 'pointer',
          }}
        >
          {t('search')}
        </button>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {status === 'idle' && (
          <div style={centerStyle}>
            <p style={{ color: 'var(--text3)', fontSize: 15, textAlign: 'center', direction: isRTL ? 'rtl' : 'ltr' }}>
              {t('search_hint')}
            </p>
          </div>
        )}

        {status === 'loading' && (
          <div style={centerStyle}>
            <div style={spinnerStyle} />
            <p style={{ color: 'var(--text3)', fontSize: 14 }}>{t('loading')}</p>
          </div>
        )}

        {status === 'error' && (
          <div style={centerStyle}>
            <p style={{ color: '#cc3333', fontSize: 15 }}>{t('error_fetch')}</p>
            <button
              onClick={handleSearch}
              style={{ color: 'var(--accent)', background: 'none', border: 'none', fontSize: 14, fontWeight: 600 }}
            >
              {t('retry')}
            </button>
          </div>
        )}

        {status === 'done' && results.length === 0 && (
          <div style={centerStyle}>
            <p style={{ color: 'var(--text3)', fontSize: 15 }}>{t('no_results')}</p>
          </div>
        )}

        {status === 'done' && results.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 16px 0', direction: isRTL ? 'rtl' : 'ltr' }}>
              {results.length} {t('results_found') ?? 'results'}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {results.map((item, idx) => {
                const key    = item.id ?? item.source_url ?? `${idx}`;
                const isBusy = fetchingId === item.source_url;
                return (
                  <li key={key}>
                    <button
                      onClick={() => handleSelect(item)}
                      disabled={fetchingId !== null}
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        padding: '14px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: idx < results.length - 1 ? '1px solid var(--border2)' : 'none',
                        textAlign: isRTL ? 'right' : 'left',
                        cursor: fetchingId !== null ? 'wait' : 'pointer',
                        opacity: fetchingId !== null && !isBusy ? 0.5 : 1,
                      }}
                    >
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                          {item.song_title}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item.artist}</span>
                      </div>
                      {isBusy
                        ? <div style={{ ...miniSpinnerStyle }} />
                        : <span style={{ fontSize: 18, color: 'var(--text3)' }}>{isRTL ? '‹' : '›'}</span>
                      }
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '60vh',
  gap: 12,
  padding: 32,
};

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: '3px solid var(--border)',
  borderTopColor: 'var(--accent)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const miniSpinnerStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  border: '2px solid var(--border)',
  borderTopColor: 'var(--accent)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
  flexShrink: 0,
};
