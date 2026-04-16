import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/SessionContext';
import { useJam } from '../lib/jamContext';

import JamStatusCard from '../components/dashboard/JamStatusCard';
import SongCard, { SongCardSkeleton } from '../components/dashboard/SongCard';
import type { Song, User, JamSession } from '../components/dashboard/types';
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

const BACKEND_URL = '';
const RECENT_KEY  = 'muzalkin_recent_searches';
const MAX_RECENT  = 8;

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}
function saveRecent(q: string) {
  const prev = loadRecent().filter(x => x !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}

const RECENT_SONGS_KEY = 'muzalkin_recent_songs';
const MAX_RECENT_SONGS = 5;

type RecentSong = { id: string; title: string; artist: string; source: string };

function loadRecentSongs(): RecentSong[] {
  try { return JSON.parse(localStorage.getItem(RECENT_SONGS_KEY) ?? '[]'); } catch { return []; }
}
function pushRecentSong(song: RecentSong) {
  const prev = loadRecentSongs().filter(s => s.id !== song.id);
  localStorage.setItem(RECENT_SONGS_KEY, JSON.stringify([song, ...prev].slice(0, MAX_RECENT_SONGS)));
}

function toSong(r: SearchResult, idx: number): Song {
  // Never put source_url in id — it breaks navigation. Use UUID if present, else index key.
  return { id: r.id ?? `r${idx}`, title: r.song_title, artist: r.artist, source: r.source };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const navigate  = useNavigate();
  const session   = useSession();
  const jam       = useJam();

  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<SearchResult[]>([]);
  const [status,      setStatus]      = useState<Status>('idle');
  const [fetchingId,  setFetchingId]  = useState<string | null>(null);
  const [searchLang,  setSearchLang]  = useState<'he' | 'en'>('he');
  const [recent,      setRecent]      = useState<string[]>(() => loadRecent());
  const [recentSongs, setRecentSongs] = useState<RecentSong[]>(() => loadRecentSongs());

  useEffect(() => { setRecent(loadRecent()); }, []);

  const user: User | null = session ? {
    firstName: session.user.user_metadata?.full_name?.split(' ')[0] ?? session.user.email?.split('@')[0] ?? 'Friend',
    isAuthenticated: true,
  } : null;

  const jamSession: JamSession = {
    active: !!jam.sessionCode, code: jam.sessionCode ?? '',
    currentSong: '', participants: jam.participantCount,
  };

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
    // Find the original SearchResult by matching the UUID or the r{idx} key
    const item = results.find((r, i) => r.id === song.id || `r${i}` === song.id);
    if (!item) return;

    // Cache hit — item already has a UUID, navigate straight to the song page
    if (item.id) {
      saveLastPlayed({ title: item.song_title, artist: item.artist, id: item.id });
      pushRecentSong({ id: item.id, title: item.song_title, artist: item.artist, source: item.source });
      setRecentSongs(loadRecentSongs());
      navigate(`/song/${item.id}`);
      return;
    }

    // Scraper result — must fetch & cache the chords first
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
      if (finalId) {
        pushRecentSong({ id: finalId, title: item.song_title, artist: item.artist, source: item.source });
        setRecentSongs(loadRecentSongs());
      }
      navigate(finalId ? `/song/${finalId}` : '/song/_preview', { state: { song: row } });
    } catch { alert('Failed to load chords. Check that the backend is running.'); }
    finally { setFetchingId(null); }
  }, [navigate, results, searchLang]);

  const clearRecent = () => { localStorage.removeItem(RECENT_KEY); setRecent([]); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100%', background: '#0c0c1a' }}>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        height: 240,
        overflow: 'hidden',
        background: '#0c0c1a',
      }}>
        {/* Bokeh background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(ellipse at 70% 40%, rgba(220,80,180,0.45) 0%, transparent 40%),
            radial-gradient(ellipse at 25% 55%, rgba(100,50,220,0.5) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 75%, rgba(60,30,180,0.3) 0%, transparent 35%),
            radial-gradient(ellipse at 15% 20%, rgba(180,60,220,0.2) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 90%, rgba(40,0,100,0.7) 0%, transparent 50%),
            #0c0c1a
          `,
        }} />

        {/* Fade-to-content at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
          background: 'linear-gradient(to bottom, transparent, #0c0c1a)',
        }} />

        {/* Greeting — overlaid bottom-left */}
        <div style={{ position: 'absolute', bottom: 28, left: 20 }}>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
            {user ? `Hi ${user.firstName} 👋` : 'Hi there 👋'}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 17, color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}>
            What do you want to play today?
          </p>
        </div>
      </div>

      {/* ── SEARCH BAR ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 20px', marginTop: -12, position: 'relative', zIndex: 2 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 50, padding: '0 8px 0 20px', height: 54,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search songs or artists..."
            style={{ flex: 1, height: '100%', border: 'none', background: 'transparent', fontSize: 15, color: '#fff', outline: 'none' }}
          />
          {/* Mic */}
          <button style={{
            width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          {/* Guitar shortcut */}
          <button
            onClick={() => navigate('/tuner')}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'linear-gradient(135deg, #5B8DFF, #A040FF)',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, fontSize: 18,
              boxShadow: '0 2px 12px rgba(91,141,255,0.5)',
            }}
          >
            🎸
          </button>
        </div>
      </div>

      {/* ── JAM STATUS ─────────────────────────────────────────────────────── */}
      {jamSession.active && <JamStatusCard jam={jamSession} />}

      {/* ── RECENT CHIPS ───────────────────────────────────────────────────── */}
      {status === 'idle' && recent.length > 0 && (
        <div style={{ padding: '18px 20px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {recent.map(q => (
              <button key={q} onClick={() => runSearch(q)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 50,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13, cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}>
                <span style={{ fontSize: 11 }}>🔍</span>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 40px' }}>

        {/* Idle: recently-opened songs OR empty prompt */}
        {status === 'idle' && (
          recentSongs.length > 0 ? (
            <>
              <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800, color: '#fff' }}>Recently Played</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentSongs.map((song, i) => (
                  <SongCard
                    key={song.id}
                    song={{ id: song.id, title: song.title, artist: song.artist, source: song.source }}
                    index={i}
                    onSelect={s => { saveLastPlayed({ title: s.title, artist: s.artist, id: s.id }); navigate(`/song/${s.id}`); }}
                    showQueueBtn={jamSession.active}
                  />
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', paddingTop: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎸</div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, margin: 0, fontWeight: 600 }}>
                Search for a song above
              </p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, margin: '8px 0 0' }}>
                Hebrew &amp; English songs · Guitar &amp; Piano
              </p>
            </div>
          )
        )}

        {/* Loading */}
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0,1,2,3].map(i => <SongCardSkeleton key={i} />)}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
            <p style={{ color: '#f87171', fontSize: 15, margin: '0 0 16px' }}>Failed to load results</p>
            <button onClick={handleSearch} style={{
              background: 'rgba(91,141,255,0.2)', border: '1px solid rgba(91,141,255,0.4)',
              color: '#5B8DFF', borderRadius: 50, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>Retry</button>
          </div>
        )}

        {/* No results */}
        {status === 'done' && results.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎵</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>No results found</p>
          </div>
        )}

        {/* Results */}
        {status === 'done' && results.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>Results</h2>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                {results.length} found
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map((item, idx) => {
                const song = toSong(item, idx);
                return (
                  <SongCard key={song.id} song={song} index={idx} onSelect={handleSelect}
                    isLoading={fetchingId === song.id}
                    showQueueBtn={jamSession.active} />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
