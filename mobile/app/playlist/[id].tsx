import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  I18nManager,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { supabase } from '../../lib/supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

type Song = { id: string; title: string; artist: string; language: string; instrument: string };
type PlaylistSong = { id: string; position: number; song: Song };
type Playlist = { id: string; name: string; description: string | null; user_id: string };
type OwnPlaylist = { id: string; name: string };
type Status = 'loading' | 'done' | 'error';

export default function PlaylistDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { t }   = useTranslation();
  const isRTL   = I18nManager.isRTL;

  const [playlist,   setPlaylist]   = useState<Playlist | null>(null);
  const [songs,      setSongs]      = useState<PlaylistSong[]>([]);
  const [status,     setStatus]     = useState<Status>('loading');
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  // Copy-to-playlist state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [ownPlaylists,  setOwnPlaylists]  = useState<OwnPlaylist[]>([]);
  const [loadingOwn,    setLoadingOwn]    = useState(false);
  const [copying,       setCopying]       = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const load = useCallback(async () => {
    if (!id) return;
    setStatus('loading');

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUid(user?.id ?? null);

    const [plRes, songsRes] = await Promise.all([
      supabase
        .from('playlists')
        .select('id, name, description, user_id')
        .eq('id', id)
        .single(),
      supabase
        .from('playlist_songs')
        .select('id, position, song:song_id(id, title, artist, language, instrument)')
        .eq('playlist_id', id)
        .order('position', { ascending: true }),
    ]);

    if (plRes.error || !plRes.data) { setStatus('error'); return; }

    setPlaylist(plRes.data as Playlist);
    setSongs((songsRes.data ?? []) as unknown as PlaylistSong[]);
    setStatus('done');
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isOwner = playlist?.user_id === currentUid;

  const handleRemove = useCallback((playlistSongId: string) => {
    Alert.alert(t('remove_from_playlist'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('remove_from_playlist'), style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('playlist_songs').delete().eq('id', playlistSongId);
          if (!error) setSongs(prev => prev.filter(s => s.id !== playlistSongId));
        },
      },
    ]);
  }, [t]);

  const openCopyModal = useCallback(async () => {
    setShowCopyModal(true);
    setLoadingOwn(true);
    const token = await getToken();
    if (!token) { setLoadingOwn(false); return; }

    try {
      const res = await fetch(`${BACKEND_URL}/api/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setOwnPlaylists((data as any[]).filter(p => p.is_owner && p.id !== id));
    } finally {
      setLoadingOwn(false);
    }
  }, [id]);

  const handleCopy = useCallback(async (targetId: string, targetName: string) => {
    setCopying(true);
    const token = await getToken();
    if (!token) { setCopying(false); return; }

    try {
      const res = await fetch(`${BACKEND_URL}/api/playlists/${id}/copy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_playlist_id: targetId }),
      });
      const data = await res.json();
      setShowCopyModal(false);

      if (!res.ok) {
        Alert.alert(t('copy_error'));
      } else if (data.copied === 0) {
        Alert.alert(t('copy_nothing'));
      } else {
        Alert.alert(t('copy_success', { count: data.copied }));
      }
    } catch {
      setShowCopyModal(false);
      Alert.alert(t('copy_error'));
    } finally {
      setCopying(false);
    }
  }, [id, t]);

  const renderSong = ({ item, index }: { item: PlaylistSong; index: number }) => (
    <View style={[styles.songRow, isRTL && styles.songRowRTL, index < songs.length - 1 && styles.songBorder]}>
      <TouchableOpacity
        style={styles.songInfo}
        onPress={() => router.push(`/song/${item.song.id}` as any)}
      >
        <Text style={[styles.songTitle, isRTL && styles.textRTL]} numberOfLines={1}>
          {item.song.title}
        </Text>
        <Text style={[styles.songArtist, isRTL && styles.textRTL]} numberOfLines={1}>
          {item.song.artist}
        </Text>
      </TouchableOpacity>
      {isOwner && (
        <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.id)}>
          <Text style={styles.removeBtnText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{isRTL ? '→' : '←'}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.title, isRTL && styles.textRTL]} numberOfLines={1}>
            {playlist?.name ?? '…'}
          </Text>
          {playlist?.description ? (
            <Text style={[styles.subtitle, isRTL && styles.textRTL]} numberOfLines={1}>
              {playlist.description}
            </Text>
          ) : null}
        </View>
        {status === 'done' && songs.length > 0 && (
          <TouchableOpacity style={styles.copyBtn} onPress={openCopyModal}>
            <Text style={styles.copyBtnText}>{t('copy_to_playlist')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('error_load')}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'done' && songs.length === 0 && (
        <View style={styles.center}>
          <Text style={[styles.emptyText, isRTL && styles.textRTL]}>{t('playlist_empty') ?? 'This playlist is empty'}</Text>
          <TouchableOpacity style={styles.accentBtn} onPress={() => router.push('/(tabs)/search' as any)}>
            <Text style={styles.accentBtnText}>{t('search')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'done' && songs.length > 0 && (
        <FlatList
          data={songs}
          keyExtractor={item => item.id}
          renderItem={renderSong}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Copy to playlist modal */}
      <Modal
        visible={showCopyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCopyModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={[styles.modalHeader, isRTL && styles.modalHeaderRTL]}>
              <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>
                {t('copy_to_playlist')}
              </Text>
              <TouchableOpacity onPress={() => setShowCopyModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingOwn && (
              <ActivityIndicator size="small" color="#4285F4" style={{ marginVertical: 16 }} />
            )}

            {!loadingOwn && ownPlaylists.length === 0 && (
              <Text style={[styles.emptyText, { textAlign: 'center' }]}>{t('no_playlists')}</Text>
            )}

            {!loadingOwn && ownPlaylists.length > 0 && (
              <FlatList
                data={ownPlaylists}
                keyExtractor={item => item.id}
                style={{ maxHeight: 280 }}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[styles.targetRow, index < ownPlaylists.length - 1 && styles.targetBorder, isRTL && styles.targetRowRTL]}
                    onPress={() => !copying && handleCopy(item.id, item.name)}
                    disabled={copying}
                  >
                    <Text style={[styles.targetName, isRTL && styles.textRTL, copying && styles.disabledText]}>
                      {item.name}
                    </Text>
                    {copying ? null : (
                      <Text style={styles.targetChevron}>{isRTL ? '‹' : '›'}</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}

            {copying && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#4285F4" />
                <Text style={styles.copyingText}>{t('copying')}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
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
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 22, color: '#4285F4' },
  headerTitle: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 12, color: '#888', marginTop: 1 },
  copyBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#4285F4', borderRadius: 8,
    flexShrink: 0,
  },
  copyBtnText: { fontSize: 12, fontWeight: '600', color: '#4285F4' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingHorizontal: 32,
  },
  emptyText: { fontSize: 15, color: '#888' },
  errorText: { fontSize: 15, color: '#cc3333' },
  retryText: { fontSize: 15, color: '#4285F4', fontWeight: '600' },
  accentBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#4285F4', borderRadius: 8,
  },
  accentBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  list: { paddingBottom: 20 },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  songRowRTL: { flexDirection: 'row-reverse' },
  songBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  songInfo: { flex: 1, paddingVertical: 14 },
  songTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  songArtist: { fontSize: 13, color: '#666', marginTop: 2 },
  removeBtn: { padding: 14 },
  removeBtnText: { fontSize: 18, color: '#bbb' },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  modal: {
    width: '100%', backgroundColor: '#fff',
    borderRadius: 12, padding: 20, gap: 14,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeaderRTL: { flexDirection: 'row-reverse' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  closeBtn: { fontSize: 18, color: '#aaa' },
  targetRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 2,
  },
  targetRowRTL: { flexDirection: 'row-reverse' },
  targetBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  targetName: { flex: 1, fontSize: 15, color: '#111', fontWeight: '500' },
  targetChevron: { fontSize: 18, color: '#bbb' },
  disabledText: { color: '#bbb' },
  copyingText: { fontSize: 14, color: '#888' },
  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
});
