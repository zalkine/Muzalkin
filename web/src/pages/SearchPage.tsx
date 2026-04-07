import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
const RECENT_KEY  = 'muzalkin_recent_searches';
const MAX_RECENT  = 8;

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function saveRecent(query: string) {
  const prev = loadRecent().filter(q => q !== query);
  localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...prev].slice(0, MAX_RECENT)));
}

export default function SearchPage() {
  const { t, i18n } = useTranslation();
  const navigate    = useNavigate();
  const isRTL       = i18n.language === 'he';

  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState<SearchResult[]>([]);
  const [status,     setStatus]     = useState<Status>('idle');
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [searchLang, setSearchLang] = useState<'he' | 'en'>('he');
  const [recent,     setRecent]     = useState<string[]>(() => loadRecent());
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep recent list in sync when coming back to this page
  useEffect(() => { setRecent(loadRecent()); }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setStatus('loading');
    setResults([]);

    try {
      const lang = /[\u0590-\u05FF]/.test(trimmed) ? 'he' : 'en';
      setSearchLang(lang);
      const url  = `${BACKEND_URL}/api/chords/search?q=${encodeURIComponent(trimmed)}&lang=${lang}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Backend ${resp.status}`);
      const data: SearchResult[] = await resp.json();
      setResults(data);
      setStatus('done');
      saveRecent(trimmed);
      setRecent(loadRecent());
    } catch {
      setStatus('error');
    }
  }, []);

  const handleSearch = useCallback(() => runSearch(query), [query, runSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSelect = useCallback(async (item: SearchResult) => {
    if (item.id) { navigate(`/song/${item.id}`); return; }
    if (!item.source_url) return;

    setFetchingId(item.source_url);
    try {
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
      if (row.id) {
        navigate(`/song/${row.id}`);
      } else {
        navigate(`/song/_preview`, { state: { song: row } });
      }
    } catch {
      alert(t('error_fetch'));
    } finally {
      setFetchingId(null);
    }
  }, [navigate, searchLang, t]);

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg)' }}>

      {/* ── Hero header ── */}
      <div className="search-hero">
        <h1 style={{
          margin: '0 0 4px',
          fontSize: 28,
          fontWeight: 900,
          color: '#fff',
          letterSpacing: -0.5,
        }}>
          Play with MuZalkin
        </h1>
        <p style={{
          margin: '0 0 20px',
          fontSize: 14,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: 0.5,
        }}>
          Find chords. Play instantly.
        </p>

        {/* Search bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 50,
          padding: '0 6px 0 18px',
          gap: 8,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          maxWidth: 520,
          margin: '0 auto',
        }}>
          <span style={{ fontSize: 18, opacity: 0.6, flexShrink: 0 }}>🔍</span>
          <input
            ref={inputRef}
            type="search"
            placeholder={t('search_placeholder') || 'Search songs or artists…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            dir={isRTL ? 'rtl' : 'ltr'}
            style={{
              flex: 1,
              height: 50,
              border: 'none',
              background: 'transparent',
              fontSize: 16,
              color: '#fff',
              outline: 'none',
              textAlign: isRTL ? 'right' : 'left',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || status === 'loading'}
            style={{
              height: 38,
              paddingInline: 20,
              background: (!query.trim() || status === 'loading')
                ? 'rgba(255,255,255,0.15)'
                : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              fontSize: 14,
              fontWeight: 700,
              cursor: (!query.trim() || status === 'loading') ? 'default' : 'pointer',
              flexShrink: 0,
              transition: 'background 0.2s',
              boxShadow: (!query.trim() || status === 'loading')
                ? 'none'
                : '0 0 16px var(--accent-glow)',
            }}
          >
            {status === 'loading' ? '…' : t('search')}
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Idle state — recent searches */}
        {status === 'idle' && (
          <div style={{ padding: '20px 16px' }}>
            {recent.length > 0 ? (
              <>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    🕐 Recent searches
                  </span>
                  <button
                    onClick={clearRecent}
                    style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {recent.map(q => (
                    <button
                      key={q}
                      className="search-chip"
                      onClick={() => runSearch(q)}
                    >
                      🔍 {q}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', paddingTop: 48 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🎸</div>
                <p style={{ color: 'var(--text3)', fontSize: 15, margin: 0 }}>
                  {t('search_hint')}
                </p>
              </div>
            )}
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
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <p style={{ color: '#cc3333', fontSize: 15 }}>{t('error_fetch')}</p>
            <button
              onClick={handleSearch}
              style={{ color: 'var(--accent)', background: 'none', border: 'none', fontSize: 14, fontWeight: 600, marginTop: 4 }}
            >
              {t('retry')}
            </button>
          </div>
        )}

        {status === 'done' && results.length === 0 && (
          <div style={centerStyle}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎵</div>
            <p style={{ color: 'var(--text3)', fontSize: 15 }}>{t('no_results')}</p>
          </div>
        )}

        {status === 'done' && results.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: 'var(--text3)', padding: '10px 16px 4px', direction: isRTL ? 'rtl' : 'ltr', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {results.length} {t('results_found') ?? 'results'}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {results.map((item, idx) => {
                const key    = item.id ?? item.source_url ?? `${idx}`;
                const isBusy = fetchingId === item.source_url;
                return (
                  <li key={key} style={{ animationDelay: `${idx * 40}ms` }}>
                    <button
                      className="song-card"
                      onClick={() => handleSelect(item)}
                      disabled={fetchingId !== null}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        textAlign: isRTL ? 'right' : 'left',
                        cursor: fetchingId !== null ? 'wait' : 'pointer',
                        opacity: fetchingId !== null && !isBusy ? 0.5 : 1,
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: `linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        flexShrink: 0,
                        marginInlineEnd: 12,
                        boxShadow: '0 2px 8px rgba(91,141,255,0.3)',
                      }}>
                        🎵
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', direction: isRTL ? 'rtl' : 'ltr', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.song_title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, direction: isRTL ? 'rtl' : 'ltr' }}>
                          {item.artist}
                        </div>
                      </div>

                      {/* Arrow / spinner */}
                      {isBusy
                        ? <div style={miniSpinnerStyle} />
                        : (
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            color: 'var(--accent)',
                            flexShrink: 0,
                            marginInlineStart: 8,
                          }}>
                            {isRTL ? '‹' : '›'}
                          </div>
                        )
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
  height: '50vh',
  gap: 8,
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
  width: 20,
  height: 20,
  border: '2px solid var(--border)',
  borderTopColor: 'var(--accent)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
  flexShrink: 0,
};
