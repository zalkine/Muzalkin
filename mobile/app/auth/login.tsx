import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { createAnonUser } from '../../lib/supabase';

const PRIMARY = '#5B4FE8';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef              = useRef<TextInput>(null);

  async function handleGetStarted() {
    const trimmed = name.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    try {
      setLoading(true);
      await createAnonUser(trimmed);
      router.replace('/(tabs)/search');
    } catch (e) {
      Alert.alert(t('error_fetch'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = name.trim().length > 0 && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <View style={styles.logoRing}>
          <Text style={styles.logoEmoji}>🎸</Text>
        </View>
        <Text style={styles.appName}>MuZalkin</Text>
        <Text style={styles.tagline}>אקורדים לכל שיר</Text>
      </View>

      {/* ── Card ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('welcome_title')}</Text>
        <Text style={styles.cardSubtitle}>{t('welcome_subtitle')}</Text>

        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={t('name_placeholder')}
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            onSubmitEditing={handleGetStarted}
            returnKeyType="go"
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            maxLength={40}
            textAlign="right"
          />
        </View>

        <TouchableOpacity
          style={[styles.startBtn, !canSubmit && styles.startBtnDisabled]}
          onPress={handleGetStarted}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startBtnText}>{t('get_started')} →</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
    gap: 12,
  },
  logoRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoEmoji: {
    fontSize: 56,
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 52,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#1A1A2E',
    writingDirection: 'rtl',
  },
  startBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    marginTop: 4,
  },
  startBtnDisabled: {
    opacity: 0.45,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
