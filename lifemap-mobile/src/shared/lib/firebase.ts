import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

import { env } from './env';
import { getReactNativePersistence } from './rn-persistence';

/**
 * Firebase singletons.
 *
 * `initializeAuth` with AsyncStorage persistence, never bare `getAuth()`:
 * on React Native the default is in-memory persistence, which silently signs
 * the user out on every cold start.
 *
 * Firestore disk persistence (persistentLocalCache) is IndexedDB-backed and
 * web-only — on React Native it just logs a fallback warning, so we don't ask
 * for it. Offline UX comes from Firestore's in-memory cache plus React
 * Query's long gcTime. Auto-detected long polling keeps the connection
 * reliable on RN's networking stack.
 */
const app =
  getApps()[0] ??
  initializeApp(env.firebase);

// try/catch: Fast Refresh re-executes this module, and initialize* throws
// "already-initialized" on the second run. The catch arm's get* returns the
// instance configured on first run — it never creates a memory-persistence
// auth, which is why bare getAuth() as the *primary* path stays forbidden.
function createAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

function createDb(): Firestore {
  try {
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return getFirestore(app);
  }
}

export const auth: Auth = createAuth();

export const db: Firestore = createDb();

export const storage: FirebaseStorage = getStorage(app);

export const functions: Functions = getFunctions(app);
