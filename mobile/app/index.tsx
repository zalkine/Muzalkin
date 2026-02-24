/**
 * Immediate redirect to login — no async calls, no Supabase at startup.
 * This proves the app can load before we add auth back.
 */
import { Redirect } from 'expo-router';

export default function IndexScreen() {
  return <Redirect href="/auth/login" />;
}
