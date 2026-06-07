# NSP Driver App — Migration Plan: React Native CLI → Expo (Bare Workflow)

## Why Bare Workflow

Managed workflow is off the table because Nepal-specific payment gateways (eSewa, Khalti, ConnectIPS) require native modules that Expo's managed sandbox cannot accommodate. Bare workflow gives us the full Expo toolchain (EAS Build, Expo Go during development, OTA updates) while keeping the `android/` and `ios/` folders available for native code.

---

## Current State Snapshot

| Area | Status |
|------|--------|
| `android/` folder | Missing |
| Entry point (`App.tsx`, `index.js`) | Missing |
| `babel.config.js` | Missing |
| Implemented screens | `HomeScreen`, `ZoneDetailScreen` |
| Stub screens | `LoginScreen`, `OTPScreen`, `RegisterScreen`, `SessionScreen`, `WalletScreen`, `PaymentConfirmScreen`, `HistoryScreen` |
| API backend | Placeholder URL, all data is mock |
| Officer app | Empty |

---

## Phase 0 — Environment Setup (Pre-migration)

**Goal:** Ensure the dev machine can build and run an Expo bare project before touching the existing code.

### 0.1 Install prerequisites
- Node.js 18 LTS or newer
- Java 17 (for Android builds) — set `JAVA_HOME`
- Android Studio with SDK Platform 34, Build Tools 34, NDX/NDK if needed
- Android emulator AVD (Pixel 6, API 34) **or** physical Android device with USB debugging on
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`

### 0.2 Verify Android toolchain
```bash
npx react-native doctor
```
All Android items must be green before proceeding.

### 0.3 Create Expo account
- Sign up at expo.dev
- Run `eas login` and authenticate

---

## Phase 1 — Scaffold New Expo Bare Project

**Goal:** Stand up a clean, runnable Expo bare project. Do not move any code yet.

### 1.1 Init project
```bash
# Run from D:\Nepal Smart Parking(NSP)\
npx create-expo-app NSPDriverExpo --template bare-minimum
cd NSPDriverExpo
```

### 1.2 Verify it runs
```bash
npx expo run:android
```
The default "Hello world" screen must appear on the emulator before moving on. If this fails, fix the environment — do not proceed until it passes.

### 1.3 Commit the clean scaffold
```bash
git init
git add .
git commit -m "chore: scaffold expo bare project"
```

---

## Phase 2 — Dependency Migration

**Goal:** Replace every CLI-era package with its Expo-compatible equivalent and install the correct versions.

### 2.1 Core Expo SDK packages

Install via `npx expo install` (not `npm install`) — this resolves the exact version compatible with the installed Expo SDK:

```bash
npx expo install \
  expo-location \
  expo-camera \
  expo-notifications \
  react-native-maps \
  react-native-safe-area-context \
  react-native-screens \
  @react-native-async-storage/async-storage \
  @react-native-picker/picker \
  react-native-gesture-handler \
  react-native-reanimated
```

### 2.2 Packages that stay (no Expo equivalent needed)
```bash
npm install \
  @react-navigation/native \
  @react-navigation/native-stack \
  @react-navigation/bottom-tabs \
  axios \
  zustand \
  date-fns \
  react-native-toast-message \
  react-native-qrcode-svg \
  react-native-svg
```

### 2.3 Icon replacement
Replace `react-native-vector-icons` with `@expo/vector-icons`. This is a drop-in for MaterialCommunityIcons with zero native linking:
```bash
npm install @expo/vector-icons
```
> `react-native-vector-icons` requires manual gradle linking in bare workflow. `@expo/vector-icons` is pre-bundled in the Expo font system — no linking needed.

### 2.4 Notification replacement
Replace `@notifee/react-native` with `expo-notifications`:
```bash
npx expo install expo-notifications expo-device
```

### 2.5 Remove unused / problematic deps
```bash
npm uninstall react-native-camera react-native-vector-icons @notifee/react-native react-native-geolocation-service
```
`react-native-camera` is listed in `Package.json` but unused in visible code — remove it. Geolocation is replaced by `expo-location`.

### 2.6 Install Expo config plugins for native packages
Some packages need config plugins declared in `app.json` to auto-patch native code during `expo prebuild`:

```json
// app.json — plugins section
{
  "expo": {
    "plugins": [
      ["expo-location", { "locationAlwaysAndWhenInUsePermission": "NSP needs location to find nearby parking zones." }],
      ["expo-camera", { "cameraPermission": "NSP needs camera access to scan QR codes." }],
      "expo-notifications",
      ["react-native-maps", { "googleMapsApiKey": "YOUR_GOOGLE_MAPS_KEY" }]
    ]
  }
}
```

---

## Phase 3 — Project Structure Reorganization

**Goal:** Adopt Expo/RN community standard folder structure. All current source files live flat in `NSP/Driver-/` — this must be reorganized.

### 3.1 Target folder structure

```
NSPDriverExpo/
  app.json              — Expo config (name, slug, plugins, permissions)
  App.tsx               — root entry, renders <AppNavigator />
  index.js              — registers App with AppRegistry (Expo bare)
  babel.config.js       — Expo preset
  tsconfig.json         — Expo-standard TS config
  src/
    navigation/
      AppNavigator.tsx
      types.ts          — RootStackParamList, MainTabParamList (extracted)
    screens/
      auth/
        LoginScreen.tsx
        OTPScreen.tsx
        RegisterScreen.tsx
      main/
        HomeScreen.tsx
        SessionScreen.tsx
        WalletScreen.tsx
        HistoryScreen.tsx
        ZoneDetailScreen.tsx
        PaymentConfirmScreen.tsx
    services/
      api.ts
    store/
      useStore.ts
    utils/
      theme.ts
      permissions.ts    — new: centralised permission request helpers
    components/         — new: shared UI components extracted from screens
      OccupancyTag.tsx
      ZonePin.tsx
  assets/
    icon.png
    splash.png
  android/              — generated by expo prebuild
  ios/                  — generated by expo prebuild
```

### 3.2 `tsconfig.json` — Expo standard
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```
> The `expo/tsconfig.base` preset sets the correct `module`, `moduleResolution`, `jsx` etc. Never configure those manually.

### 3.3 `babel.config.js` — Expo standard
```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

### 3.4 `App.tsx` — root entry
```tsx
import 'react-native-gesture-handler'; // must be first import
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
```

---

## Phase 4 — Source Code Migration

**Goal:** Copy each source file into the new structure, apply targeted fixes for Expo API differences. Do one module at a time, verify build after each.

### 4.1 Theme & Store (no API changes needed)
- Copy `theme.ts` → `src/utils/theme.ts`
- Copy `useStore.ts` → `src/store/useStore.ts`
- No code changes required — pure TypeScript, no native dependencies.

### 4.2 Navigation
- Copy `AppNavigator.tsx` → `src/navigation/AppNavigator.tsx`
- Extract `RootStackParamList` and `MainTabParamList` into `src/navigation/types.ts`
- Update imports in all screens to use `from '@/navigation/types'`

### 4.3 API service
- Copy `api.ts` → `src/services/api.ts`
- Wire auth token from AsyncStorage:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### 4.4 Icon swap — `react-native-vector-icons` → `@expo/vector-icons`
Every file that imports icons needs a one-line change:
```ts
// Before
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// After
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
```
Affected files: `AppNavigator.tsx`, `HomeScreen.tsx`, `ZoneDetailScreen.tsx`

### 4.5 Geolocation — `react-native-geolocation-service` → `expo-location`
In `HomeScreen.tsx`:
```ts
// Before
import Geolocation from 'react-native-geolocation-service';
Geolocation.getCurrentPosition(success, error, options);

// After
import * as Location from 'expo-location';

const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') {
  // show user-facing error — do not silently swallow
  return;
}
const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
```
> Fix the silent error swallow (`() => {}`) at the same time — show a Toast or Alert when location is denied.

### 4.6 Notifications — `@notifee/react-native` → `expo-notifications`
Currently unused in visible code. Set up the foundation:
```ts
// src/utils/notifications.ts
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}
```

### 4.7 Maps
`react-native-maps` works in Expo bare workflow without changes. The only difference: the Google Maps API key is declared in `app.json` under the plugin config (Phase 2.6) rather than directly in `AndroidManifest.xml`.

### 4.8 Screen-by-screen implementation (stub screens)
Each stub screen needs to be implemented. Suggested order based on user flow:

1. `LoginScreen` — phone number input → calls `authAPI.sendOTP`
2. `OTPScreen` — 6-digit OTP input → calls `authAPI.verifyOTP` → stores token in AsyncStorage → calls `store.setUser`
3. `RegisterScreen` — name, plate number, vehicle type → calls `authAPI.register`
4. `SessionScreen` — show active session timer, extend/stop controls, QR code display
5. `WalletScreen` — balance display, top-up with eSewa/Khalti/ConnectIPS
6. `PaymentConfirmScreen` — order summary → trigger payment gateway
7. `HistoryScreen` — paginated session history list

> Each of these is a separate task, not part of the migration itself. The migration ends when stubs are ported as stubs — implementation is a follow-on.

### 4.9 Camera / QR scanning
`react-native-camera` was listed as a dependency but is unused. When QR scanning is needed (Officer app or session check-in):
```bash
npx expo install expo-camera expo-barcode-scanner
```

---

## Phase 5 — Native Build & Permissions Audit

**Goal:** Run `expo prebuild` to generate `android/` and `ios/`, verify all permissions are correctly declared.

### 5.1 Run prebuild
```bash
npx expo prebuild --clean
```
This generates `android/` and `ios/` from `app.json` config plugins. Do not manually edit `AndroidManifest.xml` after this — use config plugins instead, or changes will be overwritten on the next prebuild.

### 5.2 Verify Android permissions in generated manifest
After prebuild, check `android/app/src/main/AndroidManifest.xml` contains:
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `CAMERA`
- `POST_NOTIFICATIONS` (Android 13+)
- `INTERNET`

If any are missing, add them via the relevant config plugin, not by hand-editing the manifest.

### 5.3 First real Android build
```bash
npx expo run:android
```
Milestone: app launches on emulator/device showing the current Home screen with mock zones.

---

## Phase 6 — EAS Build Setup

**Goal:** Move builds off the local machine to Expo's cloud build service (EAS Build). Required for distributing to testers and eventually the Play Store.

### 6.1 Configure EAS
```bash
eas build:configure
```
This creates `eas.json`:
```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "aab" }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 6.2 Development build (replaces Expo Go for bare workflow)
```bash
eas build --profile development --platform android
```
Install the resulting APK on the device. From then on, run `npx expo start --dev-client` and scan the QR code — no USB required.

### 6.3 Preview builds for internal testing
```bash
eas build --profile preview --platform android
```
Share the APK link with testers via EAS's shareable URL.

---

## Phase 7 — Environment & Config Hardening

**Goal:** Remove hardcoded values and set up proper environment config.

### 7.1 Environment variables via `app.config.js`
Rename `app.json` → `app.config.js` to enable dynamic config:
```js
export default ({ config }) => ({
  ...config,
  extra: {
    apiBaseUrl: process.env.API_BASE_URL ?? 'https://api.nepalsmsartparking.com/v1',
    googleMapsKey: process.env.GOOGLE_MAPS_KEY,
  },
});
```

### 7.2 Read config in app
```ts
import Constants from 'expo-constants';
const BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl;
```

### 7.3 `.env` files
```
.env.development   — local/dev API URL
.env.production    — production API URL
```
Add both to `.gitignore`. Store secrets in EAS Secrets (`eas secret:create`).

---

## Phase 8 — Officer App

**Goal:** Scaffold the Officer app as a second app inside the monorepo once the Driver app migration is stable.

> Do not start this phase until Phase 5 is complete and the Driver app runs end-to-end.

### 8.1 Monorepo structure decision
Two options:
- **Option A — Separate Expo project** (`NSPOfficerExpo/` sibling directory): simplest, each app has its own `package.json` and `eas.json`.
- **Option B — Expo monorepo** (yarn workspaces or pnpm): share `theme.ts`, `api.ts`, `useStore.ts` as a shared package. More setup but eliminates duplication when both apps are active.

Recommendation: Start with Option A. Move to Option B only if shared code divergence becomes a maintenance problem.

### 8.2 Officer app screens (planned)
- Login (shared OTP flow with Driver)
- Dashboard — active sessions count, zone occupancy overview
- Scan QR — camera scan to verify a driver's session token
- Issue Challan — fine creation flow
- Zone Management — view/edit zone capacity

---

## Phase Completion Checklist

| Phase | Deliverable | Done |
|-------|------------|------|
| 0 | Android toolchain green, Expo account ready | [ ] |
| 1 | Clean Expo bare project runs on emulator | [ ] |
| 2 | All dependencies installed, old deps removed | [ ] |
| 3 | Folder structure reorganized, tsconfig/babel correct | [ ] |
| 4 | All source files migrated, icons/location/notifications swapped | [ ] |
| 5 | `expo prebuild` succeeds, `expo run:android` launches app | [ ] |
| 6 | EAS Build configured, dev build APK distributed to team | [ ] |
| 7 | No hardcoded keys/URLs, env vars in EAS Secrets | [ ] |
| 8 | Officer app scaffolded (post-Driver-stable) | [ ] |

---

## Key Rules for the Entire Migration

1. **Use `npx expo install`** for any new package — never `npm install` for RN-native packages. It pins compatible versions automatically.
2. **Never manually edit `AndroidManifest.xml`** — use config plugins in `app.json`. Manual edits are wiped on `expo prebuild --clean`.
3. **`expo prebuild --clean` is destructive** — it regenerates `android/` and `ios/` from scratch. Any manual native edits will be lost. If you need custom native code, write a config plugin or use a bare-workflow patch.
4. **One import alias** — use `@/` (mapped to `src/`) for all internal imports. Never use `../../..` chains.
5. **Verify build after each phase** — don't accumulate changes across phases without a passing build check.
