import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

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

/** Persist the song to the `songs` table for the authenticated user. */
async function saveSong(song: SongData, semitones: number): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('songs').upsert({
    user_id: user.id,
    title: song.title,
    artist: song.artist,
    language: song.language,
    chords_data: song.chords_data,
    source_url: song.source_url,
    instrument: song.instrument,
    transpose: semitones,
  });
  if (error) throw error;
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

  const scrollRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [song, setSong] = useState<SongData | null>(null);
  const [loading, setLoading] = useState(true);
  const [semitones, setSemitones] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load song on mount
  useEffect(() => {
    if (!id) return;
    loadSong(id, title, artist, lang)
      .then((data) => {
        setSong(data);
        if (data) setSemitones(data.transpose ?? 0);
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
    setSemitones((prev) => {
      const next = prev + delta;
      // Clamp to -6..+6 (a tritone each way covers all practical keys)
      return Math.max(-6, Math.min(6, next));
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!song) return;
    setSaving(true);
    try {
      await saveSong(song, semitones);
      Alert.alert(t('save_song'), '✓');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [song, semitones, t]);

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
            <Text style={styles.backBtnText}>← {t('search')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: song ──
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
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
        {/* Save button */}
        <TouchableOpacity
          style={[styles.iconBtn, saving && styles.iconBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <Text style={styles.iconBtnText}>💾</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Toolbar */}
      <View style={[styles.toolbar, isRTL && styles.toolbarRTL]}>
        {/* Transpose */}
        <View style={styles.transposeRow}>
          <TouchableOpacity
            style={styles.transposeBtn}
            onPress={() => handleTranspose(-1)}
            disabled={semitones <= -6}
          >
            <Text style={styles.transposeBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.transposeLabel}>
            {t('transpose')} {semitones > 0 ? `+${semitones}` : semitones}
          </Text>
          <TouchableOpacity
            style={styles.transposeBtn}
            onPress={() => handleTranspose(1)}
            disabled={semitones >= 6}
          >
            <Text style={styles.transposeBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Auto-scroll toggle */}
        <TouchableOpacity
          style={[styles.autoScrollBtn, autoScroll && styles.autoScrollBtnActive]}
          onPress={() => setAutoScroll((v) => !v)}
        >
          <Text
            style={[
              styles.autoScrollText,
              autoScroll && styles.autoScrollTextActive,
            ]}
          >
            {t('auto_scroll')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chord display */}
      <ChordDisplay
        ref={scrollRef}
        data={song.chords_data}
        semitones={semitones}
        fontSize={16}
      />
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
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.5,
  },
  iconBtnText: {
    fontSize: 20,
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
});
