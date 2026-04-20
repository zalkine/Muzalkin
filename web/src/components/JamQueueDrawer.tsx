/**
 * JamQueueDrawer
 *
 * Slide-up panel with two views toggled by a header button:
 *
 * QUEUE VIEW  — shows the ordered song queue.
 *   • All users: read-only list, current song highlighted.
 *   • Jamanagers: reorder (▲▼), remove (✕), tap to play, Next ▶.
 *
 * ADD SONGS VIEW — four tabs for adding songs to the queue.
 *   • 📋 Playlists  — expand a playlist, add individual songs or Add All.
 *   • 🎵 My Songs   — all saved songs (requires login).
 *   • 🕐 Recent     — recently scraped/fetched songs.
 *   • 🔍 Search     — live search across cached_chords.
 *   All users (including guests) can add songs.
 */

import { useEffect, useState } from 'react';
import { useTranslation }       from 'react-i18next';
import { useJam, type QueueItem, type SongRef } from '../lib/jamContext';
import { useSession }           from '../lib/SessionContext';
import { supabase }             from '../lib/supabase';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type AddTab = 'playlists' | 'songs' | 'recent' | 'search';
type PL     = { id: string; name: string };
type PLSong = { id: string; title: string; artist: string };
type CachedSong = { id: string; song_title: string; artist: string };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  isOpen:  boolean;
  onClose: () => void;
  isRTL?:  boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JamQueueDrawer({ isOpen, onClose, isRTL = false }: Props) {
  const { t }  = useTranslation();
  const jam     = useJam();
  const session = useSession();

  const isLoggedIn  = !!session;
  const isJamaneger = jam.role === 'jamaneger';
  const sorted      = [...jam.queue].sort((a, b) => a.position - b.position);

  // ── View / tab state ─────────────────────────────────────────────────────
  const [view,   setView]   = useState<'queue' | 'add'>('queue');
  const [addTab, setAddTab] = useState<AddTab>(isLoggedIn ? 'playlists' : 'recent');

  // ── Add-songs data ────────────────────────────────────────────────────────
  const [playlists,     setPlaylists]     = useState<PL[]>([]);
  const [playlistSongs, setPlaylistSongs] = useState<Record<string, PLSong[]>>({});
  const [expandedPL,    setExpandedPL]    = useState<string | null>(null);
  const [mySongs,       setMySongs]       = useState<PLSong[]>([]);
  const [recent,        setRecent]        = useState<CachedSong[]>([]);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<CachedSong[]>([]);
  const [loadingData,   setLoadingData]   = useState(false);
  // Track song IDs that were just added (shows ✓ for 2 s)
  const [justAdded,     setJustAdded]     = useState<Set<string>>(new Set());

  // ── Load tab data when view/tab changes ──────────────────────────────────
  useEffect(() => {
    if (view !== 'add') return;
    if (addTab === 'playlists' && !isLoggedIn) return;
    if (addTab === 'songs'     && !isLoggedIn) return;
    if (addTab === 'search') return; // driven by searchQuery effect below

    const load = async () => {
      setLoadingData(true);
      try {
        if (addTab === 'playlists' && session) {
          const { data } = await supabase
            .from('playlists')
            .select('id, name')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
          setPlaylists(data ?? []);
        } else if (addTab === 'songs' && session) {
          const { data } = await supabase
            .from('songs')
            .select('id, title, artist')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(60);
          setMySongs((data ?? []).map(s => ({ id: s.id, title: s.title, artist: s.artist })));
        } else if (addTab === 'recent') {
          const { data } = await supabase
            .from('cached_chords')
            .select('id, song_title, artist')
            .order('fetched_at', { ascending: false })
            .limit(40);
          setRecent(data ?? []);
        }
      } finally {
        setLoadingData(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, addTab]);

  // ── Live search (debounced 350 ms) ────────────────────────────────────────
  useEffect(() => {
    if (addTab !== 'search' || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.trim();
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('cached_chords')
        .select('id, song_title, artist')
        .or(`song_title.ilike.%${q}%,artist.ilike.%${q}%`)
        .order('fetched_at', { ascending: false })
        .limit(25);
      setSearchResults(data ?? []);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, addTab]);

  // ── Queue reorder helper ──────────────────────────────────────────────────
  const moveItem = (item: QueueItem, dir: -1 | 1) => {
    const idx     = sorted.findIndex(q => q.id === item.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    jam.reorderQueue(reordered.map(q => q.id));
  };

  // ── Add song helpers ──────────────────────────────────────────────────────
  const markAdded = (id: string) => {
    setJustAdded(prev => new Set([...prev, id]));
    setTimeout(() => setJustAdded(prev => {
      const n = new Set(prev); n.delete(id); return n;
    }), 2000);
  };

  const handleAddCached = async (song: CachedSong) => {
    await jam.addToQueue({ songId: song.id, source: 'cached', title: song.song_title, artist: song.artist });
    markAdded(song.id);
  };

  const handleAddSaved = async (song: PLSong) => {
    await jam.addToQueue({ songId: song.id, source: 'saved', title: song.title, artist: song.artist });
    markAdded(song.id);
  };

  const handleExpandPlaylist = async (plId: string) => {
    if (expandedPL === plId) { setExpandedPL(null); return; }
    setExpandedPL(plId);
    if (playlistSongs[plId] !== undefined) return; // already loaded
    const { data } = await supabase
      .from('playlist_songs')
      .select('songs(id, title, artist)')
      .eq('playlist_id', plId)
      .order('position', { ascending: true });
    setPlaylistSongs(prev => ({
      ...prev,
      [plId]: (data ?? []).map((ps: Record<string, unknown>) => {
        const s = ps.songs as PLSong;
        return { id: s.id, title: s.title, artist: s.artist };
      }),
    }));
  };

  const handleAddAllPlaylist = async (plId: string) => {
    // Ensure songs are loaded first
    if (playlistSongs[plId] === undefined) await handleExpandPlaylist(plId);
    const songs = playlistSongs[plId];
    if (!songs?.length) return;
    const refs: SongRef[] = songs.map(s => ({ songId: s.id, source: 'saved', title: s.title, artist: s.artist }));
    await jam.addManyToQueue(refs);
    songs.forEach(s => markAdded(s.id));
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const AddBtn = ({ id, onAdd }: { id: string; onAdd: () => void }) => (
    <button
      onClick={onAdd}
      style={{
        fontSize: 11, fontWeight: 700,
        padding: '4px 10px', borderRadius: 6, border: 'none',
        backgroundColor: justAdded.has(id) ? 'var(--surface)' : 'var(--accent)',
        color: justAdded.has(id) ? 'var(--text2)' : '#fff',
        cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
      }}
    >
      {justAdded.has(id) ? '✓' : t('jam_add')}
    </button>
  );

  const SongRow = ({ id, title, artist, onAdd }: { id: string; title: string; artist: string; onAdd: () => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>{artist}</div>
      </div>
      <AddBtn id={id} onAdd={onAdd} />
    </div>
  );

  const Empty = ({ text }: { text: string }) => (
    <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text3)', fontSize: 13 }}>
      {text}
    </div>
  );

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!jam.sessionCode) return null;

  // ── Tab definitions ───────────────────────────────────────────────────────
  const TABS: { key: AddTab; icon: string; label: string; requiresAuth: boolean }[] = [
    { key: 'playlists', icon: '📋', label: t('jam_tab_playlists'), requiresAuth: true  },
    { key: 'songs',     icon: '🎵', label: t('jam_tab_my_songs'),  requiresAuth: true  },
    { key: 'recent',    icon: '🕐', label: t('jam_tab_recent'),    requiresAuth: false },
    { key: 'search',    icon: '🔍', label: t('jam_tab_search'),    requiresAuth: false },
  ];

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 150 }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position:        'fixed',
        bottom:          0,
        left:            0,
        right:           0,
        maxHeight:       '78vh',
        backgroundColor: 'var(--card-bg)',
        borderRadius:    '16px 16px 0 0',
        boxShadow:       '0 -4px 24px rgba(0,0,0,0.2)',
        zIndex:          160,
        display:         'flex',
        flexDirection:   'column',
        transform:       isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition:      'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
        direction:       isRTL ? 'rtl' : 'ltr',
      }}>

        {/* ── Header ── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '12px 16px 8px',
          borderBottom:   '1px solid var(--border)',
          flexShrink:     0,
          gap:            8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{view === 'add' ? '➕' : '🎵'}</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {view === 'add' ? t('jam_add_songs') : t('jam_queue_title')}
            </span>
            {view === 'queue' && (
              <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>
                {sorted.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Toggle between Queue and Add Songs */}
            <button
              onClick={() => setView(v => v === 'add' ? 'queue' : 'add')}
              style={{
                fontSize: 12, fontWeight: 700,
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid var(--accent)',
                backgroundColor: view === 'add' ? 'var(--accent)' : 'transparent',
                color: view === 'add' ? '#fff' : 'var(--accent)',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {view === 'add' ? `← ${t('jam_queue_title')}` : `+ ${t('jam_add_songs')}`}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ══════════════════ QUEUE VIEW ══════════════════ */}
        {view === 'queue' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {sorted.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🎶</div>
                  <p style={{ margin: 0, fontSize: 14 }}>{t('jam_queue_empty')}</p>
                  <button
                    onClick={() => setView('add')}
                    style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    + {t('jam_add_songs')}
                  </button>
                </div>
              ) : (
                sorted.map((item, idx) => {
                  const isCurrent = item.id === jam.currentQueueItemId;
                  return (
                    <div
                      key={item.id}
                      style={{
                        display:         'flex',
                        alignItems:      'center',
                        gap:             8,
                        padding:         '10px 16px',
                        backgroundColor: isCurrent ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                        borderLeft:      isCurrent ? '3px solid var(--accent)' : '3px solid transparent',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--text3)', minWidth: 20, textAlign: 'center' }}>
                        {isCurrent ? '▶' : idx + 1}
                      </span>

                      {/* Song info — tap to play (jamanager only) */}
                      <div
                        style={{ flex: 1, minWidth: 0, cursor: isJamaneger ? 'pointer' : 'default' }}
                        onClick={() => isJamaneger && jam.selectSong(item.id)}
                      >
                        <div style={{ fontSize: 14, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{item.artist}</div>
                      </div>

                      {/* Jamanager: reorder + remove */}
                      {isJamaneger && (
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <button onClick={() => moveItem(item, -1)} disabled={idx === 0} style={{ ...iconBtn, opacity: idx === 0 ? 0.3 : 1 }} title="Move up">▲</button>
                          <button onClick={() => moveItem(item, 1)} disabled={idx === sorted.length - 1} style={{ ...iconBtn, opacity: idx === sorted.length - 1 ? 0.3 : 1 }} title="Move down">▼</button>
                          <button onClick={() => jam.removeFromQueue(item.id)} style={{ ...iconBtn, color: '#cc3333' }} title={t('jam_queue_remove')}>✕</button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer: Next button — jamaneger only */}
            {isJamaneger && sorted.length > 0 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <button
                  onClick={() => { jam.playNext(); onClose(); }}
                  style={{ width: '100%', padding: '10px', backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('jam_play_next')} ▶
                </button>
              </div>
            )}
          </>
        )}

        {/* ══════════════════ ADD SONGS VIEW ══════════════════ */}
        {view === 'add' && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto' }}>
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => !( tab.requiresAuth && !isLoggedIn) && setAddTab(tab.key)}
                  style={{
                    flex: 1, padding: '10px 4px', border: 'none',
                    backgroundColor: 'transparent',
                    borderBottom: addTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                    color: addTab === tab.key ? 'var(--accent)' : 'var(--text2)',
                    fontSize: 11, fontWeight: 600, cursor: tab.requiresAuth && !isLoggedIn ? 'default' : 'pointer',
                    opacity: tab.requiresAuth && !isLoggedIn ? 0.4 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>

              {/* ── Auth gate ── */}
              {(addTab === 'playlists' || addTab === 'songs') && !isLoggedIn && (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
                  <p style={{ margin: 0, fontSize: 14 }}>{t('jam_login_required')}</p>
                </div>
              )}

              {/* ── Loading ── */}
              {loadingData && (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)', fontSize: 13 }}>{t('loading')}</div>
              )}

              {/* ── Playlists tab ── */}
              {addTab === 'playlists' && isLoggedIn && !loadingData && (
                playlists.length === 0
                  ? <Empty text={t('no_playlists')} />
                  : playlists.map(pl => (
                    <div key={pl.id}>
                      {/* Playlist row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 16 }}>📋</span>
                        <div
                          style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onClick={() => handleExpandPlaylist(pl.id)}
                        >
                          {pl.name}
                        </div>
                        <button
                          onClick={() => handleAddAllPlaylist(pl.id)}
                          style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          {t('jam_add_all')}
                        </button>
                        <button
                          onClick={() => handleExpandPlaylist(pl.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
                        >
                          {expandedPL === pl.id ? '▲' : '▼'}
                        </button>
                      </div>

                      {/* Expanded playlist songs */}
                      {expandedPL === pl.id && (
                        <div style={{ backgroundColor: 'var(--surface)' }}>
                          {playlistSongs[pl.id] === undefined && (
                            <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>{t('loading')}</div>
                          )}
                          {playlistSongs[pl.id]?.length === 0 && (
                            <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>{t('playlist_empty')}</div>
                          )}
                          {(playlistSongs[pl.id] ?? []).map(song => (
                            <SongRow key={song.id} id={song.id} title={song.title} artist={song.artist} onAdd={() => handleAddSaved(song)} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
              )}

              {/* ── My Songs tab ── */}
              {addTab === 'songs' && isLoggedIn && !loadingData && (
                mySongs.length === 0
                  ? <Empty text={t('no_saved_songs')} />
                  : mySongs.map(song => (
                    <SongRow key={song.id} id={song.id} title={song.title} artist={song.artist} onAdd={() => handleAddSaved(song)} />
                  ))
              )}

              {/* ── Recent tab ── */}
              {addTab === 'recent' && !loadingData && (
                recent.length === 0
                  ? <Empty text={t('jam_no_songs')} />
                  : recent.map(song => (
                    <SongRow key={song.id} id={song.id} title={song.song_title} artist={song.artist} onAdd={() => handleAddCached(song)} />
                  ))
              )}

              {/* ── Search tab ── */}
              {addTab === 'search' && (
                <>
                  <div style={{ padding: '12px 16px 8px', position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={t('jam_search_placeholder')}
                      autoFocus
                      style={{
                        width: '100%', height: 40, border: '1px solid var(--border)',
                        borderRadius: 8, paddingInline: 12, fontSize: 14,
                        backgroundColor: 'var(--input-bg)', color: 'var(--text)',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  {!searchQuery.trim() && <Empty text={t('jam_search_hint')} />}
                  {searchQuery.trim() && !loadingData && searchResults.length === 0 && <Empty text={t('no_results')} />}
                  {searchResults.map(song => (
                    <SongRow key={song.id} id={song.id} title={song.song_title} artist={song.artist} onAdd={() => handleAddCached(song)} />
                  ))}
                </>
              )}

            </div>
          </>
        )}

      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const iconBtn: React.CSSProperties = {
  width: 28, height: 28,
  border: '1px solid var(--border)', borderRadius: 5,
  background: 'var(--surface)', color: 'var(--text2)',
  fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
};
