// Initialize i18n before any screen renders
try {
  require('../lib/i18n');
} catch (e) {
  console.warn('[i18n] Failed to initialize:', e);
}

import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
