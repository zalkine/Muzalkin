import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * SecureStore adapter for Supabase session persistence.
 * - Native (iOS/Android): expo-secure-store (device keychain/keystore)
 * - Browser (web): localStorage
 * - SSR / Node.js: in-memory map (no persistence needed during SSR)
 */
function makeStorageAdapter() {
  if (Platform.OS !== 'web') {
    return {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    };
  }
  if (typeof localStorage !== 'undefined') {
    return {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) => { localStorage.setItem(key, value); return Promise.resolve(); },
      removeItem: (key: string) => { localStorage.removeItem(key); return Promise.resolve(); },
    };
  }
  // SSR / Node.js — in-memory only, no persistence
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: string) => { store.set(key, value); return Promise.resolve(); },
    removeItem: (key: string) => { store.delete(key); return Promise.resolve(); },
  };
}

const SecureStoreAdapter = makeStorageAdapter();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // required for React Native — no URL-based OAuth redirects
    flowType: 'pkce',          // PKCE is the secure flow for mobile OAuth
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
    // Let Supabase navigate the browser directly — no popup needed.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    // Browser is navigating away; nothing more to do here.
    return;
  }

  // Native: open system browser and wait for deep-link return.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true, // we open the browser manually below
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
