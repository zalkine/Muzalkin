import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * Storage adapter for Supabase session persistence.
 *
 * We use AsyncStorage instead of SecureStore because:
 * - SecureStore has a 2 KB value size limit on Android that can silently
 *   truncate or fail to store Supabase JWT tokens (which are large).
 * - AsyncStorage works reliably across all Expo Go environments.
 *
 * For web we fall back to localStorage; for SSR/Node we use an in-memory map.
 */
function makeStorageAdapter() {
  if (Platform.OS !== 'web') {
    return {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    };
  }
  if (typeof localStorage !== 'undefined') {
    return {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        localStorage.removeItem(key);
        return Promise.resolve();
      },
    };
  }
  // SSR / Node.js — in-memory only, no persistence
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: makeStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // required for React Native — no URL-based OAuth redirects
    flowType: 'pkce',          // PKCE is the secure flow for mobile OAuth
    // React Native has no Navigator.locks API — provide a simple pass-through lock
    // so Supabase doesn't time out trying to acquire a lock that will never resolve.
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn(),
  },
});

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Opens the Google OAuth flow.
 *
 * Web:    full-page browser redirect — Supabase navigates to Google, then back
 *         to /auth/callback?code=…, where the callback screen exchanges the code.
 *
 * Native: opens the system browser via expo-web-browser and waits for the
 *         deep-link redirect (muzalkin://auth/callback?code=…).
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth/callback');

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned from Supabase');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success') {
    const callbackUrl = new URL(result.url);
    const code = callbackUrl.searchParams.get('code');
    if (code) {
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
      if (sessionError) throw sessionError;
    }
  }
}

/** Signs the current user out and clears the persisted session. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Returns the currently authenticated user, or null if not signed in. */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
