import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { signInWithGoogle } from '../../lib/supabase';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const isRTL = I18nManager.isRTL;

  async function handleGoogleSignIn() {
    try {
      setLoading(true);
      await signInWithGoogle();
      router.replace('/(tabs)/search');
    } catch (e) {
      Alert.alert('Sign-in failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, isRTL && styles.containerRTL]}>
      {/* Logo / title */}
      <Text style={styles.logo}>🎸</Text>
      <Text style={styles.title}>MuZalkin</Text>
      <Text style={[styles.subtitle, isRTL && styles.textRTL]}>{t('sign_in')}</Text>

      {/* Google sign-in button */}
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleGoogleSignIn}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={t('sign_in_google')}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t('sign_in_google')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#fff',
    gap: 12,
  },
  containerRTL: {
    direction: 'rtl',
  },
  logo: {
    fontSize: 64,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: -1,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  textRTL: {
    writingDirection: 'rtl',
  },
  button: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
