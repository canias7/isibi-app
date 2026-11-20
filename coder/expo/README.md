# Coder for phones (Expo)

Coder's phone app with real phone screens (React Native, Expo SDK 58, expo-router).
It talks to the same live Coder at https://gofarther.dev, with the same sign-in
(a code we email, no password). Nothing on the server changed for it.

The older phone app in `coder/mobile/` (gofarther.dev inside an app) is still there.

## What it does (version 1)

- Sign in with an emailed code.
- Your chats (recents), and a new chat: pick one of your GitHub repositories.
- A chat: your messages, Coder's answers (markdown), its steps folded into one line
  (tap to open), live updates while Coder works, the message box, Stop, the
  permission and question cards with their buttons, and the mode, model and effort pickers.
- Settings: who is signed in, GitHub, the model and effort, and Sign out.

## Try it on your phone (Expo Go, free)

1. Install **Expo Go** from the App Store or Google Play.
2. On a computer with Node 20 or newer:
   ```
   cd coder/expo
   npm install
   npx expo start
   ```
3. Scan the QR code it shows: with the iPhone camera, or from inside Expo Go on Android.
   The phone and the computer must be on the same Wi-Fi (or run `npx expo start --tunnel`).
4. Sign in with your email, as on gofarther.dev.

## Checks

```
npm run typecheck
npm test
```

## Real app builds later (EAS)

When you want an app to install without Expo Go, or to send to TestFlight / Google Play:

1. `npm install -g eas-cli`, then `eas login` (a free Expo account).
2. `eas build:configure` once, in `coder/expo`.
3. `eas build --platform android --profile preview` gives an `.apk` to install.
4. `eas build --platform ios` needs your Apple developer account (paid by Apple, $99 a year).

EAS has a free tier with a limited number of builds a month; nothing here uses it yet.

## Where things are

| Path | What it is |
|---|---|
| `src/app/` | The screens (each file is one): `sign-in`, `chats`, `new`, `chat/[id]`, `settings` |
| `src/lib/auth.ts` | Sign-in, the session and its renewal (kept in the phone's secure store) |
| `src/lib/api.ts` | The calls to `/api/coder/*` |
| `src/lib/chat.ts` | What the chat shows, worked out from Coder's events |
| `src/lib/useChat.ts` | One open chat: loads it, follows it live, sends, stops, answers |
| `src/components/` | The chat rows and cards, markdown, pickers, the typewriter logo |
| `src/__tests__/` | Tests (jest-expo) |
