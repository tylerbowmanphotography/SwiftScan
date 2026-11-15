internal import ExpoAppIntents
internal import ExpoModulesCore

/// Registered Expo inline module that wires app-target App Intents code to expo-app-intents.
/// Do not change the name of this class.
final class AppIntentsSetup: Module {
  public func definition() -> ExpoModulesCore.ModuleDefinition {
    Name("AppIntentsSetup")

    OnCreate {
      // Scanned items go into Spotlight's semantic index, which Siri AI reads.
      if #available(iOS 18.0, *) {
        AppEntityIdentifierRegistry.shared.registerIndexed("scannedItem", as: ScannedItemEntity.self)
      }

      // Lets the app tell iOS when the user scans or price-checks, so Siri learns and suggests it.
      AppIntentDonationRegistry.shared.register("openScanner", as: ScanPriceIntent.self)
      AppIntentDonationRegistry.shared.register("checkPrice", as: CheckPriceIntent.self)

      Task {
        await AppIntentDispatcher.shared.setShortcutsRefreshHandler {
          AppShortcuts.updateAppShortcutParameters()
        }
        AppShortcuts.updateAppShortcutParameters()
      }
    }
  }
}
