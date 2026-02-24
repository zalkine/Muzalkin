/**
 * app/index.tsx — entry point
 *
 * Checks whether a Supabase session exists and redirects accordingly:
 *   - Authenticated  → /(tabs)/search
 *   - Not signed in  → /auth/login
 *
 * Shows the exact error on-screen if something goes wrong, so we can debug.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function IndexScreen() {
  const [status, setStatus] = useState('Starting…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        setStatus('Checking Supabase session…');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(`getSession error:\n${sessionError.message}`);
          return;
        }

        setStatus(session ? 'Session found → going to search' : 'No session → going to login');

        if (session) {
          router.replace('/(tabs)/search');
        } else {
          router.replace('/auth/login');
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? `${e.name}: ${e.message}\n\n${e.stack ?? ''}` : String(e);
        setError(msg);
        setStatus('Crashed');
      }
    }

    init();
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Startup Error</Text>
        <ScrollView style={styles.errorScroll}>
          <Text style={styles.errorText}>{error}</Text>
        </ScrollView>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setError(null); setStatus('Retrying…'); }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#5B4FE8" />
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    padding: 20,
    paddingTop: 60,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 12,
  },
  errorScroll: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#1F2937',
    fontFamily: 'monospace',
  },
  retryBtn: {
    backgroundColor: '#5B4FE8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
