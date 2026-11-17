# AKNU Hostels Android Mobile App — Build & Packaging Guide

## 1. Overview
The AKNU Hostels mobile application is built with React Native and Expo, providing camera-accelerated meal scanning for Wardens and personal cryptographic QR credentials for Students.

---

## 2. Local Development Running

```bash
cd mobile
npm install

# Start development bundler
npx expo start

# Run directly on connected Android device / emulator
npx expo start --android
```

---

## 3. Production Android APK Generation via EAS Build

### Step 1: Install EAS CLI and Authenticate
```bash
npm install -g eas-cli
eas login
```

### Step 2: Configure EAS Build (`eas.json`)
Create `mobile/eas.json`:
```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "env": {
        "API_BASE_URL": "https://hostels.aknu.edu.in/api/v1"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "API_BASE_URL": "https://hostels.aknu.edu.in/api/v1"
      }
    }
  }
}
```

### Step 3: Trigger Android Build
```bash
# Build standalone installable APK (for testing on warden / staff phones)
eas build --platform android --profile preview

# Build production AAB for Google Play Store deployment
eas build --platform android --profile production
```

---

## 4. Building Native Android Project Locally (Prebuild)

If you prefer building locally via Android Studio / Gradle:
```bash
# Generate native Android project folder
npx expo run:android

# Or assemble release APK via Gradle:
cd android
./gradlew assembleRelease
# The APK will be generated at android/app/build/outputs/apk/release/app-release.apk
```
