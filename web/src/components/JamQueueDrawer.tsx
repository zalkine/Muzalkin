/**
 * JamQueueDrawer
 *
 * Slide-up panel showing the jam session song queue.
 *
 * Jamaneger view: tabs — Queue | Add Song | Add Playlist
 *   Queue tab:       reorder (▲▼), remove (✕), tap to play, Next button.
 *   Add Song tab:    search bar → results → "+" adds to queue.
 *   Add Playlist tab: list user playlists → "Add All" adds entire playlist.
 * Jamember view: read-only queue list only.
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useJam, type QueueItem, type SongRef } from '../lib/jamContext';
import { useSession } from '../lib/SessionContext';
import { supabase }  from '../lib/supabase';

type Props = {
  isOpen:  boolean;
  onClose: () => void;
  isRTL?:  boolean;
};

type Tab = 'queue' | 'add_song' | 'add_playlist';

type SearchResult = {
  id?: string;
  song_title: string;
  artist: string;
  source: string;
  source_url?: string;
  language?: string;
};

type Playlist = {
  id: string;
  name: string;
  song_count: number;
};

export default function JamQueueDrawer({ isOpen, onClose, isRTL = false }: Props) {
  const { t } = useTranslation();
  const jam    = useJam();
  const { user } = useSession();

  const [tab,           setTab]           = useState<Tab>('queue');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchStatus,  setSearchStatus]  = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [playlists,     setPlaylists]     = useState<Playlist[]>([]);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [addingId,      setAddingId]      = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  if (!jam.sessionCode) return null;

  const isJamaneger = jam.role === 'jamaneger';
  const sorted = [...jam.queue].sort((a, b) => a.position - b.position);

  const moveItem = (item: QueueItem, dir: -1 | 1) => {
    const idx     = sorted.findIndex(q => q.id === item.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    jam.reorderQueue(reordered.map(q => q.id));
  };

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearchStatus('loading');
    setSearchResults([]);
    try {
      const lang = /[\u0590-\u05FF]/.test(trimmed) ? 'he' : 'en';
      const resp = await fetch(`/api/chords/search?q=${encodeURIComponent(trimmed)}&lang=${lang}`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data: SearchResult[] = await resp.json();
      setSearchResults(data);
      setSearchStatus('done');
    } catch { setSearchStatus('error'); }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(searchQuery);
  };

  const handleAddSong = async (result: SearchResult) => {
    if (!result.id) return; // only add already-cached songs
    const songRef: SongRef = {
      songId: result.id,
      source: 'cached',
      title:  result.song_title,
      artist: result.artist,
    };
    setAddingId(result.id);
    await jam.addToQueue(songRef);
    setAddingId(null);
  };

  const loadPlaylists = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('playlists')
      .select('id, name, playlist_songs(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setPlaylists(data.map((p: { id: string; name: string; playlist_songs: { count: number }[] }) => ({
        id:         p.id,
        name:       p.name,
        song_count: p.playlist_songs?.[0]?.count ?? 0,
      })));
    }
    setPlaylistsLoaded(true);
  }, [user]);

  const handleTabChange = (next: Tab) => {
    setTab(next);
    if (next === 'add_playlist' && !playlistsLoaded) loadPlaylists();
    if (next === 'add_song') setTimeout(() => searchRef.current?.focus(), 100);
  };

  const handleAddPlaylist = async (playlistId: string) => {
    setAddingId(playlistId);
    await jam.addPlaylistToQueue(playlistId);
    setAddingId(null);
    setTab('queue');
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 150,
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position:        'fixed',
        bottom:          0,
        left:            0,
        right:           0,
        maxHeight:       '75vh',
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

        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '12px 16px 8px',
          borderBottom:   '1px solid var(--border)',
          flexShrink:     0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎵</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {t('jam_queue_title')}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              backgroundColor: 'var(--accent)',
              color: '#fff', borderRadius: 10,
              padding: '1px 7px',
            }}>
              {sorted.length}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Manager tabs */}
        {isJamaneger && (
          <div style={{
            display: 'flex', gap: 0,
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            {(['queue', 'add_song', 'add_playlist'] as Tab[]).map(t_ => (
              <button
                key={t_}
                onClick={() => handleTabChange(t_)}
                style={{
                  flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: tab === t_ ? 700 : 500,
                  border: 'none', background: 'transparent',
                  borderBottom: tab === t_ ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === t_ ? 'var(--accent)' : 'var(--text2)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {t_ === 'queue'        ? t('jam_queue_title')   :
                 t_ === 'add_song'     ? t('jam_add_song_tab')  :
                                        t('jam_add_playlist')}
              </button>
            ))}
          </div>
        )}

        {/* ── QUEUE TAB ──────────────────────────────────────────────────────── */}
        {tab === 'queue' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {sorted.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🎶</div>
                  <p style={{ margin: 0, fontSize: 14 }}>{t('jam_queue_empty')}</p>
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

                      <div
                        style={{ flex: 1, minWidth: 0, cursor: isJamaneger ? 'pointer' : 'default' }}
                        onClick={() => isJamaneger && jam.selectSong(item.id)}
                      >
                        <div style={{
                          fontSize: 14, fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent ? 'var(--accent)' : 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>
                          {item.artist}
                        </div>
                      </div>

                      {isJamaneger && (
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <button
                            onClick={() => moveItem(item, -1)}
                            disabled={idx === 0}
                            style={{ ...iconBtn, opacity: idx === 0 ? 0.3 : 1 }}
                            title="Move up"
                          >▲</button>
                          <button
                            onClick={() => moveItem(item, 1)}
                            disabled={idx === sorted.length - 1}
                            style={{ ...iconBtn, opacity: idx === sorted.length - 1 ? 0.3 : 1 }}
                            title="Move down"
                          >▼</button>
                          <button
                            onClick={() => jam.removeFromQueue(item.id)}
                            style={{ ...iconBtn, color: '#cc3333' }}
                            title={t('jam_queue_remove')}
                          >✕</button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {isJamaneger && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <button
                  onClick={() => { jam.playNext(); onClose(); }}
                  style={{
                    width: '100%', padding: '10px',
                    backgroundColor: 'var(--accent)', color: '#fff',
                    border: 'none', borderRadius: 8,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {t('jam_play_next')} ▶
                </button>
              </div>
            )}
          </>
        )}

        {/* ── ADD SONG TAB ───────────────────────────────────────────────────── */}
        {tab === 'add_song' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <form onSubmit={handleSearchSubmit} style={{ padding: '12px 16px', flexShrink: 0, display: 'flex', gap: 8 }}>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('search_placeholder')}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 14,
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--surface)', color: 'var(--text)',
                  outline: 'none',
                }}
              />
              <button type="submit" style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
              }}>
                {t('search')}
              </button>
            </form>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>
              {searchStatus === 'loading' && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>{t('loading')}</div>
              )}
              {searchStatus === 'error' && (
                <div style={{ textAlign: 'center', padding: 24, color: '#cc3333', fontSize: 13 }}>{t('error_fetch')}</div>
              )}
              {searchStatus === 'done' && searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>{t('no_results')}</div>
              )}
              {searchResults.map((r, i) => (
                <div key={r.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.song_title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{r.artist}</div>
                  </div>
                  {r.id && (
                    <button
                      onClick={() => handleAddSong(r)}
                      disabled={addingId === r.id}
                      style={{
                        width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--surface)', color: 'var(--accent)',
                        fontSize: 18, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: addingId === r.id ? 0.5 : 1, flexShrink: 0,
                      }}
                      title={t('jam_add_to_queue')}
                    >
                      +
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ADD PLAYLIST TAB ──────────────────────────────────────────────── */}
        {tab === 'add_playlist' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {!user ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text3)', fontSize: 13 }}>
                {t('sign_in_to_see_playlists')}
              </div>
            ) : !playlistsLoaded ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>{t('loading')}</div>
            ) : playlists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text3)', fontSize: 13 }}>
                {t('no_playlists')}
              </div>
            ) : (
              playlists.map(pl => (
                <div key={pl.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pl.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {pl.song_count === 1 ? t('songs_count_one') : t('songs_count_other', { count: pl.song_count })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddPlaylist(pl.id)}
                    disabled={addingId === pl.id}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: '1px solid var(--accent)',
                      background: 'transparent', color: 'var(--accent)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: addingId === pl.id ? 0.5 : 1, flexShrink: 0,
                    }}
                  >
                    {addingId === pl.id ? '…' : t('jam_add_all')}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

const iconBtn: React.CSSProperties = {
  width:           28,
  height:          28,
  border:          '1px solid var(--border)',
  borderRadius:    5,
  background:      'var(--surface)',
  color:           'var(--text2)',
  fontSize:        12,
  cursor:          'pointer',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  padding:         0,
};
