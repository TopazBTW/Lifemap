import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import { initializeAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
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
 * Firestore gets the persistent local cache so the map, passports and
 * timeline render instantly offline from the last-known data.
 */
const app =
  getApps()[0] ??
  initializeApp(env.firebase);

export const auth: Auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager(undefined),
  }),
});

export const storage: FirebaseStorage = getStorage(app);

export const functions: Functions = getFunctions(app);
