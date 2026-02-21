import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  SafeAreaView,
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

type Status = 'loading' | 'done' | 'error';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  const [song, setSong]     = useState<CachedChord | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [saving, setSaving] = useState(false);

  // Load chord data from Supabase cached_chords
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

  // Save to user's songs library via backend
  const handleSave = useCallback(async () => {
    if (!song) return;
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
      const resp = await fetch(`${backendUrl}/api/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ cached_chord_id: song.id }),
      });

      if (!resp.ok) throw new Error('Save failed');
      Alert.alert(t('saved'));
    } catch {
      Alert.alert(t('save_error'));
    } finally {
      setSaving(false);
    }
  }, [song, t]);

  // ---------------------------------------------------------------------------
  // Render
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

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{isRTL ? '→' : '←'}</Text>
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
          <Text style={styles.saveBtnText}>{saving ? '…' : t('save_song')}</Text>
        </TouchableOpacity>
      </View>

      {/* Chord sheet */}
      <ChordDisplay data={song.chords_data} />
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
    gap: 12,
    backgroundColor: '#fff',
  },
  loadingText: { fontSize: 14, color: '#888' },
  errorText:   { fontSize: 15, color: '#cc3333' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    gap: 10,
  },
  headerRTL: { flexDirection: 'row-reverse' },

  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 22, color: '#4285F4' },

  headerMeta:    { flex: 1, gap: 2 },
  headerMetaRTL: { alignItems: 'flex-end' },

  songTitle:  { fontSize: 16, fontWeight: '700', color: '#111' },
  songArtist: { fontSize: 13, color: '#666' },

  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#4285F4',
    borderRadius: 8,
  },
  saveBtnDisabled: { backgroundColor: '#aaa' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
});
