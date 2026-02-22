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

type Instrument = 'guitar' | 'piano';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { language, setLanguage, isRTL } = useLanguage();
  const [instrument, setInstrumentState] = useState<Instrument>('guitar');

  // Load saved instrument preference from Supabase
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ instrument: inst }).eq('id', user.id);
    }
  }, []);

  const handleLanguage = useCallback(
    async (lang: Language) => {
      await setLanguage(lang);
      // RTL change requires restart — inform the user
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
      <Text style={[styles.screenTitle, isRTL && styles.textRTL]}>{t('settings')}</Text>

      {/* ── Language ── */}
      <Section label={t('language')} isRTL={isRTL}>
        <SegmentRow
          options={[
            { key: 'he', label: 'עברית' },
            { key: 'en', label: 'English' },
          ]}
          selected={language}
          onSelect={(key) => handleLanguage(key as Language)}
        />
      </Section>

      {/* ── Instrument ── */}
      <Section label={t('instrument_guitar') + ' / ' + t('instrument_piano')} isRTL={isRTL}>
        <SegmentRow
          options={[
            { key: 'guitar', label: `🎸 ${t('instrument_guitar')}` },
            { key: 'piano',  label: `🎹 ${t('instrument_piano')}` },
          ]}
          selected={instrument}
          onSelect={(key) => handleInstrument(key as Instrument)}
        />
      </Section>

      {/* ── Sign out ── */}
      <View style={styles.signOutWrapper}>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  label,
  children,
  isRTL,
}: {
  label: string;
  children: React.ReactNode;
  isRTL: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>{label}</Text>
      {children}
    </View>
  );
}

function SegmentRow({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.segmentBtn, selected === opt.key && styles.segmentBtnActive]}
          onPress={() => onSelect(opt.key)}
        >
          <Text
            style={[
              styles.segmentLabel,
              selected === opt.key && styles.segmentLabelActive,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
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
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    color: '#111',
  },
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  section: {
    marginHorizontal: 20,
    marginTop: 24,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  segmentRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  segmentBtnActive: {
    backgroundColor: '#4285F4',
  },
  segmentLabel: {
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  segmentLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  signOutWrapper: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  signOutBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#cc3333',
    fontSize: 15,
    fontWeight: '600',
  },
});
