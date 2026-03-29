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

const SCROLL_SPEEDS = [0.2, 0.4, 0.6, 0.9, 1.4];

type Song = {
  id: string;
  song_title: string;
  artist: string;
  language: string;
  chords_data: ChordLine[];
  raw_url?: string;
};

type Playlist = { id: string; name: string };

// ---------------------------------------------------------------------------
// Inline chord editor row
// ---------------------------------------------------------------------------

function EditorRow({
  line, idx, total, isRTL, t,
  onChange, onTypeChange, onMove, onDelete, onAddAfter,
}: {
  line: ChordLine;
  idx: number;
  total: number;
  isRTL: boolean;
  t: (key: string) => string;
  onChange: (idx: number, content: string) => void;
  onTypeChange: (idx: number, type: ChordLine['type']) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onDelete: (idx: number) => void;
  onAddAfter: (idx: number) => void;
}) {
  const typeColor =
    line.type === 'chords'  ? 'var(--accent)' :
    line.type === 'section' ? 'var(--text2)'  : 'var(--text)';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        {/* Type selector */}
        <select
          value={line.type}
          onChange={e => onTypeChange(idx, e.target.value as ChordLine['type'])}
          style={{
            fontSize: 11, fontWeight: 700, border: '1px solid var(--border)',
            borderRadius: 5, padding: '2px 4px', backgroundColor: 'var(--surface)',
            color: typeColor, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <option value="chords">{t('type_chords')}</option>
          <option value="lyrics">{t('type_lyrics')}</option>
          <option value="section">{t('type_section')}</option>
        </select>

        {/* Content input */}
        <input
          type="text"
          value={line.content}
          onChange={e => onChange(idx, e.target.value)}
          dir={line.type !== 'chords' && isRTL ? 'rtl' : 'ltr'}
          style={{
            flex: 1,
            height: 36,
            border: '1px solid var(--border)',
            borderRadius: 6,
            paddingInline: 8,
            fontSize: 14,
            fontFamily: line.type === 'chords' ? 'monospace' : 'inherit',
            backgroundColor: 'var(--input-bg)',
            color: typeColor,
            outline: 'none',
          }}
        />

        {/* Reorder */}
        <button
          onClick={() => onMove(idx, -1)}
          disabled={idx === 0}
          title="Move up"
          style={{ ...rowIconBtn, opacity: idx === 0 ? 0.3 : 1 }}
        >↑</button>
        <button
          onClick={() => onMove(idx, 1)}
          disabled={idx === total - 1}
          title="Move down"
          style={{ ...rowIconBtn, opacity: idx === total - 1 ? 0.3 : 1 }}
        >↓</button>

        {/* Delete */}
        <button
          onClick={() => onDelete(idx)}
          title="Delete line"
          style={{ ...rowIconBtn, color: '#cc3333' }}
        >✕</button>
      </div>

      {/* Insert line button (shown between rows) */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }}>
        <button
          onClick={() => onAddAfter(idx)}
          style={{
            fontSize: 11, color: 'var(--text3)', background: 'none',
            border: '1px dashed var(--border)', borderRadius: 4,
            padding: '1px 10px', cursor: 'pointer',
          }}
        >+</button>
      </div>
    </div>
  );
}

const rowIconBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text2)', fontSize: 13,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, padding: 0,
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SongDetailPage() {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const { t, i18n }    = useTranslation();
  const session        = useSession();
  const [isRTL, setIsRTL] = useState(i18n.language === 'he');

  const [song,     setSong]     = useState<Song | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [savedId,  setSavedId]  = useState<string | null>(null);
  const [semitones, setSemitones] = useState(0);
  const [fontSize,  setFontSize]  = useState(1.0);
  const FONT_SIZES = [0.8, 1.0, 1.2, 1.4, 1.6, 1.8];

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollOffset  = useRef(0);
  const scrollTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scrolling,   setScrolling]  = useState(false);
  const [speedIndex,  setSpeedIndex] = useState(1);

  const [playlists,          setPlaylists]          = useState<Playlist[]>([]);
  const [showPLModal,        setShowPLModal]        = useState(false);
  const [addingPL,           setAddingPL]           = useState(false);
  const [currentSongIdForPL, setCurrentSongIdForPL] = useState<string | null>(null);

  // Editor state
  const [editMode,   setEditMode]   = useState(false);
  const [editData,   setEditData]   = useState<ChordLine[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!id) return;
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
        // Not in cached_chords — try the user's songs table (from playlist navigation)
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
          setSavedId(saved.id); // already saved — enable edit button immediately
          setIsRTL(s.language === 'he');
        }
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    return () => { if (scrollTimer.current) clearInterval(scrollTimer.current); };
  }, []);

  // ---------------------------------------------------------------------------
  // Save to songs table
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async (silent = false): Promise<string | null> => {
    if (!song) return null;
    if (!session) { navigate('/login'); return null; }
    if (savedId) { if (!silent) alert(t('saved')); return savedId; }
    setSaving(true);
    try {
      // Check if already saved (handles page-refresh case where state is lost)
      const { data: existing } = await supabase
        .from('songs')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('title', song.song_title)
        .eq('artist', song.artist)
        .maybeSingle();
      if (existing) {
        setSavedId(existing.id);
        if (!silent) alert(t('saved'));
        return existing.id;
      }

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
      if (!silent) alert(t('save_error'));
      return null;
    } finally {
      setSaving(false);
    }
  }, [song, session, navigate, t, savedId]);

  // ---------------------------------------------------------------------------
  // Chord editor callbacks
  // ---------------------------------------------------------------------------

  const enterEdit = useCallback(() => {
    if (!song) return;
    setEditData(song.chords_data.map(l => ({ ...l })));
    setEditMode(true);
    // Stop auto-scroll while editing
    if (scrollTimer.current) clearInterval(scrollTimer.current);
    scrollTimer.current = null;
    setScrolling(false);
  }, [song]);

  const cancelEdit = useCallback(() => setEditMode(false), []);

  const updateContent = useCallback((idx: number, content: string) => {
    setEditData(d => d.map((l, i) => i === idx ? { ...l, content } : l));
  }, []);

  const updateType = useCallback((idx: number, type: ChordLine['type']) => {
    setEditData(d => d.map((l, i) => i === idx ? { ...l, type } : l));
  }, []);

  const moveLine = useCallback((idx: number, dir: -1 | 1) => {
    setEditData(d => {
      const next = [...d];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return d;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }, []);

  const deleteLine = useCallback((idx: number) => {
    setEditData(d => d.filter((_, i) => i !== idx));
  }, []);

  const addLineAfter = useCallback((idx: number) => {
    setEditData(d => {
      const next = [...d];
      next.splice(idx + 1, 0, { type: 'lyrics', content: '' });
      return next;
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!savedId) return;
    // Remove empty lines before saving
    const cleaned = editData.filter(l => l.content.trim() !== '');
    setSavingEdit(true);
    const { error } = await supabase
      .from('songs')
      .update({ chords_data: cleaned })
      .eq('id', savedId);
    setSavingEdit(false);
    if (error) {
      console.error('Edit save error:', error);
      alert(t('save_error'));
      return;
    }
    setSong(prev => prev ? { ...prev, chords_data: cleaned } : prev);
    setEditMode(false);
  }, [savedId, editData, t]);

  // ---------------------------------------------------------------------------
  // Scroll / share / playlist
  // ---------------------------------------------------------------------------

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
      const { data: posData } = await supabase
        .from('playlist_songs')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1);
      const nextPosition = posData && posData.length > 0 ? (posData[0].position ?? 0) + 1 : 0;
      const { error } = await supabase
        .from('playlist_songs')
        .insert({ playlist_id: playlistId, song_id: currentSongIdForPL, position: nextPosition });
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        gap: 8,
        backgroundColor: 'var(--bg)',
      }}>
        <button onClick={() => { if (editMode) cancelEdit(); else navigate(-1); }}
          style={{ ...iconBtnStyle, fontSize: 22, color: 'var(--accent)' }}>
          {editMode ? '✕' : (isRTL ? '→' : '←')}
        </button>

        <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{song.song_title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{song.artist}</div>
        </div>

        {/* Edit button — only when song is saved */}
        {savedId && !editMode && (
          <button onClick={enterEdit} style={{ ...toolBtnStyle, borderColor: 'var(--border)', color: 'var(--text2)' }}>
            {t('edit_chords')}
          </button>
        )}

        {/* Save to library button */}
        {!editMode && (
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !!savedId}
            style={{
              ...saveBtnStyle,
              backgroundColor: savedId ? '#4caf50' : saving ? '#aaa' : 'var(--accent)',
            }}
          >
            {saving ? t('saving') : savedId ? '✓' : t('save_song')}
          </button>
        )}

        {/* Save edits button */}
        {editMode && (
          <button
            onClick={saveEdit}
            disabled={savingEdit}
            style={{ ...saveBtnStyle, backgroundColor: savingEdit ? '#aaa' : 'var(--accent)' }}
          >
            {savingEdit ? '…' : t('edit_save')}
          </button>
        )}
      </div>

      {/* ── Toolbar (hidden in edit mode) ── */}
      {!editMode && (
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
            <button style={toolBtnStyle} onClick={() => setSemitones(s => Math.max(-11, s - 1))}>
              {t('transpose_down')}
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: 'center', color: 'var(--text)' }}>
              {semitones > 0 ? `+${semitones}` : `${semitones}`}
            </span>
            <button style={toolBtnStyle} onClick={() => setSemitones(s => Math.min(11, s + 1))}>
              {t('transpose_up')}
            </button>
            {semitones !== 0 && (
              <button style={{ ...toolBtnStyle, borderColor: 'var(--border)', color: 'var(--text3)' }} onClick={() => setSemitones(0)}>
                {t('transpose_reset')}
              </button>
            )}
          </div>

          {/* Scroll + share + playlist */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button style={{ ...toolBtnStyle, opacity: speedIndex === 0 ? 0.4 : 1 }}
              onClick={() => adjustSpeed(-1)} disabled={speedIndex === 0}>−</button>
            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 32, textAlign: 'center', color: 'var(--text)' }}>
              {`×${SCROLL_SPEEDS[speedIndex].toFixed(1)}`}
            </span>
            <button style={{ ...toolBtnStyle, opacity: speedIndex === SCROLL_SPEEDS.length - 1 ? 0.4 : 1 }}
              onClick={() => adjustSpeed(1)} disabled={speedIndex === SCROLL_SPEEDS.length - 1}>+</button>
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
      )}

      {/* ── Chord sheet / Editor ── */}
      <div
        ref={scrollAreaRef}
        style={{ flex: 1, overflowY: 'auto' }}
        onScroll={e => { scrollOffset.current = (e.target as HTMLDivElement).scrollTop; }}
      >
        {editMode ? (
          /* ── Editor ── */
          <div style={{ padding: '12px 12px 80px' }}>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, direction: isRTL ? 'rtl' : 'ltr' }}>
              {isRTL
                ? 'ערוך שורות, שנה סוג (אקורדים / מילים / קטע), הזז למעלה/למטה, מחק.'
                : 'Edit lines, change type (Chords / Lyrics / Section), reorder or delete.'}
            </p>

            {/* Insert-before-first button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
              <button
                onClick={() => setEditData(d => [{ type: 'lyrics', content: '' }, ...d])}
                style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: '1px dashed var(--border)', borderRadius: 4, padding: '1px 10px', cursor: 'pointer' }}
              >+</button>
            </div>

            {editData.map((line, idx) => (
              <EditorRow
                key={idx}
                line={line}
                idx={idx}
                total={editData.length}
                isRTL={isRTL}
                t={t as (key: string) => string}
                onChange={updateContent}
                onTypeChange={updateType}
                onMove={moveLine}
                onDelete={deleteLine}
                onAddAfter={addLineAfter}
              />
            ))}

            {editData.length === 0 && (
              <button
                onClick={() => setEditData([{ type: 'lyrics', content: '' }])}
                style={{ ...toolBtnStyle, display: 'block', margin: '20px auto' }}
              >
                {t('add_line')}
              </button>
            )}
          </div>
        ) : (
          /* ── Normal chord sheet ── */
          <ChordDisplay data={displayData} fontSize={fontSize} isRTL={isRTL} />
        )}
      </div>

      {/* ── Add-to-playlist modal ── */}
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
                        width: '100%', padding: '12px 0', background: 'none',
                        border: 'none', borderBottom: '1px solid var(--border2)',
                        fontSize: 15, textAlign: isRTL ? 'right' : 'left',
                        cursor: 'pointer', color: 'var(--text)',
                      }}
                    >
                      {pl.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setShowPLModal(false)} style={{ alignSelf: 'flex-end', ...toolBtnStyle }}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
