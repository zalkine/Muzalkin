import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/SessionContext';
import { useJam } from '../lib/jamContext';

import Header from '../components/dashboard/Header';
import JamStatusCard from '../components/dashboard/JamStatusCard';
import SearchBar from '../components/dashboard/SearchBar';
import RecentSearchChips from '../components/dashboard/RecentSearchChips';
import QuickActionsRow from '../components/dashboard/QuickActionsRow';
import Section, { SectionSkeleton } from '../components/dashboard/Section';
import SongCard, { SongCardSkeleton } from '../components/dashboard/SongCard';
import type { Song, User, JamSession } from '../components/dashboard/types';

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

// ── Constants ──────────────────────────────────────────────────────────────────

const BACKEND_URL = '';
const RECENT_KEY  = 'muzalkin_recent_searches';
const MAX_RECENT  = 8;

// ── Trending mock data (replaced by real API in production) ───────────────────

const TRENDING_SONGS: Song[] = [
  { id: 'mock-1', title: 'Hotel California',      artist: 'Eagles',          source: 'ultimate-guitar', difficulty: 'Intermediate' },
  { id: 'mock-2', title: 'Wonderwall',             artist: 'Oasis',           source: 'ultimate-guitar', difficulty: 'Beginner' },
  { id: 'mock-3', title: 'Knockin\' on Heaven\'s Door', artist: 'Bob Dylan', source: 'ultimate-guitar', difficulty: 'Beginner' },
  { id: 'mock-4', title: 'ירושלים של זהב',         artist: 'נעמי שמר',        source: 'tab4u',           difficulty: 'Intermediate' },
  { id: 'mock-5', title: 'חלום בלהות',              artist: 'שלום חנוך',       source: 'tab4u',           difficulty: 'Advanced' },
];

// ── Local storage helpers ─────────────────────────────────────────────────────

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function saveRecent(query: string) {
  const prev = loadRecent().filter(q => q !== query);
  localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...prev].slice(0, MAX_RECENT)));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSong(r: SearchResult, idx: number): Song {
  return {
    id:     r.id ?? r.source_url ?? `res-${idx}`,
    title:  r.song_title,
    artist: r.artist,
    source: r.source,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const { t, i18n } = useTranslation();
  const navigate    = useNavigate();
  const session     = useSession();
  const jam         = useJam();
  const isRTL       = i18n.language === 'he';

  // ── State ──────────────────────────────────────────────────────────────────
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState<SearchResult[]>([]);
  const [status,     setStatus]     = useState<Status>('idle');
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [searchLang, setSearchLang] = useState<'he' | 'en'>('he');
  const [recent,     setRecent]     = useState<string[]>(() => loadRecent());

  // Sync recent on focus
  useEffect(() => { setRecent(loadRecent()); }, []);

  // ── User info ──────────────────────────────────────────────────────────────
  const user: User | null = session
    ? {
        firstName:       session.user.user_metadata?.full_name?.split(' ')[0]
                      ?? session.user.email?.split('@')[0]
                      ?? 'Friend',
        isAuthenticated: true,
      }
    : null;

  // ── Jam session derived state ──────────────────────────────────────────────
  const jamSession: JamSession = {
    active:       !!jam.sessionCode,
    code:         jam.sessionCode ?? '',
    currentSong:  '',           // not tracked in basic context
    participants: jam.participantCount,
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

  // ── Song selection ─────────────────────────────────────────────────────────
  const handleSelect = useCallback(async (song: Song) => {
    // Songs with real UUIDs navigate directly
    if (song.id && !song.id.startsWith('mock-') && !song.id.startsWith('res-')) {
      navigate(`/song/${song.id}`);
      return;
    }
    // Find original result to get source_url
    const item = results.find(r =>
      r.id === song.id ||
      r.source_url === song.id ||
      (`res-${results.indexOf(r)}` === song.id)
    );
    if (!item?.source_url) return;

    setFetchingId(song.id);
    try {
      const lang = item.language ?? searchLang;
      const resp = await fetch(`${BACKEND_URL}/api/chords/fetch`, {
        method:  'POST',
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
        navigate('/song/_preview', { state: { song: row } });
      }
    } catch {
      alert(t('error_fetch'));
    } finally {
      setFetchingId(null);
    }
  }, [navigate, results, searchLang, t]);

  // ── Trending song selection (mock) ─────────────────────────────────────────
  const handleTrendingSelect = useCallback((song: Song) => {
    // Run a search with the song title
    runSearch(song.title);
  }, [runSearch]);

  // ── Add to queue ───────────────────────────────────────────────────────────
  const handleAddToQueue = useCallback((song: Song) => {
    // Basic jam context doesn't have addToQueue — alert for now
    alert(`Added "${song.title}" to queue`);
  }, []);

  // ── Clear recent ───────────────────────────────────────────────────────────
  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col"
      style={{ background: 'var(--bg)', minHeight: '100%' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Header user={user} />

      {/* ── Jam Status Card ────────────────────────────────────────────────── */}
      {jamSession.active && <JamStatusCard jam={jamSession} />}

      {/* ── Search Bar ─────────────────────────────────────────────────────── */}
      <SearchBar
        value={query}
        onChange={setQuery}
        onSearch={handleSearch}
        isLoading={status === 'loading'}
      />

      {/* ── Scrollable Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-6">

        {/* ── IDLE STATE ─────────────────────────────────────────────────── */}
        {status === 'idle' && (
          <>
            {/* Recent searches */}
            <RecentSearchChips
              searches={recent}
              onSelect={runSearch}
              onClear={clearRecent}
            />

            {/* Quick actions */}
            <QuickActionsRow />

            {/* Trending section */}
            <Section emoji="🔥" title={t('trending_title') ?? 'Trending Now'} grid>
              {TRENDING_SONGS.map((song, i) => (
                <SongCard
                  key={song.id}
                  song={song}
                  index={i}
                  onSelect={handleTrendingSelect}
                  showQueueBtn={jamSession.active}
                  onAddToQueue={handleAddToQueue}
                />
              ))}
            </Section>
          </>
        )}

        {/* ── LOADING ────────────────────────────────────────────────────── */}
        {status === 'loading' && (
          <>
            <SectionSkeleton rows={2} />
            <SectionSkeleton rows={3} />
          </>
        )}

        {/* ── ERROR ──────────────────────────────────────────────────────── */}
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center">
            <span className="text-4xl">⚠️</span>
            <p className="text-sm text-red-400">{t('error_fetch')}</p>
            <button
              onClick={handleSearch}
              className="rounded-full bg-accent/20 px-5 py-2 text-sm font-bold text-accent
                         transition-all hover:bg-accent/30 active:scale-95"
            >
              {t('retry')}
            </button>
          </div>
        )}

        {/* ── NO RESULTS ─────────────────────────────────────────────────── */}
        {status === 'done' && results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center">
            <span className="text-4xl">🎵</span>
            <p className="text-sm text-white/40">{t('no_results')}</p>
          </div>
        )}

        {/* ── RESULTS ────────────────────────────────────────────────────── */}
        {status === 'done' && results.length > 0 && (
          <Section
            emoji="🎵"
            title={`${results.length} ${t('results_found') ?? 'results'}`}
            grid
          >
            {results.map((item, idx) => {
              const song    = toSong(item, idx);
              const isBusy  = fetchingId === song.id;
              return (
                <SongCard
                  key={song.id}
                  song={song}
                  index={idx}
                  onSelect={handleSelect}
                  isLoading={isBusy}
                  showQueueBtn={jamSession.active}
                  onAddToQueue={handleAddToQueue}
                />
              );
            })}
          </Section>
        )}

      </div>
    </div>
  );
}
