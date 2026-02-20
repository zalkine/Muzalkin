/**
 * auth/callback.tsx
 *
 * Handles the deep-link redirect after Google OAuth completes.
 * The URL arrives as: muzalkin://auth/callback?code=<pkce-code>
 *
 * This screen is a fallback for when the OS relaunches the app cold via the
 * deep link (instead of resuming it). In the normal flow the code is already
 * exchanged inside signInWithGoogle() via WebBrowser.openAuthSessionAsync.
 */
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '../../lib/supabase';

export default function AuthCallbackScreen() {
  const { code, error, error_description } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();

  useEffect(() => {
    if (error) {
      console.error('OAuth error:', error, error_description);
      router.replace('/auth/login');
      return;
    }

    if (!code) {
      // No code and no error — nothing to do, go back to login
      router.replace('/auth/login');
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error: sessionError }) => {
      if (sessionError) {
        console.error('Session exchange failed:', sessionError.message);
        router.replace('/auth/login');
      } else {
        router.replace('/(tabs)/search');
      }
    });
  }, [code, error, error_description]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4285F4" />
      <Text style={styles.text}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#fff',
  },
  text: {
    color: '#666',
    fontSize: 15,
  },
});
