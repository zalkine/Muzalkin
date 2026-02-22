import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, Text } from 'react-native';

// ---------------------------------------------------------------------------
// Tab bar icons — simple emoji labels (replace with @expo/vector-icons later)
// ---------------------------------------------------------------------------

function TabIcon({ icon }: { icon: string }) {
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}

export default function TabLayout() {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4285F4',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { paddingBottom: 4 },
        // Flip tab order for RTL so Search is on the right
        tabBarPosition: 'bottom',
      }}
    >
      <Tabs.Screen
        name="search"
        options={{
          title: t('search'),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={focused ? '🔍' : '🔎'} />
          ),
        }}
      />
      <Tabs.Screen
        name="playlists"
        options={{
          title: t('playlists'),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={focused ? '🎵' : '🎶'} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={focused ? '⚙️' : '☰'} />
          ),
        }}
      />
    </Tabs>
  );
}
