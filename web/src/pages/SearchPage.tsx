import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '../lib/SessionContext';
import { useJam } from '../lib/jamContext';
import SongCard, { SongCardSkeleton } from '../components/dashboard/SongCard';
import type { Song } from '../components/dashboard/types';
import { saveLastPlayed } from '../components/dashboard/NowPlayingBar';

// ── Types ─────────────────────────────────────────────────────────────────────
type SearchResult = {
  id?: string;
  song_title: string;
  artist: string;
  source: string;
  source_url?: string;
  language?: string;
};
type Status = 'idle' | 'loading' | 'done' | 'error';

const BACKEND_URL   = '';
const RECENT_KEY    = 'muzalkin_recent_searches';
const MAX_RECENT    = 9;

const RECENT_SONGS_KEY  = 'muzalkin_recent_songs';
const MAX_RECENT_SONGS  = 5;
type RecentSong = { id: string; title: string; artist: string; source: string };

function loadRecent(): string[]     { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; } }
function loadRecentSongs(): RecentSong[] { try { return JSON.parse(localStorage.getItem(RECENT_SONGS_KEY) ?? '[]'); } catch { return []; } }

function saveRecent(q: string) {
  const prev = loadRecent().filter(x => x !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}
function pushRecentSong(song: RecentSong) {
  const prev = loadRecentSongs().filter(s => s.id !== song.id);
  localStorage.setItem(RECENT_SONGS_KEY, JSON.stringify([song, ...prev].slice(0, MAX_RECENT_SONGS)));
}

function toSong(r: SearchResult, idx: number): Song {
  return { id: r.id ?? `r${idx}`, title: r.song_title, artist: r.artist, source: r.source };
}

// ── Guitar silhouette SVG (hero background) ───────────────────────────────────
function GuitarSilhouette() {
  return (
    <svg
      viewBox="0 0 200 340"
      style={{ position: 'absolute', right: 0, bottom: 0, height: '100%', opacity: 0.12, pointerEvents: 'none' }}
      fill="rgba(180,120,255,1)"
    >
      {/* Body — seated guitarist silhouette */}
      {/* Head */}
      <ellipse cx="120" cy="30" rx="18" ry="20" />
      {/* Neck */}
      <rect x="113" y="48" width="14" height="24" rx="6" />
      {/* Torso */}
      <ellipse cx="118" cy="105" rx="32" ry="38" />
      {/* Left arm down holding guitar */}
      <path d="M88 85 Q55 120 48 160" stroke="rgba(180,120,255,1)" strokeWidth="14" fill="none" strokeLinecap="round"/>
      {/* Right arm across */}
      <path d="M148 90 Q160 115 155 140" stroke="rgba(180,120,255,1)" strokeWidth="14" fill="none" strokeLinecap="round"/>
      {/* Legs */}
      <path d="M100 138 Q85 185 80 230" stroke="rgba(180,120,255,1)" strokeWidth="18" fill="none" strokeLinecap="round"/>
      <path d="M136 138 Q145 185 148 230" stroke="rgba(180,120,255,1)" strokeWidth="18" fill="none" strokeLinecap="round"/>
      {/* Guitar body */}
      <ellipse cx="62" cy="182" rx="28" ry="34" />
      <ellipse cx="58" cy="148" rx="20" ry="24" />
      {/* Guitar waist */}
      <rect x="38" y="166" width="10" height="18" rx="3" />
      {/* Sound hole */}
      <circle cx="60" cy="175" r="9" fill="#0c0c1a" />
      {/* Guitar neck */}
      <rect x="70" y="100" width="8" height="58" rx="3" />
      {/* Tuning pegs */}
      <rect x="68" y="95" width="4" height="12" rx="2" />
      <rect x="76" y="95" width="4" height="12" rx="2" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const navigate     = useNavigate();
  const session      = useSession();
  const jam          = useJam();
  const { t, i18n } = useTranslation();
  const inputRef     = useRef<HTMLInputElement>(null);

  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<SearchResult[]>([]);
  const [status,       setStatus]       = useState<Status>('idle');
  const [fetchingId,   setFetchingId]   = useState<string | null>(null);
  const [searchLang,   setSearchLang]   = useState<'he' | 'en'>('he');
  const [recent,       setRecent]       = useState<string[]>(() => loadRecent());
  const [recentSongs,  setRecentSongs]  = useState<RecentSong[]>(() => loadRecentSongs());
  const [popular,      setPopular]      = useState<Song[]>([]);

  const isRTL = i18n.language === 'he';

  // Fetch popular songs on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/chords/popular?limit=8`)
      .then(r => r.ok ? r.json() : [])
      .then((data: SearchResult[]) => {
        setPopular(data.map((r, i) => toSong(r, i)));
      })
      .catch(() => {});
  }, []);

  const firstName = session
    ? (session.user.user_metadata?.full_name?.split(' ')[0] ?? session.user.email?.split('@')[0] ?? null)
    : null;

  const greeting = isRTL
    ? (firstName ? `היי ${firstName} 👋` : 'היי 👋')
    : (firstName ? `Hi ${firstName} 👋` : 'Hi there 👋');

  const subtitle = isRTL ? 'מה תרצה לנגן היום?' : 'What do you want to play today?';

  // ── Search ─────────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setStatus('loading');
    setResults([]);
    try {
      const lang = /[\u0590-\u05FF]/.test(trimmed) ? 'he' : 'en';
      setSearchLang(lang);
      const resp = await fetch(`${BACKEND_URL}/api/chords/search?q=${encodeURIComponent(trimmed)}&lang=${lang}`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data: SearchResult[] = await resp.json();
      setResults(data);
      setStatus('done');
      saveRecent(trimmed);
      setRecent(loadRecent());
    } catch { setStatus('error'); }
  }, []);

  const handleSearch = useCallback(() => runSearch(query), [query, runSearch]);

  // ── Song selection ─────────────────────────────────────────────────────────
  const handleSelect = useCallback(async (song: Song) => {
    const item = results.find((r, i) => r.id === song.id || `r${i}` === song.id);
    if (!item) {
      // Came from popular or recentSongs — has a real id already
      if (song.id && !song.id.startsWith('r')) {
        saveLastPlayed({ title: song.title, artist: song.artist, id: song.id });
        navigate(`/song/${song.id}`);
      }
      return;
    }
    if (item.id) {
      saveLastPlayed({ title: item.song_title, artist: item.artist, id: item.id });
      pushRecentSong({ id: item.id, title: item.song_title, artist: item.artist, source: item.source });
      setRecentSongs(loadRecentSongs());
      navigate(`/song/${item.id}`);
      return;
    }
    if (!item.source_url) return;
    setFetchingId(song.id);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/chords/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.source_url, title: item.song_title, artist: item.artist, source: item.source, lang: item.language ?? searchLang }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const row = await resp.json();
      const finalId = row.id ?? undefined;
      saveLastPlayed({ title: item.song_title, artist: item.artist, id: finalId });
      if (finalId) { pushRecentSong({ id: finalId, title: item.song_title, artist: item.artist, source: item.source }); setRecentSongs(loadRecentSongs()); }
      navigate(finalId ? `/song/${finalId}` : '/song/_preview', { state: { song: row } });
    } catch { alert('Failed to load chords. Check that the backend is running.'); }
    finally { setFetchingId(null); }
  }, [navigate, results, searchLang]);

  const clearSearch = () => { setQuery(''); setStatus('idle'); setResults([]); inputRef.current?.focus(); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100%', background: '#0c0c1a' }} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#0c0c1a' }}>
        {/* Bokeh */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(ellipse at 70% 40%, rgba(220,80,180,0.45) 0%, transparent 40%),
            radial-gradient(ellipse at 20% 60%, rgba(100,50,220,0.5) 0%, transparent 45%),
            radial-gradient(ellipse at 90% 80%, rgba(60,30,180,0.3) 0%, transparent 35%),
            radial-gradient(ellipse at 50% 90%, rgba(40,0,100,0.8) 0%, transparent 50%),
            #0c0c1a
          `,
        }} />
        {/* Guitar silhouette */}
        <GuitarSilhouette />
        {/* Fade to content */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to bottom, transparent, #0c0c1a)' }} />
        {/* Greeting */}
        <div style={{ position: 'absolute', bottom: 24, left: 20, right: 20 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{greeting}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>{subtitle}</p>
        </div>
      </div>

      {/* ── SEARCH BAR ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px', marginTop: -10, position: 'relative', zIndex: 2 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 50, padding: '0 8px 0 18px', height: 50,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)',
        }}>
          {/* Search icon */}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={isRTL ? 'חפש שיר או אמן...' : 'Search songs or artists...'}
            dir={isRTL ? 'rtl' : 'ltr'}
            style={{ flex: 1, height: '100%', border: 'none', background: 'transparent', fontSize: 15, color: '#fff', outline: 'none' }}
          />
          {/* X clear button — only when there's text */}
          {query.length > 0 && (
            <button onClick={clearSearch} style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}>×</button>
          )}
          {/* Search button */}
          <button onClick={handleSearch} style={{
            height: 36, paddingInline: 16, borderRadius: 50,
            background: 'linear-gradient(90deg, #5B8DFF, #A040FF)',
            border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 12px rgba(91,141,255,0.4)',
          }}>
            {isRTL ? 'חפש' : 'Search'}
          </button>
        </div>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 40px' }}>

        {/* Recent searches (chips) */}
        {status === 'idle' && recent.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {isRTL ? 'חיפושים אחרונים' : 'Recent Searches'}
              </span>
              <button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecent([]); }} style={{
                background: 'none', border: 'none', color: '#5B8DFF', fontSize: 12, cursor: 'pointer',
              }}>
                {isRTL ? 'נקה' : 'Clear'}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recent.slice(0, 9).map(q => (
                <button key={q} onClick={() => runSearch(q)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 50,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 13, cursor: 'pointer',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[0,1,2,3,4].map(i => <SongCardSkeleton key={i} />)}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
            <p style={{ color: '#f87171', fontSize: 14, margin: '0 0 12px' }}>
              {isRTL ? 'שגיאה בטעינת תוצאות' : 'Failed to load results'}
            </p>
            <button onClick={handleSearch} style={{
              background: 'rgba(91,141,255,0.2)', border: '1px solid rgba(91,141,255,0.4)',
              color: '#5B8DFF', borderRadius: 50, padding: '8px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>{isRTL ? 'נסה שוב' : 'Retry'}</button>
          </div>
        )}

        {/* No results */}
        {status === 'done' && results.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎵</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
              {isRTL ? 'לא נמצאו תוצאות' : 'No results found'}
            </p>
          </div>
        )}

        {/* Search results */}
        {status === 'done' && results.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {isRTL ? 'תוצאות' : 'Results'}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{results.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.map((item, idx) => {
                const song = toSong(item, idx);
                return <SongCard key={song.id} song={song} index={idx} onSelect={handleSelect} isLoading={fetchingId === song.id} showQueueBtn={!!jam.sessionCode} />;
              })}
            </div>
          </>
        )}

        {/* Idle: Recently played by this user */}
        {status === 'idle' && recentSongs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              {isRTL ? 'ניגנת לאחרונה' : 'Continue Playing'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentSongs.map((song, i) => (
                <SongCard key={song.id}
                  song={{ id: song.id, title: song.title, artist: song.artist, source: song.source }}
                  index={i}
                  onSelect={s => { saveLastPlayed({ title: s.title, artist: s.artist, id: s.id }); navigate(`/song/${s.id}`); }}
                  showQueueBtn={!!jam.sessionCode} />
              ))}
            </div>
          </div>
        )}

        {/* Popular songs from all users */}
        {status === 'idle' && popular.length > 0 && (
          <div>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              {isRTL ? 'פופולרי' : 'Popular'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {popular.map((song, i) => (
                <SongCard key={song.id} song={song} index={i} onSelect={handleSelect} showQueueBtn={!!jam.sessionCode} />
              ))}
            </div>
          </div>
        )}

        {/* Empty first-time state */}
        {status === 'idle' && recentSongs.length === 0 && popular.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎸</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, margin: 0 }}>
              {isRTL ? 'חפש שיר כדי להתחיל' : 'Search for a song to get started'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
