import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Modal,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { supabase } from '../../lib/supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  song_count: number;
  creator_name: string;
  is_owner: boolean;
};

type Section = { title: string; data: Playlist[] };
type Status = 'loading' | 'done' | 'error';

export default function PlaylistsScreen() {
  const { t }  = useTranslation();
  const isRTL  = I18nManager.isRTL;
  const router = useRouter();

  const [playlists,  setPlaylists]  = useState<Playlist[]>([]);
  const [status,     setStatus]     = useState<Status>('loading');
  const [modalVisible, setModal]    = useState(false);
  const [newName,    setNewName]    = useState('');
  const [creating,   setCreating]   = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editName,   setEditName]   = useState('');
  const editInputRef = useRef<TextInput>(null);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const loadPlaylists = useCallback(async () => {
    setStatus('loading');
    const token = await getToken();
    if (!token) { setStatus('error'); return; }

    try {
      const res = await fetch(`${BACKEND_URL}/api/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setStatus('error'); return; }
      setPlaylists(await res.json());
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const token = await getToken();
    if (!token) { setCreating(false); return; }

    const res = await fetch(`${BACKEND_URL}/api/playlists`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });

    setCreating(false);
    setModal(false);
    setNewName('');
    if (!res.ok) { Alert.alert(t('save_error')); } else { loadPlaylists(); }
  }, [newName, loadPlaylists, t]);

  const handleRename = useCallback(async (id: string, name: string) => {
    setEditingId(null);
    if (!name.trim()) return;
    const token = await getToken();
    if (!token) return;

    const res = await fetch(`${BACKEND_URL}/api/playlists/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      setPlaylists(prev => prev.map(p => p.id === id ? { ...p, name: name.trim() } : p));
    }
  }, []);

  const handleTogglePublic = useCallback(async (id: string, current: boolean) => {
    const token = await getToken();
    if (!token) return;

    const res = await fetch(`${BACKEND_URL}/api/playlists/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: !current }),
    });
    if (res.ok) {
      setPlaylists(prev => prev.map(p => p.id === id ? { ...p, is_public: !current } : p));
    }
  }, []);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert(
      t('delete_playlist'),
      t('delete_playlist_confirm', { name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete_playlist'), style: 'destructive',
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            const res = await fetch(`${BACKEND_URL}/api/playlists/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              setPlaylists(prev => prev.filter(p => p.id !== id));
            }
          },
        },
      ],
    );
  }, [t]);

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const renderPlaylist = ({ item }: { item: Playlist }) => {
    const isEditing = editingId === item.id;
    return (
      <TouchableOpacity
        onPress={() => !isEditing && router.push(`/playlist/${item.id}` as any)}
        activeOpacity={isEditing ? 1 : 0.7}
        style={[styles.card, isRTL && styles.cardRTL]}
      >
        {/* Info */}
        <View style={styles.cardText}>
          {/* Name + badge row */}
          <View style={[styles.nameRow, isRTL && styles.nameRowRTL]}>
            {isEditing ? (
              <TextInput
                ref={editInputRef}
                style={[styles.editInput, isRTL && styles.textRTL]}
                value={editName}
                onChangeText={setEditName}
                onSubmitEditing={() => handleRename(item.id, editName)}
                onBlur={() => handleRename(item.id, editName)}
                returnKeyType="done"
                textAlign={isRTL ? 'right' : 'left'}
              />
            ) : (
              <Text style={[styles.cardName, isRTL && styles.textRTL]} numberOfLines={1}>
                {item.name}
              </Text>
            )}
            <View style={[styles.badge, item.is_public ? styles.badgePublic : styles.badgePrivate]}>
              <Text style={[styles.badgeText, item.is_public ? styles.badgeTextPublic : styles.badgeTextPrivate]}>
                {item.is_public ? t('public_badge') : t('private_badge')}
              </Text>
            </View>
          </View>
          {/* Subtitle */}
          <Text style={[styles.cardSub, isRTL && styles.textRTL]}>
            {t('by_creator', { name: item.creator_name })}
            {'  ·  '}
            {t(item.song_count === 1 ? 'songs_count_one' : 'songs_count_other', { count: item.song_count ?? 0 })}
          </Text>
        </View>

        {/* Owner controls */}
        {item.is_owner ? (
          <View style={[styles.controls, isRTL && styles.controlsRTL]}>
            <TouchableOpacity
              style={styles.ctrlBtn}
              onPress={() => handleTogglePublic(item.id, item.is_public)}
            >
              <Text style={styles.ctrlBtnText}>{item.is_public ? '🔒' : '🌐'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctrlBtn}
              onPress={() => startEdit(item.id, item.name)}
            >
              <Text style={styles.ctrlBtnText}>✏</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctrlBtn}
              onPress={() => handleDelete(item.id, item.name)}
            >
              <Text style={[styles.ctrlBtnText, styles.ctrlBtnDanger]}>🗑</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.chevron}>{isRTL ? '‹' : '›'}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const myPlaylists     = playlists.filter(p => p.is_owner);
  const publicPlaylists = playlists.filter(p => !p.is_owner);

  const sections: Section[] = [
    { title: t('my_playlists'), data: myPlaylists },
    ...(publicPlaylists.length > 0 ? [{ title: t('public_playlists'), data: publicPlaylists }] : []),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={[styles.titleRow, isRTL && styles.titleRowRTL]}>
        <Text style={[styles.title, isRTL && styles.textRTL]}>{t('playlists')}</Text>
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
            <Text style={styles.retryText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'done' && (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderPlaylist}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, isRTL && styles.textRTL]}>{t('no_playlists')}</Text>
              <TouchableOpacity style={styles.createBtnLarge} onPress={() => setModal(true)}>
                <Text style={styles.createBtnLargeText}>{t('create_playlist')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Create playlist modal */}
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4285F4',
    alignItems: 'center', justifyContent: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 20, lineHeight: 22 },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingHorizontal: 32, paddingVertical: 40,
  },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
  errorText: { fontSize: 15, color: '#cc3333' },
  retryText: { fontSize: 15, color: '#4285F4', fontWeight: '600' },
  createBtnLarge: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#4285F4', borderRadius: 8,
  },
  createBtnLargeText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  list: { paddingBottom: 20 },
  sectionHeader: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  cardRTL: { flexDirection: 'row-reverse' },
  cardText: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  nameRowRTL: { flexDirection: 'row-reverse' },
  cardName: { fontSize: 15, fontWeight: '600', color: '#111', flexShrink: 1 },
  cardSub: { fontSize: 12, color: '#888' },
  badge: {
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 4, flexShrink: 0,
  },
  badgePublic: { backgroundColor: 'rgba(66,133,244,0.12)' },
  badgePrivate: { backgroundColor: 'rgba(150,150,150,0.12)' },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  badgeTextPublic: { color: '#4285F4' },
  badgeTextPrivate: { color: '#999' },
  editInput: {
    flex: 1, fontSize: 15, fontWeight: '600', color: '#111',
    borderWidth: 1, borderColor: '#4285F4', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: '#f0f4ff',
  },
  controls: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  controlsRTL: { flexDirection: 'row-reverse' },
  ctrlBtn: {
    padding: 6, borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd',
  },
  ctrlBtnText: { fontSize: 14 },
  ctrlBtnDanger: { color: '#e53e3e' },
  chevron: { fontSize: 20, color: '#bbb', marginHorizontal: 4 },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  modal: {
    width: '100%', backgroundColor: '#fff',
    borderRadius: 12, padding: 20, gap: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  modalInput: {
    height: 44, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, paddingHorizontal: 12, fontSize: 16,
  },
  inputRTL: { writingDirection: 'rtl' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalActionsRTL: { flexDirection: 'row-reverse' },
  modalCancelBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: '#ddd',
  },
  modalCancelText: { color: '#555', fontWeight: '500' },
  modalCreateBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#4285F4', borderRadius: 8,
  },
  modalCreateBtnDisabled: { backgroundColor: '#aaa' },
  modalCreateText: { color: '#fff', fontWeight: '600' },
  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
});
