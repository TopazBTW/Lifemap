/**
 * Public, bundle-safe configuration only.
 *
 * EXPO_PUBLIC_* values are inlined into the JS bundle and readable by anyone
 * who downloads the app — never put a secret here. The Gemini key lives in
 * Cloud Functions only. Maps are Apple/Google via react-native-maps and
 * geocoding is Nominatim — neither needs a client token.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is missing. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const env = {
  firebase: {
    apiKey: required(
      'EXPO_PUBLIC_FIREBASE_API_KEY',
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    ),
    authDomain: required(
      'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: required(
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    storageBucket: required(
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: required(
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: required(
      'EXPO_PUBLIC_FIREBASE_APP_ID',
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    ),
  },
} as const;
