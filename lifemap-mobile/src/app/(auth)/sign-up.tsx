import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { authErrorMessage, signUp } from '@/features/auth/session';
import { Button, Input, Screen } from '@/shared/ui';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signUp(name.trim(), email, password);
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
            <Text className="text-4xl font-bold text-white">Create account</Text>
            <Text className="text-base text-white/50">
              Start turning reels and memories into your world map.
            </Text>
          </View>

          <View className="gap-4">
            <Input
              label="Name"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              placeholder="Your name"
            />
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
              autoComplete="new-password"
              placeholder="At least 6 characters"
              error={error}
            />
          </View>

          <View className="gap-4">
            <Button
              title="Create account"
              onPress={submit}
              loading={busy}
              disabled={!name.trim() || !email || password.length < 6}
            />
            <Link href="/" className="text-center">
              <Text className="text-sm text-white/60">
                Already have an account?{' '}
                <Text className="text-horizon-300">Sign in</Text>
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
