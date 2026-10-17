# SwiftScan for iPhone (Expo)

The native SwiftScan app, built with Expo and Expo Router. It uses the same backend as the web app (`https://www.swiftscan.store/api/*`), so scans, accounts, saved items, price alerts and Pro all work the same way.

## What's in it

- **Scan**: live barcode scanning (UPC/EAN), product photos with the shutter, or a photo from your library. Flashlight toggle.
- **Search**: by product name or barcode number, with autocomplete.
- **Result**: deal verdict, good price / great deal / MSRP, store comparison (affiliate links + disclosure, same as web), typical price range, pros and cons, key specs, ask-a-question, nearby stores, price-drop alert, share and bookmark.
- **History**: every scan saved on the phone, searchable, bookmarks; synced to the account when signed in.
- **Account**: email one-time-code sign-in (same as web). Pro bought on the web works after signing in.

## Run it on your iPhone today (no Mac needed)

1. Install **Expo Go** from the App Store.
2. On a computer with Node 20+:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
3. Scan the QR code with the iPhone Camera app. It opens in Expo Go.

To point the app at a different backend (e.g. a Vercel preview), set `EXPO_PUBLIC_API_BASE=https://your-preview.vercel.app` before `npx expo start`.

## Build for TestFlight / the App Store

Needs an Apple Developer account ($99/year) and a free expo.dev account. Builds run in the cloud.

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure     # links the project to your expo.dev account
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --latest
```

The bundle identifier is `store.swiftscan.app` (in `app.json`). Change it before the first build if you want a different one; it can't change after release.

## Before submitting to the App Store

- **Account deletion**: Apple requires apps with sign-in to let users delete their account from inside the app. The backend has no delete-account endpoint yet; add one and a "Delete account" button on the Account screen.
- **Pro purchases**: the app deliberately has no "Buy Pro" button. Selling digital upgrades inside an iOS app generally has to go through Apple In-App Purchase, so for now people who bought Pro on the web just sign in. Adding IAP is a separate step.
- **Privacy labels**: in App Store Connect, declare the camera/photos use, email (account), and that Google Analytics/AdSense are only on the website, not in the app.

## Project layout

```
src/app/        screens (Expo Router): index, scan, search, result, history, account
src/components/ shared UI
src/lib/        api client, types (copied from ../src/types.ts), affiliate links, store, theme
```

`src/lib/types.ts` and `src/lib/affiliate.ts` are copies of the web app's `src/types.ts` and `src/utils/affiliate.ts`; keep them in sync when the API changes.
