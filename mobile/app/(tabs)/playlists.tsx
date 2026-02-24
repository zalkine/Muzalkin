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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { supabase } from '../../lib/supabase';

const PRIMARY = '#5B4FE8';

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  song_count?: number;
};

export default function PlaylistsScreen() {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchPlaylists = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('playlists')
      .select('id, name, description, is_public, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const withCounts = await Promise.all(
        data.map(async (pl) => {
          const { count } = await supabase
            .from('playlist_songs')
            .select('id', { count: 'exact', head: true })
            .eq('playlist_id', pl.id);
          return { ...pl, song_count: count ?? 0 };
        }),
      );
      setPlaylists(withCounts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlaylists(); }, [fetchPlaylists]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { error } = await supabase.from('playlists').insert({
      user_id: user.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
      is_public: false,
    });
    setCreating(false);
    setModalVisible(false);
    setNewName('');
    setNewDesc('');
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      fetchPlaylists();
    }
  }, [newName, newDesc, fetchPlaylists]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      Alert.alert(name, 'Delete this playlist?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('playlists').delete().eq('id', id);
            fetchPlaylists();
          },
        },
      ]);
    },
    [fetchPlaylists],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>{t('playlists')}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={[styles.headerRow, isRTL && styles.headerRowRTL]}>
          <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
            {t('playlists')}
          </Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Empty state ── */}
      {playlists.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎶</Text>
          <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
            {t('no_results')}
          </Text>
          <TouchableOpacity style={styles.createFirstBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.createFirstText}>+ {t('playlists')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <PlaylistRow
              playlist={item}
              isRTL={isRTL}
              onPress={() => router.push(`/playlist/${item.id}`)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
        />
      )}

      {/* ── Create modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>
              פלייליסט חדש
            </Text>
            <TextInput
              style={[styles.input, isRTL && styles.inputRTL]}
              placeholder={t('my_songs')}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              textAlign={isRTL ? 'right' : 'left'}
            />
            <TextInput
              style={[styles.input, styles.inputDesc, isRTL && styles.inputRTL]}
              placeholder={t('share')}
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              numberOfLines={2}
              textAlign={isRTL ? 'right' : 'left'}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !newName.trim() && styles.confirmBtnDisabled]}
                onPress={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {creating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.confirmBtnText}>צור</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PlaylistRow({
  playlist,
  isRTL,
  onPress,
  onDelete,
}: {
  playlist: Playlist;
  isRTL: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, isRTL && styles.cardRTL]}
      onPress={onPress}
      onLongPress={onDelete}
      activeOpacity={0.7}
    >
      <View style={styles.cardIcon}>
        <Text style={styles.cardIconText}>🎵</Text>
      </View>
      <View style={[styles.cardText, isRTL && styles.cardTextRTL]}>
        <Text style={[styles.cardName, isRTL && styles.textRTL]} numberOfLines={1}>
          {playlist.name}
        </Text>
        {playlist.description ? (
          <Text style={[styles.cardDesc, isRTL && styles.textRTL]} numberOfLines={1}>
            {playlist.description}
          </Text>
        ) : null}
        <Text style={[styles.cardMeta, isRTL && styles.textRTL]}>
          {playlist.song_count} שירים{playlist.is_public ? ' · ציבורי' : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>{isRTL ? '‹' : '›'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F3FF' },

  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRowRTL: { flexDirection: 'row-reverse' },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  textRTL: { writingDirection: 'rtl', textAlign: 'right' },

  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: '300' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  createFirstBtn: {
    marginTop: 8,
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createFirstText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  list: { padding: 16, gap: 8 },
  separator: { height: 0 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRTL: { flexDirection: 'row-reverse' },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconText: { fontSize: 22 },
  cardText: { flex: 1, gap: 2 },
  cardTextRTL: { alignItems: 'flex-end' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  cardDesc: { fontSize: 13, color: '#6B7280' },
  cardMeta: { fontSize: 12, color: '#9CA3AF' },
  chevron: { fontSize: 20, color: '#D1D5DB' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    gap: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
    color: '#1A1A2E',
  },
  inputDesc: { minHeight: 64, textAlignVertical: 'top' },
  inputRTL: { writingDirection: 'rtl' },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  confirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});
