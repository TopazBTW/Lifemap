import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { authErrorMessage, signIn } from '@/features/auth/session';
import { Button, Input, Screen } from '@/shared/ui';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      // Navigation happens via the root layout's auth guard.
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-8 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2">
            <Text className="text-4xl font-bold text-white">LifeMap</Text>
            <Text className="text-base text-white/50">
              Your life, on a map. Sign in to continue.
            </Text>
          </View>

          <View className="gap-4">
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              placeholder="••••••••"
              error={error}
            />
          </View>

          <View className="gap-4">
            <Button
              title="Sign in"
              onPress={submit}
              loading={busy}
              disabled={!email || !password}
            />
            <Link href="/sign-up" className="text-center">
              <Text className="text-sm text-white/60">
                New here? <Text className="text-horizon-300">Create an account</Text>
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
