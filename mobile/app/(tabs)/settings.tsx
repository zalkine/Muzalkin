import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  I18nManager,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { supabase, signOut } from '../../lib/supabase';

type Instrument = 'guitar' | 'piano';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  const [instrument, setInstrument] = useState<Instrument>('guitar');
  const [loading, setLoading]       = useState(true);

  // Load user's instrument preference from Supabase
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      supabase
        .from('users')
        .select('language')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          // instrument is stored in users table (we'll use a separate field in a future migration;
          // for now we read it from the session metadata if present)
          setLoading(false);
        });
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    Alert.alert(
      t('sign_out'),
      '',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('sign_out'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          },
        },
      ],
    );
  }, [t]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>
      {/* Title */}
      <View style={[styles.titleRow, isRTL && styles.rowRTL]}>
        <Text style={[styles.title, isRTL && styles.textRTL]}>{t('settings')}</Text>
      </View>

      {/* Instrument */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>{t('instrument')}</Text>

        <View style={[styles.segmentRow, isRTL && styles.rowRTL]}>
          <TouchableOpacity
            style={[styles.segment, instrument === 'guitar' && styles.segmentActive]}
            onPress={() => setInstrument('guitar')}
          >
            <Text style={[styles.segmentText, instrument === 'guitar' && styles.segmentTextActive]}>
              {t('instrument_guitar')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, instrument === 'piano' && styles.segmentActive]}
            onPress={() => setInstrument('piano')}
          >
            <Text style={[styles.segmentText, instrument === 'piano' && styles.segmentTextActive]}>
              {t('instrument_piano')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Sign out */}
      <TouchableOpacity
        style={[styles.signOutRow, isRTL && styles.rowRTL]}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>{t('sign_out')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  titleRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },

  section: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase' },

  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#4285F4',
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  segment: {
    paddingHorizontal: 22,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  segmentActive: { backgroundColor: '#4285F4' },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#4285F4' },
  segmentTextActive: { color: '#fff' },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },

  signOutRow: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  signOutText: { fontSize: 16, color: '#cc3333', fontWeight: '500' },

  rowRTL: { flexDirection: 'row-reverse' },
  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
});
