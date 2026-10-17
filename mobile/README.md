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

## Releasing to the App Store

You need an Apple Developer Program membership and a free expo.dev account. Builds run in Expo's cloud, so no Mac is needed.

### 1. First release (once, ~30 minutes, mostly waiting)

Apple only lets the first signing certificate be created with your own Apple ID sign-in, so this step is run by you:

- **On any computer:** `bash mobile/scripts/first-release.sh`
- **No computer?** On github.com open the repo → **Code** → **Codespaces** → **Create codespace**. When the terminal appears, run `bash mobile/scripts/first-release.sh`.

When it asks, sign in to Expo and to your Apple ID, and answer **yes** to letting Expo generate the distribution certificate, provisioning profile and App Store Connect API key. The build is uploaded to App Store Connect and shows up in TestFlight about 15 minutes later.

### 2. Connect GitHub (once)

In the repo: **Settings → Secrets and variables → Actions**

| Type | Name | Value |
|---|---|---|
| Secret | `EXPO_TOKEN` | expo.dev → Account settings → Access tokens → Create |
| Variable | `ASC_APP_ID` | App Store Connect → SwiftScan → App Information → **Apple ID** (a number) |

### 3. Every release after that

**Actions → iPhone release → Run workflow.** It checks the code, builds on EAS (the build number goes up automatically) and uploads to App Store Connect. Bump `version` in `app.json` when you want a new public version number.

### Instant updates (no build, no review)

Design and screen changes (anything in `mobile/src` or `mobile/assets`) go out automatically when they land on `main`: the **iPhone instant update** workflow publishes an Expo over-the-air update, and phones pick it up the next time the app is opened twice. You can also run it by hand from Actions.

It only reaches builds with the same native setup. After adding a native library, a permission, or changing the app icon, run **iPhone release** for a full build instead (and bump `version` in `app.json` for the App Store).

### 4. Send it for review (in App Store Connect)

Fill in the listing (ready-to-paste text is in the SwiftScan project doc "app-store-listing.md"), upload the iPhone screenshots from `mobile/store/screenshots-6.9in/`, answer the privacy questions, pick the build, and **Submit for Review**.

## App Store notes

- **Account deletion** is in the app (Account → Delete account), backed by `POST /api/account/delete`, which also cancels an active Pro subscription.
- **Pro purchases**: the app has no "Buy Pro" button on purpose. Selling digital upgrades inside an iOS app generally has to use Apple In-App Purchase, so people who bought Pro on the web just sign in. Don't mention web pricing inside the app.
- **Sign-in is optional**, so App Review doesn't need a demo account.

## Project layout

```
src/app/        screens (Expo Router): index, scan, search, result, history, account
src/components/ shared UI
src/lib/        api client, types (copied from ../src/types.ts), affiliate links, store, theme
```

`src/lib/types.ts` and `src/lib/affiliate.ts` are copies of the web app's `src/types.ts` and `src/utils/affiliate.ts`; keep them in sync when the API changes.
