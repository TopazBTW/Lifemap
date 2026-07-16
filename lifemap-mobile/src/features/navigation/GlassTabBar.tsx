// expo-router 6 (SDK 54) depends on real @react-navigation/* packages, so the
// types come from there. (In SDK 57 the router vendors its own copy and this
// import must change to expo-router/build/react-navigation/bottom-tabs.)
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/shared/ui';

const ICONS: Record<string, string> = {
  index: '🗺️',
  reels: '🎬',
  memories: '📸',
  passport: '🛂',
  timeline: '🧭',
};

/**
 * Floating glass pill tab bar. Sits above the content (absolute) so the map
 * runs edge-to-edge underneath it.
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 items-center"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <Glass variant="bar" intensity={50}>
        <View className="flex-row px-2 py-2">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label = options.title ?? route.name;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                onPress={() => {
                  Haptics.selectionAsync();
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                className={`items-center rounded-pill px-4 py-1.5 ${
                  focused ? 'bg-white/15' : ''
                }`}
              >
                <Text className="text-lg">{ICONS[route.name] ?? '•'}</Text>
                <Text
                  className={`text-[10px] font-medium ${
                    focused ? 'text-white' : 'text-white/45'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}
