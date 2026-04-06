import { useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

/**
 * Entry point — routes users based on whether they already have a session.
 *   Session exists → go straight to the app (skip welcome screen)
 *   No session     → show welcome/name screen
 */
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

  return null;
}
