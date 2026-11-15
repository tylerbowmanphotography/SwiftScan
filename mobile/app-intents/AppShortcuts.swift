import AppIntents

/// SwiftScan's Siri phrases. They're compiled into the app (Apple's limit is 10 App Shortcuts) and
/// every phrase must include the app name. Siri asks for anything a phrase doesn't include.
/// These also appear in Spotlight, the Shortcuts app, and the Action button / Control Center /
/// Lock Screen pickers.
struct AppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: ScanPriceIntent(),
      phrases: [
        "Scan a price in \(.applicationName)",
        "Scan a price with \(.applicationName)",
        "Scan a barcode with \(.applicationName)",
        "Open the \(.applicationName) scanner",
        "Scan with \(.applicationName)",
      ],
      shortTitle: "Scan a Price",
      systemImageName: "barcode.viewfinder"
    )
    AppShortcut(
      intent: CheckPriceIntent(),
      phrases: [
        "Price check in \(.applicationName)",
        "Check a price with \(.applicationName)",
        "Check a price in \(.applicationName)",
        "Is it a good deal in \(.applicationName)",
        "Ask \(.applicationName) for a price",
      ],
      shortTitle: "Check a Price",
      systemImageName: "tag"
    )
    AppShortcut(
      intent: SavedPriceIntent(),
      phrases: [
        "What's \(\.$item) worth in \(.applicationName)",
        "Check \(\.$item) in \(.applicationName)",
        "Get the price of \(\.$item) from \(.applicationName)",
        "Get a saved price from \(.applicationName)",
      ],
      shortTitle: "Saved Price",
      systemImageName: "clock.arrow.circlepath"
    )
    AppShortcut(
      intent: WatchPriceIntent(),
      phrases: [
        "Watch a price in \(.applicationName)",
        "Watch \(\.$item) in \(.applicationName)",
        "Tell me when \(\.$item) drops in \(.applicationName)",
        "Set a price alert in \(.applicationName)",
      ],
      shortTitle: "Watch a Price",
      systemImageName: "bell.badge"
    )
  }
}
