import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { supabase } from '../lib/supabase';
import { useSession } from '../lib/SessionContext';
import ChordDisplay, { ChordLine } from '../components/ChordDisplay';

// ---------------------------------------------------------------------------
// Chord transposition helpers
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

const SCROLL_SPEEDS = [0.2, 0.4, 0.6, 0.9, 1.4]; // px per 50ms tick ≈ 4–28 px/s

type Song = {
  id: string;
  song_title: string;
  artist: string;
  language: string;
  chords_data: ChordLine[];
  raw_url?: string;
};

type Playlist = { id: string; name: string };

export default function SongDetailPage() {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const { t, i18n }    = useTranslation();
  const session        = useSession();
  // Direction follows the song's language, not the UI language
  const [isRTL, setIsRTL] = useState(i18n.language === 'he');

  const [song,     setSong]     = useState<Song | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [savedId,  setSavedId]  = useState<string | null>(null);
  const [semitones, setSemitones] = useState(0);
  const [fontSize,  setFontSize]  = useState(1.0);
  const FONT_SIZES = [0.8, 1.0, 1.2, 1.4, 1.6, 1.8];

  const scrollAreaRef  = useRef<HTMLDivElement>(null);
  const scrollOffset   = useRef(0);
  const scrollTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scrolling,    setScrolling]   = useState(false);
  const [speedIndex,   setSpeedIndex]  = useState(1);

  const [playlists,          setPlaylists]          = useState<Playlist[]>([]);
  const [showPLModal,        setShowPLModal]        = useState(false);
  const [addingPL,           setAddingPL]           = useState(false);
  const [currentSongIdForPL, setCurrentSongIdForPL] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // Try cached_chords first (from search), then songs table (from playlist)
    supabase
      .from('cached_chords')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data, error }) => {
        if (!error && data) {
          setSong(data as Song);
          setIsRTL((data as Song).language === 'he');
          setLoading(false);
          return;
        }
        // Not in cache — try the user's songs table (title/artist columns differ)
        const { data: saved } = await supabase
          .from('songs')
          .select('id, title, artist, language, chords_data')
          .eq('id', id)
          .single();
        if (saved) {
          const s: Song = {
            id:          saved.id,
            song_title:  saved.title,
            artist:      saved.artist,
            language:    saved.language,
            chords_data: saved.chords_data,
          };
          setSong(s);
          setIsRTL(s.language === 'he');
        }
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    return () => { if (scrollTimer.current) clearInterval(scrollTimer.current); };
  }, []);

  const handleSave = useCallback(async (silent = false): Promise<string | null> => {
    if (!song) return null;
    if (!session) { navigate('/login'); return null; }
    setSaving(true);
    try {
      const { data: saved, error } = await supabase
        .from('songs')
        .insert({
          user_id:     session.user.id,
          title:       song.song_title,
          artist:      song.artist,
          language:    song.language ?? 'he',
          chords_data: song.chords_data,
          source_url:  song.raw_url ?? null,
          instrument:  'guitar',
          transpose:   0,
        })
        .select('id')
        .single();
      if (error) throw error;
      setSavedId(saved.id);
      if (!silent) alert(t('saved'));
      return saved.id;
    } catch (err) {
      console.error('Save error:', err);
      alert(t('save_error'));
      return null;
    } finally {
      setSaving(false);
    }
  }, [song, session, navigate, t]);

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

  const adjustSpeed = useCallback((delta: number) => {
    if (scrollTimer.current) clearInterval(scrollTimer.current);
    scrollTimer.current = null;
    const next = Math.max(0, Math.min(SCROLL_SPEEDS.length - 1, speedIndex + delta));
    setSpeedIndex(next);
    if (scrolling) {
      scrollTimer.current = setInterval(() => {
        scrollOffset.current += SCROLL_SPEEDS[next];
        scrollAreaRef.current?.scrollTo({ top: scrollOffset.current, behavior: 'auto' });
      }, 50);
    }
  }, [scrolling, speedIndex]);

  const handleShare = useCallback(() => {
    if (!song) return;
    const text = t('share_message', { title: song.song_title, artist: song.artist });
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'));
    }
  }, [song, t]);

  const openPlaylistModal = useCallback(async () => {
    if (!session) { navigate('/login'); return; }
    const resolvedId = savedId ?? await handleSave(true);
    if (!resolvedId) return;

    const { data } = await supabase
      .from('playlists')
      .select('id, name')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setPlaylists((data ?? []) as Playlist[]);
    setCurrentSongIdForPL(resolvedId);
    setShowPLModal(true);
  }, [savedId, session, navigate, handleSave]);

  const addToPlaylist = useCallback(async (playlistId: string) => {
    if (!currentSongIdForPL || !session) return;
    setAddingPL(true);
    try {
      // Get max position in this playlist
      const { data: posData } = await supabase
        .from('playlist_songs')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1);
      const nextPosition = posData && posData.length > 0 ? (posData[0].position ?? 0) + 1 : 0;

      const { error } = await supabase
        .from('playlist_songs')
        .insert({
          playlist_id: playlistId,
          song_id:     currentSongIdForPL,
          position:    nextPosition,
        });
      if (error) throw error;
      setShowPLModal(false);
      alert(t('playlist_added'));
    } catch (err) {
      console.error('Playlist add error:', err);
      alert(t('playlist_add_error'));
    } finally {
      setAddingPL(false);
    }
  }, [currentSongIdForPL, session, t]);

  if (loading) {
    return (
      <div style={centerStyle}>
        <div style={spinnerStyle} />
        <p style={{ color: 'var(--text3)' }}>{t('loading')}</p>
      </div>
    );
  }

  if (!song) {
    return (
      <div style={centerStyle}>
        <p style={{ color: '#cc3333' }}>{t('error_load')}</p>
        <button onClick={() => navigate(-1)} style={linkBtnStyle}>{t('retry')}</button>
      </div>
    );
  }

  const displayData = applyTranspose(song.chords_data, semitones);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg)' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        gap: 8,
        backgroundColor: 'var(--bg)',
      }}>
        <button onClick={() => navigate(-1)} style={{ ...iconBtnStyle, fontSize: 22, color: 'var(--accent)' }}>
          {isRTL ? '→' : '←'}
        </button>

        <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{song.song_title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{song.artist}</div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...saveBtnStyle,
            backgroundColor: saving ? '#aaa' : 'var(--accent)',
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
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: 6,
      }}>
        {/* Font size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            style={{ ...toolBtnStyle, opacity: fontSize <= FONT_SIZES[0] ? 0.4 : 1 }}
            onClick={() => setFontSize(s => FONT_SIZES[Math.max(0, FONT_SIZES.indexOf(s) - 1)])}
            disabled={fontSize <= FONT_SIZES[0]}
          >A−</button>
          <button
            style={{ ...toolBtnStyle, opacity: fontSize >= FONT_SIZES[FONT_SIZES.length - 1] ? 0.4 : 1 }}
            onClick={() => setFontSize(s => FONT_SIZES[Math.min(FONT_SIZES.length - 1, FONT_SIZES.indexOf(s) + 1)])}
            disabled={fontSize >= FONT_SIZES[FONT_SIZES.length - 1]}
          >A+</button>
        </div>

        {/* Transpose */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button style={toolBtnStyle} onClick={() => setSemitones((s) => Math.max(-11, s - 1))}>
            {t('transpose_down')}
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: 'center', color: 'var(--text)' }}>
            {semitones > 0 ? `+${semitones}` : `${semitones}`}
          </span>
          <button style={toolBtnStyle} onClick={() => setSemitones((s) => Math.min(11, s + 1))}>
            {t('transpose_up')}
          </button>
          {semitones !== 0 && (
            <button style={{ ...toolBtnStyle, borderColor: 'var(--border)', color: 'var(--text3)' }} onClick={() => setSemitones(0)}>
              {t('transpose_reset')}
            </button>
          )}
        </div>

        {/* Scroll + Share + Playlist */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Speed controls — always visible so user can set before starting */}
          <button
            style={{ ...toolBtnStyle, opacity: speedIndex === 0 ? 0.4 : 1 }}
            onClick={() => adjustSpeed(-1)}
            disabled={speedIndex === 0}
            title="Slower"
          >−</button>
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 32, textAlign: 'center', color: 'var(--text)' }}>
            {`×${SCROLL_SPEEDS[speedIndex].toFixed(1)}`}
          </span>
          <button
            style={{ ...toolBtnStyle, opacity: speedIndex === SCROLL_SPEEDS.length - 1 ? 0.4 : 1 }}
            onClick={() => adjustSpeed(1)}
            disabled={speedIndex === SCROLL_SPEEDS.length - 1}
            title="Faster"
          >+</button>

          <button
            style={{ ...toolBtnStyle, backgroundColor: scrolling ? 'var(--accent)' : 'var(--bg)', color: scrolling ? '#fff' : 'var(--accent)' }}
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
        <ChordDisplay data={displayData} fontSize={fontSize} />
      </div>

      {/* Add-to-playlist modal */}
      {showPLModal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, backgroundColor: 'var(--card-bg)' }}>
            <h3 style={{ textAlign: isRTL ? 'right' : 'left', margin: 0, color: 'var(--text)' }}>
              {t('add_to_playlist_title')}
            </h3>

            {playlists.length === 0 ? (
              <p style={{ color: 'var(--text3)', textAlign: 'center' }}>{t('no_playlists')}</p>
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
                        borderBottom: '1px solid var(--border2)',
                        fontSize: 15,
                        textAlign: isRTL ? 'right' : 'left',
                        cursor: 'pointer',
                        color: 'var(--text)',
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

const centerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', height: '80vh', gap: 12,
};

const spinnerStyle: React.CSSProperties = {
  width: 36, height: 36,
  border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--accent)', fontSize: 14,
  fontWeight: 600, cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  paddingInline: 12, paddingBlock: 7, color: '#fff', border: 'none',
  borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const toolBtnStyle: React.CSSProperties = {
  paddingInline: 9, paddingBlock: 5, borderRadius: 6,
  border: '1px solid var(--accent)', backgroundColor: 'var(--bg)',
  color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  width: '100%', maxWidth: 400,
  borderRadius: 12, padding: 20, display: 'flex',
  flexDirection: 'column', gap: 14, maxHeight: '70vh',
};
