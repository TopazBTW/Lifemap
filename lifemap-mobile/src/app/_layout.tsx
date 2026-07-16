// Must be first: fills in globals firebase needs on the old Expo Go runtime.
import '@/shared/lib/polyfills';

import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useSession } from '@/features/auth/session';
import { queryClient } from '@/shared/lib/queryClient';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const user = useSession((s) => s.user);

  useEffect(() => {
    // Hold the splash until auth state is restored so the user never sees a
    // sign-in flash before landing on their map.
    if (user !== undefined) SplashScreen.hideAsync();
  }, [user]);

  if (user === undefined) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0A0E14' },
          }}
        >
          <Stack.Protected guard={!!user}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="memory/new"
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="memory/[id]"
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="place/new"
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="establishment/new"
              options={{ presentation: 'modal' }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!user}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
