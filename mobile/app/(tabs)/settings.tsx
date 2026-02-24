import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { useLanguage, Language } from '../../hooks/useLanguage';
import { signOut, supabase } from '../../lib/supabase';

const PRIMARY = '#5B4FE8';

type Instrument = 'guitar' | 'piano';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { language, setLanguage, isRTL } = useLanguage();
  const [instrument, setInstrumentState] = useState<Instrument>('guitar');

  useEffect(() => {
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

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      router.replace('/auth/login');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }, []);

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

        {/* Sign out */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Text style={styles.signOutText}>🚪  {t('settings')}</Text>
          </TouchableOpacity>
        </View>

      </View>
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

  signOutBtn: {
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
  signOutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
