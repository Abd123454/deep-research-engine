# Quaesitor Mobile (Expo)

## Setup

```bash
cd mobile
npm install
npx expo start
```

## Features

- **Chat** — streaming SSE from Quaesitor backend
- **Research** — start + monitor research jobs
- **Settings** — API keys, instance URL, theme, language
- **Biometric auth** — FaceID/TouchID via expo-local-authentication
- **Push notifications** — research completion via expo-notifications
- **Deep linking** — quaesitor://chat/{id}

## Configuration

1. Set your Quaesitor instance URL in Settings
2. Generate an API key at /api/keys on your Quaesitor instance
3. Enter the API key in Settings

## Build

```bash
# Android
npx expo run:android

# iOS
npx expo run:ios

# EAS Build (for App Store / Play Store)
eas build --platform all
```

## Design

Uses the Quaesitor "Amber & Ink" palette:
- Background: #f4f1ea (aged paper)
- Text: #2a2620 (sepia ink)
- Primary: #8b4513 (saddle brown)
- Muted: #6b6358 (faded ink)
- Border: #d9d4c7 (deckle edge)
