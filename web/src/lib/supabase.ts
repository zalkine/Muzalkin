import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     ?? 'https://vxzsbuaseidfitplkbtm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4enNidWFzZWlkZml0cGxrYnRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjM0MTAsImV4cCI6MjA4NzEzOTQxMH0.OfZRo17c3S8kRA82_QvaqjDq9pUOJ1XJPCAVLpO46pc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // web uses URL hash for OAuth redirects
    flowType: 'pkce',
  },
});

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
