import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
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

// Warn but don't throw — a throw here crashes the entire app before any screen renders,
// making it impossible to show the user a helpful message.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Missing env vars: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY not set.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: makeStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // React Native has no Navigator.locks API — provide a simple pass-through lock
    // so Supabase doesn't time out trying to acquire a lock that will never resolve.
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn(),
  },
});

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Creates a new anonymous user with the given display name.
 *
 * Uses Supabase anonymous auth — no email, password, or OAuth required.
 * The session is persisted to AsyncStorage just like a regular session,
 * so the user stays logged in across app restarts.
 *
 * Prerequisites (one-time Supabase setup):
 *   1. Enable Anonymous sign-ins: Dashboard → Authentication → Sign In Methods
 *   2. Make email nullable: ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
 */
export async function createAnonUser(displayName: string): Promise<void> {
  const { data: { user }, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!user) throw new Error('No user returned from anonymous sign-in');

  const { error: dbError } = await supabase.from('users').upsert({
    id:           user.id,
    display_name: displayName.trim(),
    language:     'he',
  });
  if (dbError) throw dbError;
}

/**
 * Updates the display name of the currently authenticated user.
 */
export async function updateDisplayName(displayName: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('users')
    .update({ display_name: displayName.trim() })
    .eq('id', user.id);
  if (error) throw error;
}

/**
 * Returns the display name of the currently authenticated user, or null.
 */
export async function getDisplayName(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single();
  return data?.display_name ?? null;
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
