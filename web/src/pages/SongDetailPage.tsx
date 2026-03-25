import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { supabase } from '../lib/supabase';
import ChordDisplay, { ChordLine } from '../components/ChordDisplay';

// ---------------------------------------------------------------------------
// Chord transposition helpers (identical logic to mobile)
// ---------------------------------------------------------------------------

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ENHARMONIC: Record<string, string> = {
  'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
};

function transposeNote(note: string, semitones: number): string {
  const normalized = ENHARMONIC[note] ?? note;
  const idx = CHROMATIC.indexOf(normalized);
  if (idx === -1) return note;
  return CHROMATIC[(idx + semitones + 12) % 12];
}

const CHORD_RE = /[A-G][#b]?(m|maj|min|sus[24]?|dim|aug|add\d+|[0-9])*(?:\/[A-G][#b]?)?/g;

function transposeLine(content: string, semitones: number): string {
  if (semitones === 0) return content;
  return content.replace(CHORD_RE, (match) => {
    const slashIdx = match.indexOf('/');
    if (slashIdx !== -1) {
      const root = match.slice(0, slashIdx);
      const bass = match.slice(slashIdx + 1);
      const rootNote = root.match(/^[A-G][#b]?/)?.[0] ?? '';
      const suffix   = root.slice(rootNote.length);
      const bassNote = bass.match(/^[A-G][#b]?/)?.[0] ?? '';
      return `${transposeNote(rootNote, semitones)}${suffix}/${transposeNote(bassNote, semitones)}`;
    }
    const rootNote = match.match(/^[A-G][#b]?/)?.[0] ?? '';
    const suffix   = match.slice(rootNote.length);
    return `${transposeNote(rootNote, semitones)}${suffix}`;
  });
}

function applyTranspose(data: ChordLine[], semitones: number): ChordLine[] {
  if (semitones === 0) return data;
  return data.map((line) =>
    line.type === 'chords'
      ? { ...line, content: transposeLine(line.content, semitones) }
      : line,
  );
}

// ---------------------------------------------------------------------------
// Auto-scroll speeds
// ---------------------------------------------------------------------------

const SCROLL_SPEEDS = [0.5, 1, 1.5, 2.5, 4]; // px per 50ms

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Song = {
  id: string;
  song_title: string;
  artist: string;
  language: string;
  chords_data: ChordLine[];
};

type Playlist = { id: string; name: string };

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SongDetailPage() {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const { t, i18n }    = useTranslation();
  const isRTL          = i18n.language === 'he';

  const [song,     setSong]     = useState<Song | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [savedId,  setSavedId]  = useState<string | null>(null);

  // Transpose
  const [semitones, setSemitones] = useState(0);

  // Auto-scroll
  const scrollAreaRef  = useRef<HTMLDivElement>(null);
  const scrollOffset   = useRef(0);
  const scrollTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scrolling,    setScrolling]   = useState(false);
  const [speedIndex,   setSpeedIndex]  = useState(1);

  // Playlist modal
  const [playlists,      setPlaylists]      = useState<Playlist[]>([]);
  const [showPLModal,    setShowPLModal]    = useState(false);
  const [addingPL,       setAddingPL]       = useState(false);

  // Load song data
  useEffect(() => {
    if (!id) return;
    supabase
      .from('cached_chords')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setSong(data as Song);
        setLoading(false);
      });
  }, [id]);

  // Cleanup scroll timer
  useEffect(() => {
    return () => { if (scrollTimer.current) clearInterval(scrollTimer.current); };
  }, []);

  // Save song
  const handleSave = useCallback(async () => {
    if (!song) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const resp = await fetch(`${BACKEND_URL}/api/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ cached_chord_id: song.id }),
      });
      if (!resp.ok) throw new Error('Save failed');
      const saved = await resp.json();
      setSavedId(saved.id);
      alert(t('saved'));
    } catch {
      alert(t('save_error'));
    } finally {
      setSaving(false);
    }
  }, [song, t]);

  // Auto-scroll
  const toggleScroll = useCallback(() => {
    if (scrolling) {
      if (scrollTimer.current) clearInterval(scrollTimer.current);
      scrollTimer.current = null;
      setScrolling(false);
    } else {
      setScrolling(true);
      scrollTimer.current = setInterval(() => {
        scrollOffset.current += SCROLL_SPEEDS[speedIndex];
        scrollAreaRef.current?.scrollTo({ top: scrollOffset.current, behavior: 'auto' });
      }, 50);
    }
  }, [scrolling, speedIndex]);

  const cycleSpeed = useCallback(() => {
    if (scrollTimer.current) clearInterval(scrollTimer.current);
    scrollTimer.current = null;
    const next = (speedIndex + 1) % SCROLL_SPEEDS.length;
    setSpeedIndex(next);
    if (scrolling) {
      scrollTimer.current = setInterval(() => {
        scrollOffset.current += SCROLL_SPEEDS[next];
        scrollAreaRef.current?.scrollTo({ top: scrollOffset.current, behavior: 'auto' });
      }, 50);
    }
  }, [scrolling, speedIndex]);

  // Share
  const handleShare = useCallback(() => {
    if (!song) return;
    const text = t('share_message', { title: song.song_title, artist: song.artist });
    if (navigator.share) {
      navigator.share({ text }).catch(() => {/* user cancelled */});
    } else {
      navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'));
    }
  }, [song, t]);

  // Add to playlist
  const openPlaylistModal = useCallback(async () => {
    if (!savedId) {
      alert(t('no_saved_songs'));
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('playlists')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setPlaylists((data ?? []) as Playlist[]);
    setShowPLModal(true);
  }, [savedId, t]);

  const addToPlaylist = useCallback(async (playlistId: string) => {
    if (!savedId) return;
    setAddingPL(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const resp = await fetch(`${BACKEND_URL}/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ song_id: savedId }),
      });
      if (!resp.ok) throw new Error('Failed');
      setShowPLModal(false);
      alert(t('playlist_added'));
    } catch {
      alert(t('playlist_add_error'));
    } finally {
      setAddingPL(false);
    }
  }, [savedId, t]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ ...centerStyle }}>
        <div style={spinnerStyle} />
        <p style={{ color: '#888' }}>{t('loading')}</p>
      </div>
    );
  }

  if (!song) {
    return (
      <div style={{ ...centerStyle }}>
        <p style={{ color: '#cc3333' }}>{t('error_load')}</p>
        <button onClick={() => navigate(-1)} style={linkBtnStyle}>{t('retry')}</button>
      </div>
    );
  }

  const displayData = applyTranspose(song.chords_data, semitones);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        padding: '10px 12px',
        borderBottom: '1px solid #e0e0e0',
        gap: 8,
      }}>
        <button onClick={() => navigate(-1)} style={{ ...iconBtnStyle, fontSize: 22, color: '#4285F4' }}>
          {isRTL ? '→' : '←'}
        </button>

        <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{song.song_title}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{song.artist}</div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...saveBtnStyle,
            backgroundColor: saving ? '#aaa' : '#4285F4',
          }}
        >
          {saving ? t('saving') : savedId ? '✓' : t('save_song')}
        </button>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e0e0e0',
        flexWrap: 'wrap',
        gap: 6,
      }}>
        {/* Transpose */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button style={toolBtnStyle} onClick={() => setSemitones((s) => Math.max(-11, s - 1))}>
            {t('transpose_down')}
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>
            {semitones > 0 ? `+${semitones}` : `${semitones}`}
          </span>
          <button style={toolBtnStyle} onClick={() => setSemitones((s) => Math.min(11, s + 1))}>
            {t('transpose_up')}
          </button>
          {semitones !== 0 && (
            <button style={{ ...toolBtnStyle, borderColor: '#ccc', color: '#888' }} onClick={() => setSemitones(0)}>
              {t('transpose_reset')}
            </button>
          )}
        </div>

        {/* Scroll + Share + Playlist */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {scrolling && (
            <button style={toolBtnStyle} onClick={cycleSpeed}>
              {`×${SCROLL_SPEEDS[speedIndex]}`}
            </button>
          )}
          <button
            style={{ ...toolBtnStyle, backgroundColor: scrolling ? '#4285F4' : '#fff', color: scrolling ? '#fff' : '#4285F4' }}
            onClick={toggleScroll}
          >
            {scrolling ? t('auto_scroll_stop') : t('auto_scroll_start')}
          </button>
          <button style={toolBtnStyle} onClick={handleShare}>{t('share')}</button>
          <button style={toolBtnStyle} onClick={openPlaylistModal}>+PL</button>
        </div>
      </div>

      {/* Chord sheet */}
      <div
        ref={scrollAreaRef}
        style={{ flex: 1, overflowY: 'auto' }}
        onScroll={(e) => { scrollOffset.current = (e.target as HTMLDivElement).scrollTop; }}
      >
        <ChordDisplay data={displayData} />
      </div>

      {/* Add-to-playlist modal */}
      {showPLModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ textAlign: isRTL ? 'right' : 'left', margin: 0 }}>
              {t('add_to_playlist_title')}
            </h3>

            {playlists.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center' }}>{t('no_playlists')}</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 280, overflowY: 'auto' }}>
                {playlists.map((pl) => (
                  <li key={pl.id}>
                    <button
                      onClick={() => addToPlaylist(pl.id)}
                      disabled={addingPL}
                      style={{
                        width: '100%',
                        padding: '12px 0',
                        background: 'none',
                        border: 'none',
                        borderBottom: '1px solid #eee',
                        fontSize: 15,
                        textAlign: isRTL ? 'right' : 'left',
                        cursor: 'pointer',
                        color: '#111',
                      }}
                    >
                      {pl.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => setShowPLModal(false)}
              style={{ alignSelf: 'flex-end', ...toolBtnStyle }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared inline styles
// ---------------------------------------------------------------------------

const centerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', height: '80vh', gap: 12,
};

const spinnerStyle: React.CSSProperties = {
  width: 36, height: 36,
  border: '3px solid #e0e0e0', borderTopColor: '#4285F4',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#4285F4', fontSize: 14,
  fontWeight: 600, cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  paddingInline: 12, paddingBlock: 7, color: '#fff', border: 'none',
  borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const toolBtnStyle: React.CSSProperties = {
  paddingInline: 9, paddingBlock: 5, borderRadius: 6,
  border: '1px solid #4285F4', backgroundColor: '#fff',
  color: '#4285F4', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  width: '100%', maxWidth: 400, backgroundColor: '#fff',
  borderRadius: 12, padding: 20, display: 'flex',
  flexDirection: 'column', gap: 14, maxHeight: '70vh',
};
