/**
 * app/index.tsx — entry point
 *
 * Checks whether a Supabase session exists and redirects accordingly:
 *   - Authenticated  → /(tabs)/search
 *   - Not signed in  → /auth/login
 *
 * Renders a blank screen while the session check is in flight.
 */
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function IndexScreen() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)/search');
      } else {
        router.replace('/auth/login');
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4285F4" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
