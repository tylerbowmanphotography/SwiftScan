# SwiftScan: App Store listing

Copy these into App Store Connect → SwiftScan → the version page and App Information. Character limits are Apple's.

## App Information

- **Name** (30): SwiftScan: Price Checker
  - If "SwiftScan" alone is free, you can use just that. The name must be unique on the App Store.
- **Subtitle** (30): Snap it. Know what it's worth.
- **Primary category**: Shopping
- **Secondary category**: Utilities
- **Bundle ID**: store.swiftscan.app
- **Age rating**: answer "None" to every content question → 4+. (Store links open outside the app; there is no in-app web browsing of unrestricted content beyond store pages.)
- **Privacy Policy URL**: https://www.swiftscan.store/privacy
- **Support URL**: https://www.swiftscan.store
- **Copyright**: 2026 Tyler Bowman

## Version page

**Promotional text** (170)
Point your camera at a barcode or any item and get an AI price estimate, a deal verdict, and store links to compare before you buy.

**Description** (4000)
Is it a good deal? SwiftScan tells you in seconds.

Scan a barcode, snap a photo of a product, or search by name. SwiftScan identifies the item and gives you:

• A deal verdict: Incredible Steal, Good Deal, Fair Price, or Overpriced
• A fair price to aim for, a great-deal price, and the MSRP
• Store prices to compare, with one tap to the store
• The typical price range, so you know what "cheap" really is
• Pros, cons and key specs at a glance
• Answers to your questions about the product
• Stores near you that carry it

SAVE AND TRACK
Every scan is saved to your history. Bookmark the ones you care about. Sign in with just your email (no password) to sync your scans with swiftscan.store and get an email when a product drops to your target price.

HOW IT WORKS
Barcodes are matched against real product databases first. Photos and searches are identified by AI. Prices are AI estimates, not live quotes, so always check the store before you buy.

Free to use, with a daily scan limit.

**Keywords** (100)
price check,barcode scanner,deal,compare prices,shopping,UPC,product scanner,bargain,price tracker

**What's New** (first version): First release of SwiftScan for iPhone.

## Screenshots

Ready-made, 6.9" iPhone size (1320 × 2868), in the repo at `mobile/store/screenshots-6.9in/`. Upload in order:
1. Home
2. Scanner
3. Result with deal verdict
4. Store comparison and price range
5. Search
6. History

Apple scales these down for smaller iPhones automatically.

## App Review Information

- **Sign-in required**: No (sign-in is optional, so no demo account is needed)
- **Notes for the reviewer**:
  SwiftScan identifies products from a barcode, a photo, or a name and shows an AI-estimated fair price and deal verdict. To test: tap "Scan an item" and point at any retail barcode, or tap "Search by name" and choose a popular product. Sign-in is optional and uses a one-time email code. Account deletion: Account → Delete account. Store links are affiliate links (disclosed in the app); no purchases happen inside the app. There are no in-app purchases in this version.

## App Privacy ("nutrition label")

Answer **Yes, we collect data**, then:

| Data type | Collected | Linked to user | Tracking | Purpose |
|---|---|---|---|---|
| Contact Info → Email Address | Yes (only if signed in) | Yes | No | App Functionality |
| User Content → Photos | Yes (sent for analysis, not stored) | No | No | App Functionality |
| User Content → Other User Content (saved items, price alerts) | Yes (only if signed in) | Yes | No | App Functionality |
| Search History | Yes (product searches) | No | No | App Functionality |
| Identifiers → Device ID (scan-limit cookie) | Yes | No | No | App Functionality |

The iPhone app has no analytics SDK and no ads, so nothing is used for tracking.

## Export compliance

The app uses only standard HTTPS. `ITSAppUsesNonExemptEncryption` is already set to NO, so Apple won't ask.
