import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  I18nManager,
  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { supabase } from '../../lib/supabase';
import ChordDisplay, { ChordLine } from '../../components/ChordDisplay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CachedChord = {
  id: string;
  song_title: string;
  artist: string;
  language: string;
  source: string;
  chords_data: ChordLine[];
  raw_url: string | null;
};

type Playlist = { id: string; name: string };
type Status   = 'loading' | 'done' | 'error';

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
    // Split off bass note if present (e.g. C/E → C and E)
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
// Auto-scroll speeds (pixels per tick)
// ---------------------------------------------------------------------------

const SCROLL_SPEEDS = [0.5, 1, 1.5, 2.5, 4]; // px per 50ms tick

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t }  = useTranslation();
  const isRTL  = I18nManager.isRTL;

  const [song,      setSong]      = useState<CachedChord | null>(null);
  const [status,    setStatus]    = useState<Status>('loading');
  const [saving,    setSaving]    = useState(false);
  const [savedId,   setSavedId]   = useState<string | null>(null); // song_id after save

  // Transpose
  const [semitones, setSemitones] = useState(0);

  // Font size (multiplier: 0.75 → 1.5)
  const FONT_SIZES = [0.75, 0.875, 1.0, 1.25, 1.5];
  const [fontIdx, setFontIdx] = useState(2); // default = 1.0×

  // Auto-scroll
  const scrollRef    = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const scrollTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scrolling,   setScrolling]   = useState(false);
  const [speedIndex,  setSpeedIndex]  = useState(1); // index into SCROLL_SPEEDS

  // Add-to-playlist modal
  const [playlists,       setPlaylists]       = useState<Playlist[]>([]);
  const [playlistModal,   setPlaylistModal]   = useState(false);
  const [addingPlaylist,  setAddingPlaylist]  = useState(false);

  // ---------------------------------------------------------------------------
  // Load song
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;

    supabase
      .from('cached_chords')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setStatus('error');
        } else {
          setSong(data as CachedChord);
          setStatus('done');
        }
      });
  }, [id]);

  // Cleanup scroll timer on unmount
  useEffect(() => {
    return () => { if (scrollTimer.current) clearInterval(scrollTimer.current); };
  }, []);

  // ---------------------------------------------------------------------------
  // Save song to library
  // ---------------------------------------------------------------------------

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
      Alert.alert(t('saved'));
    } catch {
      Alert.alert(t('save_error'));
    } finally {
      setSaving(false);
    }
  }, [song, t]);

  // ---------------------------------------------------------------------------
  // Transpose
  // ---------------------------------------------------------------------------

  const adjustTranspose = useCallback((delta: number) => {
    setSemitones((prev) => {
      const next = Math.max(-11, Math.min(11, prev + delta));
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-scroll
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
        scrollRef.current?.scrollTo({ y: scrollOffset.current, animated: false });
      }, 50);
    }
  }, [scrolling, speedIndex]);

  const cycleSpeed = useCallback(() => {
    // Stop scroll, change speed, restart
    if (scrollTimer.current) clearInterval(scrollTimer.current);
    scrollTimer.current = null;
    const nextIdx = (speedIndex + 1) % SCROLL_SPEEDS.length;
    setSpeedIndex(nextIdx);
    if (scrolling) {
      scrollTimer.current = setInterval(() => {
        scrollOffset.current += SCROLL_SPEEDS[nextIdx];
        scrollRef.current?.scrollTo({ y: scrollOffset.current, animated: false });
      }, 50);
    }
  }, [scrolling, speedIndex]);

  // ---------------------------------------------------------------------------
  // Share
  // ---------------------------------------------------------------------------

  const handleShare = useCallback(async () => {
    if (!song) return;
    try {
      const message = t('share_message', { title: song.song_title, artist: song.artist });
      await Share.share({ message });
    } catch {
      // User cancelled or error — no alert needed
    }
  }, [song, t]);

  // ---------------------------------------------------------------------------
  // Add to playlist
  // ---------------------------------------------------------------------------

  const openPlaylistModal = useCallback(async () => {
    // Auto-save first if not yet saved
    let currentSavedId = savedId;
    if (!currentSavedId && song) {
      try {
        setSaving(true);
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
        currentSavedId = saved.id;
        setSavedId(saved.id);
      } catch {
        Alert.alert(t('save_error'));
        return;
      } finally {
        setSaving(false);
      }
    }

    // Load playlists
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('playlists')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setPlaylists((data ?? []) as Playlist[]);
    setPlaylistModal(true);
  }, [savedId, song, t]);

  const handleAddToPlaylist = useCallback(async (playlistId: string) => {
    if (!savedId) return;
    setAddingPlaylist(true);
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

      if (!resp.ok) throw new Error('Add failed');
      setPlaylistModal(false);
      Alert.alert(t('playlist_added'));
    } catch {
      Alert.alert(t('playlist_add_error'));
    } finally {
      setAddingPlaylist(false);
    }
  }, [savedId, t]);

  // ---------------------------------------------------------------------------
  // Render — loading / error
  // ---------------------------------------------------------------------------

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </SafeAreaView>
    );
  }

  if (status === 'error' || !song) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{t('error_load')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const displayData = applyTranspose(song.chords_data, semitones);

  // ---------------------------------------------------------------------------
  // Render — main
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header row 1: back + title + save ── */}
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>{isRTL ? '→' : '←'}</Text>
        </TouchableOpacity>

        <View style={[styles.headerMeta, isRTL && styles.headerMetaRTL]}>
          <Text style={[styles.songTitle, isRTL && styles.textRTL]} numberOfLines={1}>
            {song.song_title}
          </Text>
          <Text style={[styles.songArtist, isRTL && styles.textRTL]} numberOfLines={1}>
            {song.artist}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t('saving') : savedId ? '✓' : t('save_song')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Toolbar row 2: transpose + auto-scroll + share + playlist ── */}
      <View style={[styles.toolbar, isRTL && styles.toolbarRTL]}>

        {/* Transpose controls */}
        <View style={styles.transposeGroup}>
          <TouchableOpacity style={styles.toolBtn} onPress={() => adjustTranspose(-1)}>
            <Text style={styles.toolBtnText}>{t('transpose_down')}</Text>
          </TouchableOpacity>
          <Text style={styles.semitoneLabel}>
            {semitones > 0 ? `+${semitones}` : `${semitones}`}
          </Text>
          <TouchableOpacity style={styles.toolBtn} onPress={() => adjustTranspose(1)}>
            <Text style={styles.toolBtnText}>{t('transpose_up')}</Text>
          </TouchableOpacity>
          {semitones !== 0 && (
            <TouchableOpacity style={styles.toolBtnSmall} onPress={() => setSemitones(0)}>
              <Text style={styles.toolBtnSmallText}>{t('transpose_reset')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.toolbarRight}>
          {/* Font size controls */}
          <TouchableOpacity
            style={[styles.toolBtn, fontIdx === 0 && styles.toolBtnDisabled]}
            onPress={() => setFontIdx((i) => Math.max(0, i - 1))}
            disabled={fontIdx === 0}
          >
            <Text style={styles.toolBtnText}>{t('font_size_decrease')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, fontIdx === FONT_SIZES.length - 1 && styles.toolBtnDisabled]}
            onPress={() => setFontIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
            disabled={fontIdx === FONT_SIZES.length - 1}
          >
            <Text style={styles.toolBtnText}>{t('font_size_increase')}</Text>
          </TouchableOpacity>

          {/* Auto-scroll speed (only shown when scrolling) */}
          {scrolling && (
            <TouchableOpacity style={styles.toolBtn} onPress={cycleSpeed}>
              <Text style={styles.toolBtnText}>
                {`×${SCROLL_SPEEDS[speedIndex]}`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Auto-scroll toggle */}
          <TouchableOpacity
            style={[styles.toolBtn, scrolling && styles.toolBtnActive]}
            onPress={toggleScroll}
          >
            <Text style={[styles.toolBtnText, scrolling && styles.toolBtnActiveText]}>
              {scrolling ? t('auto_scroll_stop') : t('auto_scroll_start')}
            </Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.iconToolBtn} onPress={handleShare}>
            <Text style={styles.toolBtnText}>{t('share')}</Text>
          </TouchableOpacity>

          {/* Add to playlist */}
          <TouchableOpacity style={styles.iconToolBtn} onPress={openPlaylistModal}>
            <Text style={styles.toolBtnText}>{t('add_to_playlist')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Chord sheet ── */}
      <ChordDisplay
        data={displayData}
        scrollRef={scrollRef}
        onScroll={(y) => { scrollOffset.current = y; }}
        fontSize={FONT_SIZES[fontIdx]}
      />

      {/* ── Add-to-playlist modal ── */}
      <Modal
        visible={playlistModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPlaylistModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>
              {t('add_to_playlist_title')}
            </Text>

            {playlists.length === 0 ? (
              <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
                {t('no_playlists')}
              </Text>
            ) : (
              <FlatList
                data={playlists}
                keyExtractor={(p) => p.id}
                style={styles.playlistList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.playlistRow, isRTL && styles.playlistRowRTL]}
                    onPress={() => handleAddToPlaylist(item.id)}
                    disabled={addingPlaylist}
                  >
                    <Text style={[styles.playlistName, isRTL && styles.textRTL]}>
                      {item.name}
                    </Text>
                    {addingPlaylist && <ActivityIndicator size="small" color="#4285F4" />}
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setPlaylistModal(false)}
            >
              <Text style={styles.modalCancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  loadingText: { fontSize: 14, color: '#888' },
  errorText:   { fontSize: 15, color: '#cc3333' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  headerRTL: { flexDirection: 'row-reverse' },

  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 22, color: '#4285F4' },

  headerMeta:    { flex: 1, gap: 2 },
  headerMetaRTL: { alignItems: 'flex-end' },

  songTitle:  { fontSize: 15, fontWeight: '700', color: '#111' },
  songArtist: { fontSize: 12, color: '#666' },

  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#4285F4',
    borderRadius: 7,
  },
  saveBtnDisabled: { backgroundColor: '#aaa' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    flexWrap: 'wrap',
    gap: 6,
  },
  toolbarRTL: { flexDirection: 'row-reverse' },

  transposeGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolbarRight:   { flexDirection: 'row', alignItems: 'center', gap: 4 },

  toolBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4285F4',
    backgroundColor: '#fff',
  },
  toolBtnActive:    { backgroundColor: '#4285F4' },
  toolBtnDisabled:  { borderColor: '#ccc', opacity: 0.4 },
  toolBtnText:   { fontSize: 12, color: '#4285F4', fontWeight: '600' },
  toolBtnActiveText: { color: '#fff' },

  toolBtnSmall: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  toolBtnSmallText: { fontSize: 11, color: '#888' },

  iconToolBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4285F4',
    backgroundColor: '#fff',
  },

  semitoneLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    minWidth: 28,
    textAlign: 'center',
  },

  backBtn:     { padding: 8 },
  backBtnText: { fontSize: 22, color: '#4285F4' },

  textRTL: { writingDirection: 'rtl', textAlign: 'right' },

  // Playlist modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modal: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    gap: 14,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  emptyText:  { fontSize: 14, color: '#888', textAlign: 'center', paddingVertical: 12 },
  playlistList: { maxHeight: 240 },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  playlistRowRTL: { flexDirection: 'row-reverse' },
  playlistName:   { fontSize: 15, color: '#111' },
  modalCancelBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalCancelText: { color: '#555', fontWeight: '500' },
});
