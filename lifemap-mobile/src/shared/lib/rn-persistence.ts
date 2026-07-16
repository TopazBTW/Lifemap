/**
 * The single sanctioned workaround for a firebase packaging bug.
 *
 * `@firebase/auth`'s `exports` map lists `"types"` before `"react-native"`, so
 * TypeScript resolves the *web* typings (`auth-public.d.ts`), which omit
 * `getReactNativePersistence`. Metro has no `"types"` condition, matches
 * `"react-native"`, and loads `dist/rn/index.js` — which exports it. It works
 * at runtime and fails `tsc`.
 *
 * Do not scatter `@ts-ignore` at call sites; import from here. Re-check on
 * every firebase upgrade and delete this shim once the symbol lands in the
 * public typings.
 */
import type { Persistence } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';

type WithRNPersistence = {
  getReactNativePersistence: (storage: unknown) => Persistence;
};

export const getReactNativePersistence = (
  firebaseAuth as unknown as WithRNPersistence
).getReactNativePersistence;
