---
name: lifemap-stack
description: Version landmines and hard constraints for the LifeMap AI Expo SDK 57 stack. Read BEFORE adding a dependency, importing an Expo/Firebase module, or touching babel/metro/tailwind config in lifemap-mobile. Triggers on expo-av, expo-file-system, splash, newArchEnabled, getReactNativePersistence, nativewind, reanimated, firebase auth persistence.
---

# LifeMap stack constraints

Verified against this repo on 2026-07-14. Each item cost a real debugging cycle —
don't re-derive them, and don't trust pre-SDK-57 training data or blog posts.

## Always check the versioned docs first

`lifemap-mobile/AGENTS.md` says to read https://docs.expo.dev/versions/v57.0.0/
before writing code. This is not boilerplate — SDK 57 **removed** APIs that every
tutorial still uses. A 404 on `docs.expo.dev/versions/v57.0.0/sdk/<pkg>/` means
the package is gone from the SDK.

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
- **GeoJSON is `[lng, lat]`.** Use `toGeoJSONPosition()` from
  `src/shared/types/domain.ts`. Swapping these puts pins in the ocean.
- **Country fills render only rollup countries** as native `<Polygon>` overlays
  from the bundled Natural Earth GeoJSON — see
  `src/features/map/countryPaint.ts`. Never render all 175 countries.
