// Initialize i18n before any screen renders
import '../lib/i18n';

import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
