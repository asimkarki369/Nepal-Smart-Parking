# Nepal Smart Parking (NSP) — Claude Context

## Project Overview

Nepal Smart Parking is a React Native mobile app for parking management in Nepal. The codebase has two role-based apps:
- **Driver app** — located in `NSP/Driver-/` (primary active codebase)
- **Officer app** — `NSP/Officer-/` (empty, not started)
- `app/src/` — empty scaffold directories, ignore

## Tech Stack

- React Native 0.74.0 + TypeScript 5.0.4
- Navigation: `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`
- State: Zustand (`useStore.ts`)
- API: Axios (`api.ts`) — base URL is placeholder, currently uses `mockZones` data
- Map: `react-native-maps` (Google Maps on Android)
- Location: `react-native-geolocation-service`
- Payments: eSewa / Khalti / ConnectIPS (API stubs only)
- Icons: `react-native-vector-icons` (MaterialCommunityIcons)
- QR: `react-native-qrcode-svg`
- Notifications: `@notifee/react-native`

## File Layout (Driver app)

```
NSP/Driver-/
  AppNavigator.tsx      — navigation tree (stack + bottom tabs), auth gate
  HomeScreen.tsx        — map + nearby zones list (COMPLETE, uses mockZones)
  ZoneDetailScreen.tsx  — zone info + duration/vehicle picker + cost calc (COMPLETE)
  PaymentConfirmScreen  — STUB (placeholder only)
  SessionScreen.tsx     — STUB
  WalletScreen.tsx      — STUB
  LoginScreen.tsx       — STUB
  OTPScreen.tsx         — STUB
  RegisterScreen.tsx    — STUB
  HistoryScreen.tsx     — STUB
  useStore.ts           — Zustand store (User, ActiveSession, SessionHistory)
  api.ts                — Axios instance + API functions + mockZones[]
  theme.ts              — Colors, Typography, Spacing, BorderRadius constants
  metro.config.js       — default Metro config
  Package.json          — dependencies (note: capital P)
  tsconfig.json         — TS config (has issues — see blockers)
```

## Import Convention

All screens import from sibling files using relative paths (e.g., `'./theme'`, `'./api'`), not from a `src/` path alias. This is because everything lives flat in the `NSP/Driver-/` directory.

## State Shape (Zustand)

```ts
user: User | null          // set by setUser() after OTP verify
isAuthenticated: boolean
activeSession: ActiveSession | null
sessionHistory: SessionHistory[]
walletBalance: number
```

Auth gate is in `AppNavigator` — if `!isAuthenticated`, shows Login/OTP/Register stack.

## API

Base URL: `https://api.nepalsmsartparking.com/v1` (placeholder — backend not live)  
Auth token: currently hardcoded empty string in interceptor — needs AsyncStorage wiring.  
All screens currently use `mockZones` from `api.ts` instead of real API calls.

## Currency / Domain

- Currency: Nepalese Rupee (Rs)
- Vehicles: `'2w'` (bike/scooter) and `'4w'` (car/jeep)
- Zone codes: `Z-KMC-01` format (city prefix + number)
- Service fee: 10% on top of parking fee
- Payment gateways: eSewa, Khalti, ConnectIPS (Nepal-specific)

## Migration Status

**Expo migration: COMPLETE** — app runs on Android emulator as of 2026-05-31.
- Project: `NSPDriverExpo/` (Expo SDK 56, bare workflow, React Native 0.85.3)
- First build: 35 min (cold). Subsequent builds: ~14s (Gradle cache).
- Entry screen: LoginScreen (stub) — auth gate working correctly.
- Metro bundler: 1536 modules, ~9s bundle time.

## Android Local Run Blockers

### Critical (app won't build/start)

1. **No `android/` native project** — `react-native init` was never run or the android folder was deleted. Must run `npx react-native init` or scaffold android folder.
2. **No `App.tsx` / `index.js` entry point** — React Native needs a root `App.tsx` and an `index.js` that registers it. Neither exists.
3. **No `babel.config.js`** — React Native requires Babel config with `@react-native/babel-preset`.
4. **`Package.json` has capital P** — on case-sensitive systems (Linux CI, WSL) npm/yarn won't find it. Rename to `package.json`.
5. **Wrong `tsconfig.json`** — uses `"module": "ESNext"` and `"moduleResolution": "bundler"`. React Native requires `"module": "commonjs"` (or omit, Metro ignores it) and `"moduleResolution": "node"`.

### Native permissions / configuration required

6. **Google Maps API key** — `react-native-maps` on Android needs a key in `android/app/src/main/AndroidManifest.xml`.
7. **`react-native-vector-icons` manual linking** — requires adding font assets to `android/app/build.gradle` (or using autolinking with gradle config).
8. **Location permissions** — `react-native-geolocation-service` needs `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` in `AndroidManifest.xml` plus runtime permission request code.
9. **Camera permissions** — `react-native-camera` (listed in deps but not used in visible code) needs `CAMERA` permission.
10. **Notification permissions** — `@notifee/react-native` requires notification channel setup on Android 8+.

### Runtime issues (app starts but features break)

11. **Auth token not wired** — `api.ts` interceptor has empty string token; AsyncStorage read is a TODO comment.
12. **API backend not live** — all real API calls will 404/timeout; only `mockZones` works.
13. **Geolocation error ignored** — `HomeScreen` silently swallows geolocation errors (`() => {}`), so the map defaults to Kathmandu coordinates without user feedback.

## Development Workflow

```bash
# Install deps (from NSP/Driver-/)
npm install

# Start Metro bundler
npm start

# Run on Android (requires android/ folder + connected device/emulator)
npm run android
```

## Coding Conventions

- StyleSheet objects defined at bottom of each file
- Colors/Spacing/BorderRadius/Typography imported from `./theme`
- `any` type used in some places (gradual TS adoption)
- No test files exist yet
- No ESLint config file (lint script in package.json but no `.eslintrc`)
