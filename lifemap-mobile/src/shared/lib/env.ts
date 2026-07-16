/**
 * Public, bundle-safe configuration only.
 *
 * EXPO_PUBLIC_* values are inlined into the JS bundle and readable by anyone
 * who downloads the app — never put a *secret* here. The Gemini key lives in
 * Cloud Functions only.
 *
 * The Google Maps key is a deliberate, bounded exception: Google API keys are
 * designed for client use and there's no server proxy on this stack (Cloud
 * Functions need Blaze). Restrict it to the Places API and set a daily quota
 * cap in Google Cloud so a scraped key can't run up a bill. Optional — the
 * establishment search falls back to free Nominatim + Wikipedia without it.
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
  /** Optional. Present → establishment search uses Google Places. */
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? null,
  /** Optional. Free key from aistudio.google.com — enables reel extraction. */
  geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? null,
} as const;
