import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  I18nManager,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';

import { supabase, signOut } from '../../lib/supabase';

type Instrument = 'guitar' | 'piano';
type Language   = 'he' | 'en';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = I18nManager.isRTL;

  const [instrument, setInstrument] = useState<Instrument>('guitar');
  const [language,   setLanguage]   = useState<Language>('he');
  const [loading,    setLoading]    = useState(true);

  // Load user preferences from Supabase on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('users')
        .select('language, instrument')
        .eq('id', user.id)
        .single();

      if (data) {
        if (data.language)   setLanguage(data.language as Language);
        if (data.instrument) setInstrument(data.instrument as Instrument);
        // Keep i18next in sync with DB value
        if (data.language && i18next.language !== data.language) {
          i18next.changeLanguage(data.language);
        }
      }
      setLoading(false);
    })();
  }, []);

  // Persist a preference update to backend
  const savePreference = useCallback(async (updates: { language?: Language; instrument?: Instrument }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${BACKEND_URL}/api/songs/preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Failed to save preference:', err);
    }
  }, []);

  // Change language: update state, i18next, and DB
  const handleLanguageChange = useCallback(async (lang: Language) => {
    setLanguage(lang);
    i18next.changeLanguage(lang);
    await savePreference({ language: lang });

    // Notify about RTL restart requirement if direction changes
    const needsRTLChange = (lang === 'he') !== I18nManager.isRTL;
    if (needsRTLChange) {
      Alert.alert(t('language'), t('language_note'));
    }
  }, [savePreference, t]);

  // Change instrument: update state and DB
  const handleInstrumentChange = useCallback(async (inst: Instrument) => {
    setInstrument(inst);
    await savePreference({ instrument: inst });
  }, [savePreference]);

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

      {/* Language */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>{t('language')}</Text>
        <View style={[styles.segmentRow, isRTL && styles.rowRTL]}>
          <TouchableOpacity
            style={[styles.segment, language === 'he' && styles.segmentActive]}
            onPress={() => handleLanguageChange('he')}
          >
            <Text style={[styles.segmentText, language === 'he' && styles.segmentTextActive]}>
              {t('language_hebrew')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, language === 'en' && styles.segmentActive]}
            onPress={() => handleLanguageChange('en')}
          >
            <Text style={[styles.segmentText, language === 'en' && styles.segmentTextActive]}>
              {t('language_english')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Instrument */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>{t('instrument')}</Text>

        <View style={[styles.segmentRow, isRTL && styles.rowRTL]}>
          <TouchableOpacity
            style={[styles.segment, instrument === 'guitar' && styles.segmentActive]}
            onPress={() => handleInstrumentChange('guitar')}
          >
            <Text style={[styles.segmentText, instrument === 'guitar' && styles.segmentTextActive]}>
              {t('instrument_guitar')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, instrument === 'piano' && styles.segmentActive]}
            onPress={() => handleInstrumentChange('piano')}
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
    paddingHorizontal: 20,
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
