import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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

import { useLanguage, Language } from '../../hooks/useLanguage';
import { getDisplayName, updateDisplayName, signOut, supabase } from '../../lib/supabase';

const PRIMARY = '#5B4FE8';

type Instrument = 'guitar' | 'piano';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { language, setLanguage, isRTL } = useLanguage();
  const [instrument,  setInstrumentState] = useState<Instrument>('guitar');
  const [displayName, setDisplayName]     = useState('');
  const [editingName, setEditingName]     = useState(false);
  const [nameInput,   setNameInput]       = useState('');
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    getDisplayName().then((n) => { if (n) setDisplayName(n); });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('users')
        .select('instrument')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.instrument) setInstrumentState(data.instrument as Instrument);
        });
    });
  }, []);

  const handleInstrument = useCallback(async (inst: Instrument) => {
    setInstrumentState(inst);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ instrument: inst }).eq('id', user.id);
    }
  }, []);

  const handleLanguage = useCallback(
    async (lang: Language) => {
      await setLanguage(lang);
      if ((lang === 'he') !== isRTL) {
        Alert.alert(t('language'), 'Restart the app to apply the layout change.');
      }
    },
    [setLanguage, isRTL, t],
  );

  const openEditName = useCallback(() => {
    setNameInput(displayName);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  }, [displayName]);

  const handleSaveName = useCallback(async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      await updateDisplayName(trimmed);
      setDisplayName(trimmed);
      setEditingName(false);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }, [nameInput]);

  const handleResetAccount = useCallback(async () => {
    Alert.alert(
      t('reset_account'),
      t('reset_account_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('reset_account'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/auth/login');
            } catch (e) {
              Alert.alert('Error', (e as Error).message);
            }
          },
        },
      ],
    );
  }, [t]);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
          {t('settings')}
        </Text>
      </View>

      {/* ── Settings body ── */}
      <View style={styles.body}>

        {/* Display name */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
            {t('display_name')}
          </Text>
          <TouchableOpacity
            style={[styles.nameCard, isRTL && styles.nameCardRTL]}
            onPress={openEditName}
            activeOpacity={0.7}
          >
            <View style={styles.nameAvatar}>
              <Text style={styles.nameAvatarText}>
                {displayName ? displayName[0].toUpperCase() : '?'}
              </Text>
            </View>
            <View style={styles.nameInfo}>
              <Text style={[styles.nameText, isRTL && styles.textRTL]}>
                {displayName || '—'}
              </Text>
              <Text style={[styles.nameHint, isRTL && styles.textRTL]}>
                {t('tap_to_edit')}
              </Text>
            </View>
            <Text style={styles.nameChevron}>{isRTL ? '‹' : '›'}</Text>
          </TouchableOpacity>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
            {t('language')}
          </Text>
          <View style={styles.segmentRow}>
            {(['he', 'en'] as Language[]).map((lang, i) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.segmentBtn,
                  language === lang && styles.segmentBtnActive,
                  i === 0 && styles.segmentBtnFirst,
                  i === 1 && styles.segmentBtnLast,
                ]}
                onPress={() => handleLanguage(lang)}
              >
                <Text style={[
                  styles.segmentLabel,
                  language === lang && styles.segmentLabelActive,
                ]}>
                  {lang === 'he' ? '🇮🇱  עברית' : '🇺🇸  English'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Instrument */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
            {t('instrument_guitar')} / {t('instrument_piano')}
          </Text>
          <View style={styles.segmentRow}>
            {(['guitar', 'piano'] as Instrument[]).map((inst, i) => (
              <TouchableOpacity
                key={inst}
                style={[
                  styles.segmentBtn,
                  instrument === inst && styles.segmentBtnActive,
                  i === 0 && styles.segmentBtnFirst,
                  i === 1 && styles.segmentBtnLast,
                ]}
                onPress={() => handleInstrument(inst)}
              >
                <Text style={[
                  styles.segmentLabel,
                  instrument === inst && styles.segmentLabelActive,
                ]}>
                  {inst === 'guitar'
                    ? `🎸  ${t('instrument_guitar')}`
                    : `🎹  ${t('instrument_piano')}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reset account */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.resetBtn} onPress={handleResetAccount} activeOpacity={0.8}>
            <Text style={styles.resetBtnText}>🔄  {t('reset_account')}</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* ── Edit name modal ── */}
      <Modal
        visible={editingName}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingName(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('change_name')}</Text>
            <TextInput
              ref={nameInputRef}
              style={styles.modalInput}
              value={nameInput}
              onChangeText={setNameInput}
              onSubmitEditing={handleSaveName}
              placeholder={t('name_placeholder')}
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
              autoCapitalize="words"
              maxLength={40}
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditingName(false)}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, !nameInput.trim() && styles.modalSaveDisabled]}
                onPress={handleSaveName}
                disabled={!nameInput.trim()}
              >
                <Text style={styles.modalSaveText}>{t('done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F3FF',
  },
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
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  body: {
    flex: 1,
    paddingTop: 24,
    gap: 8,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },

  // Name card
  nameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  nameCardRTL: {
    flexDirection: 'row-reverse',
  },
  nameAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  nameInfo: {
    flex: 1,
    gap: 2,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  nameHint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  nameChevron: {
    fontSize: 18,
    color: '#D1D5DB',
  },

  // Segment controls
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  segmentBtnFirst: {
    borderRightWidth: 0.5,
    borderRightColor: '#E5E7EB',
  },
  segmentBtnLast: {
    borderLeftWidth: 0.5,
    borderLeftColor: '#E5E7EB',
  },
  segmentBtnActive: {
    backgroundColor: PRIMARY,
  },
  segmentLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  segmentLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Reset account
  resetBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  resetBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },

  // Edit name modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A2E',
    backgroundColor: '#F9FAFB',
    writingDirection: 'rtl',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalSave: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },
  modalSaveDisabled: {
    opacity: 0.45,
  },
  modalSaveText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
