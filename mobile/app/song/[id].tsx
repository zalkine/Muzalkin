import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import ChordDisplay, { ChordLine } from '../../components/ChordDisplay';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SongData = {
  id: string;
  title: string;
  artist: string;
  instrument: string;
  language: string;
  transpose: number;
  chords_data: ChordLine[];
  source_url?: string;
};

type Playlist = {
  id: string;
  name: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

/** Fetch song data — handles new web fetch, saved songs, and cached chords. */
async function loadSong(
  id: string,
  title?: string,
  artist?: string,
  lang?: string,
): Promise<SongData | null> {
  // New song: fetch from backend (chord_router scrapes + caches automatically)
  if (id === 'new') {
    if (!title || !artist) return null;
    try {
      const params = new URLSearchParams({ title, artist, lang: lang ?? 'he' });
      const res = await fetch(`${API_URL}/chords?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        id: 'new',
        title,
        artist,
        instrument: 'guitar',
        language: lang ?? 'he',
        transpose: 0,
        chords_data: data.chords_data,
        source_url: data.raw_url,
      };
    } catch {
      return null;
    }
  }

  // 1. Try saved songs table
  const { data: saved } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .single();
  if (saved) return saved as SongData;

  // 2. Try cached_chords table
  const { data: cached } = await supabase
    .from('cached_chords')
    .select('*')
    .eq('id', id)
    .single();
  if (cached) {
    return {
      id: cached.id,
      title: cached.song_title,
      artist: cached.artist,
      instrument: 'guitar',
      language: cached.language,
      transpose: 0,
      chords_data: cached.chords_data,
      source_url: cached.raw_url,
    };
  }

  return null;
}

/** Persist song to songs table, return the saved row's id. */
async function saveSong(song: SongData, semitones: number): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('songs')
    .upsert(
      {
        user_id:   user.id,
        title:     song.title,
        artist:    song.artist,
        language:  song.language,
        chords_data: song.chords_data,
        source_url:  song.source_url,
        instrument: song.instrument,
        transpose:  semitones,
      },
      { onConflict: 'user_id,title,artist' },
    )
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

/** Fetch user's playlists. */
async function fetchPlaylists(): Promise<Playlist[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('playlists')
    .select('id, name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (data ?? []) as Playlist[];
}

/** Add a song to a playlist. Song is saved first if needed. */
async function addToPlaylist(
  song: SongData,
  semitones: number,
  playlistId: string,
): Promise<void> {
  // Ensure song is saved first
  let songId = song.id !== 'new' ? song.id : null;
  if (!songId) {
    songId = await saveSong(song, semitones);
  }

  // Get current max position in playlist
  const { data: existing } = await supabase
    .from('playlist_songs')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = ((existing?.[0]?.position as number) ?? 0) + 1;

  const { error } = await supabase.from('playlist_songs').insert({
    playlist_id: playlistId,
    song_id:     songId,
    position:    nextPosition,
  });

  if (error) throw error;
}

/** Create a new playlist with the given name. */
async function createPlaylist(name: string): Promise<Playlist> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('playlists')
    .insert({ user_id: user.id, name, is_public: false })
    .select('id, name')
    .single();

  if (error) throw error;
  return data as Playlist;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SongScreen() {
  const { id, title, artist, lang } = useLocalSearchParams<{
    id: string;
    title?: string;
    artist?: string;
    lang?: string;
  }>();
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  const scrollRef        = useRef<ScrollView>(null);
  const autoScrollTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [song,        setSong]        = useState<SongData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [semitones,   setSemitones]   = useState(0);
  const [autoScroll,  setAutoScroll]  = useState(false);
  const [saving,      setSaving]      = useState(false);

  // Edit mode
  const [editMode,    setEditMode]    = useState(false);
  const [editedLines, setEditedLines] = useState<ChordLine[]>([]);

  // Playlist modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlists,         setPlaylists]         = useState<Playlist[]>([]);
  const [newPlaylistName,   setNewPlaylistName]   = useState('');
  const [showNewInput,      setShowNewInput]      = useState(false);
  const [playlistLoading,   setPlaylistLoading]   = useState(false);

  // Load song on mount
  useEffect(() => {
    if (!id) return;
    loadSong(id, title, artist, lang)
      .then((data) => {
        setSong(data);
        if (data) {
          setSemitones(data.transpose ?? 0);
          setEditedLines(data.chords_data);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll) {
      autoScrollTimer.current = setInterval(() => {
        scrollRef.current?.scrollTo({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          y: (scrollRef.current as any)?._contentOffset?.y + 1 ?? 0,
          animated: false,
        });
      }, 50);
    } else {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
        autoScrollTimer.current = null;
      }
    }
    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, [autoScroll]);

  const handleTranspose = useCallback((delta: number) => {
    setSemitones((prev) => Math.max(-6, Math.min(6, prev + delta)));
  }, []);

  // ── Save song ──
  const handleSave = useCallback(async () => {
    if (!song) return;
    setSaving(true);
    try {
      const savedId = await saveSong(
        editMode ? { ...song, chords_data: editedLines } : song,
        semitones,
      );
      // Update local id so subsequent saves don't create duplicates
      setSong((prev) => prev ? { ...prev, id: savedId } : prev);
      Alert.alert(t('save_song'), t('song_saved_ok'));
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [song, semitones, editMode, editedLines, t]);

  // ── Edit mode ──
  const handleToggleEdit = useCallback(() => {
    if (editMode) {
      // Committing edits: update song data
      setSong((prev) => prev ? { ...prev, chords_data: editedLines } : prev);
    } else {
      setEditedLines(song?.chords_data ?? []);
    }
    setEditMode((v) => !v);
  }, [editMode, editedLines, song]);

  const handleEditLine = useCallback((index: number, content: string) => {
    setEditedLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], content };
      return next;
    });
  }, []);

  // ── Add to playlist ──
  const handleOpenPlaylist = useCallback(async () => {
    setPlaylistLoading(true);
    setShowPlaylistModal(true);
    setNewPlaylistName('');
    setShowNewInput(false);
    try {
      const data = await fetchPlaylists();
      setPlaylists(data);
    } finally {
      setPlaylistLoading(false);
    }
  }, []);

  const handleSelectPlaylist = useCallback(
    async (playlistId: string) => {
      if (!song) return;
      setShowPlaylistModal(false);
      setSaving(true);
      try {
        await addToPlaylist(
          editMode ? { ...song, chords_data: editedLines } : song,
          semitones,
          playlistId,
        );
        Alert.alert(t('add_to_playlist'), t('added_to_playlist_ok'));
      } catch (e) {
        Alert.alert('Error', (e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [song, semitones, editMode, editedLines, t],
  );

  const handleCreateAndAdd = useCallback(async () => {
    const name = newPlaylistName.trim();
    if (!name || !song) return;
    setShowPlaylistModal(false);
    setSaving(true);
    try {
      const pl = await createPlaylist(name);
      await addToPlaylist(
        editMode ? { ...song, chords_data: editedLines } : song,
        semitones,
        pl.id,
      );
      Alert.alert(t('add_to_playlist'), t('added_to_playlist_ok'));
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
      setNewPlaylistName('');
    }
  }, [newPlaylistName, song, semitones, editMode, editedLines, t]);

  // ── Render: loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: not found ──
  if (!song) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('error_fetch')}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>{isRTL ? 'חיפוש →' : '← ' + t('search')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: song ──
  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>{isRTL ? '→' : '←'}</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.songTitle, isRTL && styles.textRTL]} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={[styles.songArtist, isRTL && styles.textRTL]} numberOfLines={1}>
            {song.artist}
          </Text>
        </View>

        {/* Action buttons in header */}
        <View style={[styles.headerActions, isRTL && styles.headerActionsRTL]}>
          {/* Edit toggle */}
          <TouchableOpacity
            style={[styles.iconBtn, editMode && styles.iconBtnActive]}
            onPress={handleToggleEdit}
          >
            <Text style={[styles.iconBtnText, editMode && styles.iconBtnTextActive]}>
              {editMode ? t('done') : t('edit')}
            </Text>
          </TouchableOpacity>

          {/* Add to playlist */}
          <TouchableOpacity
            style={[styles.iconBtn, saving && styles.iconBtnDisabled]}
            onPress={handleOpenPlaylist}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <Text style={styles.iconBtnEmoji}>📋</Text>
            )}
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity
            style={[styles.iconBtn, saving && styles.iconBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <Text style={styles.iconBtnEmoji}>💾</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Toolbar ── */}
      <View style={[styles.toolbar, isRTL && styles.toolbarRTL]}>
        {/* Transpose */}
        <View style={styles.transposeRow}>
          <TouchableOpacity
            style={[styles.transposeBtn, semitones <= -6 && styles.transposeBtnDisabled]}
            onPress={() => handleTranspose(-1)}
            disabled={semitones <= -6}
          >
            <Text style={styles.transposeBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.transposeLabel}>
            {t('transpose')} {semitones > 0 ? `+${semitones}` : semitones}
          </Text>
          <TouchableOpacity
            style={[styles.transposeBtn, semitones >= 6 && styles.transposeBtnDisabled]}
            onPress={() => handleTranspose(1)}
            disabled={semitones >= 6}
          >
            <Text style={styles.transposeBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Auto-scroll */}
        <TouchableOpacity
          style={[styles.autoScrollBtn, autoScroll && styles.autoScrollBtnActive]}
          onPress={() => setAutoScroll((v) => !v)}
        >
          <Text style={[styles.autoScrollText, autoScroll && styles.autoScrollTextActive]}>
            {t('auto_scroll')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Chord display OR Edit mode ── */}
      {editMode ? (
        <ScrollView style={styles.editScroll} contentContainerStyle={styles.editContent}>
          {editedLines.map((line, i) => (
            <View key={i} style={styles.editRow}>
              <View style={[styles.editTypeBadge, styles[`editType_${line.type}` as keyof typeof styles] ?? styles.editType_lyrics]}>
                <Text style={styles.editTypeText}>
                  {line.type === 'chords' ? '♩' : line.type === 'section' ? '§' : '♪'}
                </Text>
              </View>
              <TextInput
                style={[styles.editInput, isRTL && styles.editInputRTL]}
                value={line.content}
                onChangeText={(v) => handleEditLine(i, v)}
                textAlign={isRTL ? 'right' : 'left'}
                multiline={false}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <ChordDisplay
          ref={scrollRef}
          data={song.chords_data}
          semitones={semitones}
          fontSize={16}
        />
      )}

      {/* ── Playlist modal ── */}
      <Modal
        visible={showPlaylistModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlaylistModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPlaylistModal(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>
              {t('select_playlist')}
            </Text>

            {playlistLoading ? (
              <ActivityIndicator size="large" color="#4285F4" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={styles.modalList} bounces={false}>
                {playlists.map((pl) => (
                  <TouchableOpacity
                    key={pl.id}
                    style={[styles.playlistRow, isRTL && styles.playlistRowRTL]}
                    onPress={() => handleSelectPlaylist(pl.id)}
                  >
                    <Text style={[styles.playlistName, isRTL && styles.textRTL]}>
                      {pl.name}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Create new playlist */}
                {!showNewInput ? (
                  <TouchableOpacity
                    style={[styles.playlistRow, styles.newPlaylistRow, isRTL && styles.playlistRowRTL]}
                    onPress={() => setShowNewInput(true)}
                  >
                    <Text style={[styles.newPlaylistText, isRTL && styles.textRTL]}>
                      + {t('create_playlist')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.newPlaylistInput, isRTL && styles.newPlaylistInputRTL]}>
                    <TextInput
                      style={[styles.playlistNameInput, isRTL && styles.editInputRTL]}
                      placeholder={t('playlist_name')}
                      placeholderTextColor="#aaa"
                      value={newPlaylistName}
                      onChangeText={setNewPlaylistName}
                      textAlign={isRTL ? 'right' : 'left'}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[styles.createBtn, !newPlaylistName.trim() && styles.searchBtnDisabled]}
                      onPress={handleCreateAndAdd}
                      disabled={!newPlaylistName.trim()}
                    >
                      <Text style={styles.createBtnText}>{t('create')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowPlaylistModal(false)}
            >
              <Text style={styles.modalCloseText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  errorText: {
    color: '#cc3333',
    fontSize: 15,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 8,
    padding: 8,
  },
  backBtnText: {
    color: '#4285F4',
    fontSize: 15,
  },

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
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  backArrow: {
    fontSize: 22,
    color: '#4285F4',
    paddingHorizontal: 4,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  songArtist: {
    fontSize: 13,
    color: '#666',
  },
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  headerActionsRTL: {
    flexDirection: 'row-reverse',
  },
  iconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 32,
  },
  iconBtnActive: {
    backgroundColor: '#4285F4',
  },
  iconBtnDisabled: {
    opacity: 0.5,
  },
  iconBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4285F4',
  },
  iconBtnTextActive: {
    color: '#fff',
  },
  iconBtnEmoji: {
    fontSize: 18,
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  toolbarRTL: {
    flexDirection: 'row-reverse',
  },
  transposeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  transposeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8eeff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transposeBtnDisabled: {
    backgroundColor: '#eee',
  },
  transposeBtnText: {
    fontSize: 20,
    color: '#4285F4',
    lineHeight: 22,
  },
  transposeLabel: {
    fontSize: 13,
    color: '#555',
    minWidth: 80,
    textAlign: 'center',
  },
  autoScrollBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e8eeff',
  },
  autoScrollBtnActive: {
    backgroundColor: '#4285F4',
  },
  autoScrollText: {
    fontSize: 13,
    color: '#4285F4',
    fontWeight: '600',
  },
  autoScrollTextActive: {
    color: '#fff',
  },

  // Edit mode
  editScroll: {
    flex: 1,
  },
  editContent: {
    padding: 12,
    gap: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  editTypeBadge: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editType_chords: {
    backgroundColor: '#e8eeff',
  },
  editType_lyrics: {
    backgroundColor: '#f0f0f0',
  },
  editType_section: {
    backgroundColor: '#fff3cd',
  },
  editTypeText: {
    fontSize: 12,
    color: '#555',
  },
  editInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  editInputRTL: {
    writingDirection: 'rtl',
  },

  // Playlist modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalList: {
    maxHeight: 320,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  playlistRowRTL: {
    flexDirection: 'row-reverse',
  },
  playlistName: {
    fontSize: 16,
    color: '#111',
  },
  newPlaylistRow: {
    marginTop: 4,
  },
  newPlaylistText: {
    fontSize: 15,
    color: '#4285F4',
    fontWeight: '500',
  },
  newPlaylistInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  newPlaylistInputRTL: {
    flexDirection: 'row-reverse',
  },
  playlistNameInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  createBtn: {
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: '#4285F4',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: {
    backgroundColor: '#aaa',
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modalClose: {
    marginTop: 12,
    marginHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f2f2f2',
  },
  modalCloseText: {
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
});
