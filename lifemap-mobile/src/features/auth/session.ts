import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { create } from 'zustand';

import { auth, db } from '@/shared/lib/firebase';

type SessionState = {
  /** undefined = still restoring from AsyncStorage; null = signed out. */
  user: User | null | undefined;
};

export const useSession = create<SessionState>(() => ({
  user: undefined,
}));

// Single app-lifetime subscription; the store fans out to every consumer.
onAuthStateChanged(auth, (user) => {
  useSession.setState({ user });
});

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUp(
  displayName: string,
  email: string,
  password: string,
): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName });

  // The profile doc is what rules and couple mode key off — create it up
  // front, idempotently, so a retried sign-up doesn't wipe sharedSpaceIds.
  const ref = doc(db, 'users', cred.user.uid);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      displayName,
      email: email.trim(),
      photoUrl: null,
      homeCountry: null,
      sharedSpaceIds: [],
      createdAt: serverTimestamp(),
    });
  }
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

/** Human-readable message for the handful of auth errors users actually hit. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a moment.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
