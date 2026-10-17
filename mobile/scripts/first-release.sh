#!/usr/bin/env bash
# One-time first iPhone release. Run it yourself (on any computer, or in a GitHub Codespace):
#   bash mobile/scripts/first-release.sh
# It signs you in to Expo, then builds the app and uploads it to App Store Connect.
# When it asks, sign in with your Apple ID and let Expo create/manage the certificate,
# provisioning profile and App Store Connect API key (answer "yes" to those prompts).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Installing app dependencies"
npm ci

echo "==> Signing in to Expo (create a free account at expo.dev if you don't have one)"
npx --yes eas-cli@latest whoami >/dev/null 2>&1 || npx --yes eas-cli@latest login

echo "==> Linking the Expo project"
npx --yes eas-cli@latest init

echo "==> Building for iPhone and uploading to App Store Connect (takes ~20-30 minutes)"
npx --yes eas-cli@latest build --platform ios --profile production --auto-submit

cat <<'MSG'

Done. Next:
 1. In App Store Connect (appstoreconnect.apple.com) open the SwiftScan app.
    Under "App Information", copy the "Apple ID" number.
 2. In GitHub: Settings → Secrets and variables → Actions
      - Variables tab: add ASC_APP_ID = that number
      - Secrets tab:   add EXPO_TOKEN  = an access token from expo.dev → Account settings → Access tokens
 3. Future releases: Actions → "iPhone release" → Run workflow.
MSG
