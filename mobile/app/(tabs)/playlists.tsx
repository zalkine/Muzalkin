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

import { supabase } from '../../lib/supabase';

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  song_count?: number;
};

type Status = 'loading' | 'done' | 'error';

export default function PlaylistsScreen() {
  const { t }  = useTranslation();
  const isRTL  = I18nManager.isRTL;

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [status, setStatus]       = useState<Status>('loading');
  const [modalVisible, setModal]  = useState(false);
  const [newName, setNewName]     = useState('');
  const [creating, setCreating]   = useState(false);

  const loadPlaylists = useCallback(async () => {
    setStatus('loading');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus('error'); return; }

    const { data, error } = await supabase
      .from('playlists')
      .select('id, name, description, is_public, created_at, playlist_songs(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) { setStatus('error'); return; }

    const mapped: Playlist[] = (data ?? []).map((p: any) => ({
      id:         p.id,
      name:       p.name,
      description: p.description,
      is_public:  p.is_public,
      created_at: p.created_at,
      song_count: p.playlist_songs?.[0]?.count ?? 0,
    }));

    setPlaylists(mapped);
    setStatus('done');
  }, []);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { error } = await supabase.from('playlists').insert({
      user_id: user.id,
      name:    newName.trim(),
      is_public: false,
    });

    setCreating(false);
    setModal(false);
    setNewName('');

    if (error) { Alert.alert(t('save_error')); } else { loadPlaylists(); }
  }, [newName, loadPlaylists, t]);

  const renderPlaylist = ({ item }: { item: Playlist }) => (
    <View style={[styles.card, isRTL && styles.cardRTL]}>
      <View style={styles.cardText}>
        <Text style={[styles.cardName, isRTL && styles.textRTL]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.cardCount, isRTL && styles.textRTL]}>
          {t(item.song_count === 1 ? 'songs_count_one' : 'songs_count_other', {
            count: item.song_count ?? 0,
          })}
        </Text>
      </View>
      <Text style={styles.chevron}>{isRTL ? '\u2039' : '\u203a'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.titleRow, isRTL && styles.titleRowRTL]}>
        <Text style={[styles.title, isRTL && styles.textRTL]}>{t('my_playlists')}</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setModal(true)}>
          <Text style={styles.createBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('error_load')}</Text>
          <TouchableOpacity onPress={loadPlaylists}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'done' && playlists.length === 0 && (
        <View style={styles.center}>
          <Text style={[styles.emptyText, isRTL && styles.textRTL]}>{t('no_playlists')}</Text>
          <TouchableOpacity style={styles.createBtnLarge} onPress={() => setModal(true)}>
            <Text style={styles.createBtnLargeText}>{t('create_playlist')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'done' && playlists.length > 0 && (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          renderItem={renderPlaylist}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>{t('new_playlist')}</Text>
            <TextInput
              style={[styles.modalInput, isRTL && styles.inputRTL]}
              placeholder={t('playlist_name')}
              placeholderTextColor="#aaa"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              textAlign={isRTL ? 'right' : 'left'}
            />
            <View style={[styles.modalActions, isRTL && styles.modalActionsRTL]}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setModal(false); setNewName(''); }}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreateBtn, (!newName.trim() || creating) && styles.modalCreateBtnDisabled]}
                onPress={handleCreate}
                disabled={!newName.trim() || creating}
              >
                <Text style={styles.modalCreateText}>{creating ? '...' : t('create')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  titleRowRTL: { flexDirection: 'row-reverse' },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 20, lineHeight: 22 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
  errorText: { fontSize: 15, color: '#cc3333' },
  retryText: { fontSize: 15, color: '#4285F4', fontWeight: '600' },
  createBtnLarge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#4285F4',
    borderRadius: 8,
  },
  createBtnLargeText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  list: { paddingVertical: 4 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardRTL: { flexDirection: 'row-reverse' },
  cardText: { flex: 1, gap: 3 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111' },
  cardCount: { fontSize: 13, color: '#888' },
  chevron: { fontSize: 20, color: '#bbb', marginHorizontal: 4 },
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
    gap: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  inputRTL: { writingDirection: 'rtl' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalActionsRTL: { flexDirection: 'row-reverse' },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalCancelText: { color: '#555', fontWeight: '500' },
  modalCreateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#4285F4',
    borderRadius: 8,
  },
  modalCreateBtnDisabled: { backgroundColor: '#aaa' },
  modalCreateText: { color: '#fff', fontWeight: '600' },
  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
});
