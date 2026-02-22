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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  song_count?: number;
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('playlists')
      .select('id, name, description, is_public, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Attach song counts via playlist_songs
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

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }
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

  // ── Render: loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Title row */}
      <View style={[styles.titleRow, isRTL && styles.titleRowRTL]}>
        <Text style={[styles.screenTitle, isRTL && styles.textRTL]}>
          {t('playlists')}
        </Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Empty state */}
      {playlists.length === 0 && (
        <View style={styles.center}>
          <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
            {t('no_results')}
          </Text>
        </View>
      )}

      {/* Playlist list */}
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

      {/* Create playlist modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>
              {t('playlists')}
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
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, !newName.trim() && styles.createBtnDisabled]}
                onPress={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createBtnText}>✓</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

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
      style={[styles.row, isRTL && styles.rowRTL]}
      onPress={onPress}
      onLongPress={onDelete}
      activeOpacity={0.7}
    >
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>🎵</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowName, isRTL && styles.textRTL]} numberOfLines={1}>
          {playlist.name}
        </Text>
        {playlist.description ? (
          <Text style={[styles.rowDesc, isRTL && styles.textRTL]} numberOfLines={1}>
            {playlist.description}
          </Text>
        ) : null}
        <Text style={[styles.rowMeta, isRTL && styles.textRTL]}>
          {playlist.song_count} songs{playlist.is_public ? ' · public' : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>{isRTL ? '‹' : '›'}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  titleRowRTL: { flexDirection: 'row-reverse' },
  screenTitle: { fontSize: 22, fontWeight: '700', color: '#111' },
  textRTL: { writingDirection: 'rtl', textAlign: 'right' },

  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 24, lineHeight: 28 },

  list: { paddingVertical: 4 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowRTL: { flexDirection: 'row-reverse' },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  rowIconText: { fontSize: 20 },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#111' },
  rowDesc: { fontSize: 13, color: '#666' },
  rowMeta: { fontSize: 12, color: '#aaa' },
  chevron: { fontSize: 20, color: '#bbb', marginHorizontal: 4 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  inputDesc: { minHeight: 60, textAlignVertical: 'top' },
  inputRTL: { writingDirection: 'rtl' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 18, color: '#666' },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnDisabled: { backgroundColor: '#aaa' },
  createBtnText: { fontSize: 18, color: '#fff' },
});
