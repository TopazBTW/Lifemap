---
name: lifemap-stack
description: Version landmines and hard constraints for the LifeMap AI Expo stack (pinned to SDK 54). Read BEFORE adding a dependency, importing an Expo/Firebase module, or touching babel/metro/tailwind config in lifemap-mobile. Triggers on expo-av, expo-file-system, splash, newArchEnabled, getReactNativePersistence, nativewind, reanimated, firebase auth persistence.
---

# LifeMap stack constraints

Each item cost a real debugging cycle — don't re-derive them.

## PINNED TO SDK 54 — do not upgrade (2026-07-16)

The owner's iPhone runs an iOS old enough that the App Store serves an Expo Go
build whose ceiling is **SDK 54**, and Expo Go is the only distribution channel
(no paid Apple Developer account, no EAS builds, Windows dev machine → no
local iOS builds). `npx expo install --fix` against 54, docs at
https://docs.expo.dev/versions/v54.0.0/. Consequences:

- **expo-router 6 uses real `@react-navigation/*` deps** — import
  `BottomTabBarProps` from `@react-navigation/bottom-tabs` (they're transitive
  deps, don't add them to package.json). The vendored-path import only applies
  if the project ever returns to SDK 57.
- **`babel-preset-expo` must be an explicit devDependency** in 54 — Metro fails
  with "Cannot find module 'babel-preset-expo'" otherwise.
- Only Expo-Go-bundled native modules are usable: react-native-maps yes,
  @rnmapbox/maps or any custom native module no.
- **The device's Hermes cannot parse `#private` class members** ("Runtime not
  ready: SyntaxError: private properties not supported" on boot). firebase v12
  ships them untranspiled, and the `hermes-stable` transform profile keeps
  them. `babel.config.js` adds the three `@babel/plugin-transform-*` private
  plugins to strip them — do not remove, and re-verify with
  `grep -cE '\.#[a-zA-Z]' <bundle>` against the hermes-profile bundle after
  any babel/firebase change.

## Free-tier-only Firebase (no Blaze, no bank card)

The owner will not attach billing. Therefore:

- **No Firebase Storage.** Memory photos are compressed (900px, q0.55, ≤3) and
  stored **inline in the Firestore doc as data URIs** — see
  `src/features/memories/useMemories.ts`. Keep docs under 1 MiB.
- **Cloud Functions v2 cannot be deployed** (needs Blaze). The `functions/`
  pipeline is dormant.
- **Reel to Reality was removed (2026-07-16)** at the owner's request — the
  client-side caption/cover-frame extraction wasn't good enough. The `reels`
  tab, `src/features/reels/`, and the Mistral/Gemini env keys are gone. If it
  ever returns, the geocode helpers `geocodeViaGoogle`/`geocodeViaNominatim`
  still exist. Places are added manually (map ＋ FAB → `place/new`).

## SDK 57 notes (dormant — only relevant if the device situation changes)

## Removed in SDK 57 (do not use)

| Removed | Use instead |
|---|---|
| `expo-av` | `expo-video` (`useVideoPlayer` + `VideoView`), `expo-audio` |
| top-level `splash` key in app config | `expo-splash-screen` config plugin |
| `newArchEnabled` flag | nothing — New Architecture is the default |

`npx expo install expo-av` **succeeds** and installs `expo-av@16` — an
out-of-SDK version. A non-`~57.0.0` range on an `expo-*` package is the tell
that it is no longer part of the SDK.

## expo-router 57 vendors React Navigation — never install it

`expo-router` has **no `@react-navigation/*` dependency**. It ships its own copy
under `expo-router/build/react-navigation/*` and uses `standard-navigation`.

`npm i @react-navigation/bottom-tabs` installs a *second, different* copy, and
its `BottomTabBarProps` is structurally incompatible with what `<Tabs tabBar>`
actually passes — a confusing TS2322 on a prop that looks correct.

Import navigation types from the vendored path:
```ts
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
```
(`expo-router` declares no `exports` map, so deep imports resolve.)

Also available in SDK 57 and worth knowing: **`expo-glass-effect`** (a transitive
dep of expo-router) exposes native iOS Liquid Glass, which looks better than
`expo-blur` on iOS 26+. `src/shared/ui/Glass.tsx` uses expo-blur for
cross-platform parity.

## expo-file-system is class-based

`File` / `Directory` / `Paths`. The old function API (`readAsStringAsync`, …)
requires `import * as FileSystem from 'expo-file-system/legacy'`; most deprecated
methods **throw at runtime** if imported from the main entrypoint.

## firebase: Metro bundles the WEB auth build unless you set conditionNames

The `firebase` wrapper package's `./auth` export map has **no `react-native`
condition** (only node/browser/default), and SDK 57's default
`resolver.unstable_conditionNames` is **empty** — so Metro resolves
`firebase/auth` → web ESM build and `getReactNativePersistence` is `undefined`
**at runtime** (TypeError on app boot; tsc says nothing). The fix lives in
`lifemap-mobile/metro.config.js`:

```js
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];
```

This makes the inner `@firebase/auth` (which *does* declare `react-native`)
resolve to `dist/rn/index.js`. Verify after any firebase/Expo upgrade by
grepping the dev bundle for `getReactNativePersistence`.

## firebase: getReactNativePersistence is invisible to TypeScript

`@firebase/auth`'s `exports` map lists `"types"` **before** `"react-native"`.
TypeScript matches `"types"` first → resolves the **web** surface
(`auth-public.d.ts`), which omits `getReactNativePersistence`. Metro has no
`"types"` condition → matches `"react-native"` → loads `dist/rn/index.js`, which
exports it. So it works at runtime and fails `tsc`.

Do **not** paper over this with `@ts-ignore` at each call site. The single
sanctioned cast lives in `src/shared/lib/rn-persistence.ts`. Re-check on every
firebase upgrade; delete the shim if the symbol lands in `auth-public.d.ts`.

Never use bare `getAuth()` for the app's auth instance — RN defaults to
in-memory persistence and silently signs users out on every cold start.

## Version pins that must move together

- **NativeWind 4.2.x + Tailwind 3.4.x.** NativeWind v5 (Tailwind v4) is still
  preview — do not "upgrade" it. v4.2.0+ is what makes Reanimated 4 work.
- **Reanimated 4** pulls `react-native-worklets`. `babel-preset-expo` already
  injects `react-native-reanimated/plugin`; adding it (or the worklets plugin)
  to `babel.config.js` causes *Duplicate plugin/preset detected*.
- **`react-dom` must be pinned to exactly `react`'s version** (19.2.3). It gets
  hoisted transitively at a newer patch and breaks `npm install` with ERESOLVE.
  Fix by pinning, never by `--legacy-peer-deps`.

## Non-negotiables

- **Secrets.** `EXPO_PUBLIC_*` is inlined into the bundle and readable by anyone
  who downloads the app. The Gemini key lives in Cloud Functions only.
- **No Mapbox anywhere** (2026-07-16: requires billing info the owner won't
  provide). Maps are `react-native-maps` (Apple Maps on iOS — bundled in Expo
  Go, no token); geocoding is Nominatim in `functions/src/geocode.ts` (1 req/s
  throttle + User-Agent are load-bearing, not optional).
- **Google Places (New) IS used** for establishment search + photos — the owner
  has Google billing (unlike Mapbox). Key is `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
  (optional; falls back to Nominatim + Wikipedia when absent). It ships in the
  bundle — must be restricted to Places API + a daily quota cap, since there's
  no Cloud Function proxy on the free tier. **Never persist Google photos or
  details** (ToS forbids it, URLs expire): store only `googlePlaceId` + the
  user's own review/photos, fetch photos live via `useGooglePlaceDetails`.
- **GeoJSON is `[lng, lat]`.** Use `toGeoJSONPosition()` from
  `src/shared/types/domain.ts`. Swapping these puts pins in the ocean.
- **Country fills render only rollup countries** as native `<Polygon>` overlays
  from the bundled Natural Earth GeoJSON — see
  `src/features/map/countryPaint.ts`. Never render all 175 countries.
