import { Tabs } from 'expo-router';

import { GlassTabBar } from '@/features/navigation/GlassTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#0A0E14' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Map' }} />
      <Tabs.Screen name="reels" options={{ title: 'Reels' }} />
      <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
      <Tabs.Screen name="passport" options={{ title: 'Passport' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
    </Tabs>
  );
}
