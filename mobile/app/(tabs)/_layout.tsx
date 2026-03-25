import { Tabs } from 'expo-router';
import { I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return <Ionicons name={name} size={24} color={focused ? '#4285F4' : '#888'} />;
}

export default function TabLayout() {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4285F4',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { direction: isRTL ? 'rtl' : 'ltr' },
      }}
    >
      <Tabs.Screen
        name="search"
        options={{
          title: t('search'),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="playlists"
        options={{
          title: t('playlists'),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'musical-notes' : 'musical-notes-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
