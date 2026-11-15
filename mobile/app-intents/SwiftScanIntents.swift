import AppIntents
internal import ExpoAppIntents
internal import ExpoModulesCore
import Foundation

// MARK: - Open the scanner

/// "Hey Siri, scan a price in SwiftScan." Opens straight to the barcode scanner. Also the action to
/// pick for the Action button, Control Center or the Lock Screen (iOS lists App Shortcuts there).
struct ScanPriceIntent: AppIntent {
  static let title: LocalizedStringResource = "Scan a Price"
  static var description: IntentDescription? {
    IntentDescription("Opens SwiftScan's camera to scan a barcode or photograph an item and check its price.")
  }
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "openScanner", params: [:])
    return .result()
  }
}

// MARK: - Check a price by voice

/// "Hey Siri, price check in SwiftScan" → "What product?" → "AirPods Pro". Siri reads back the fair
/// price and the deal price without opening the app. The check is also added to "Your scans".
struct CheckPriceIntent: AppIntent {
  static let title: LocalizedStringResource = "Check a Price"
  static var description: IntentDescription? {
    IntentDescription("Finds a fair price and a great-deal price for any product, without opening SwiftScan.")
  }
  static let openAppWhenRun = false

  @Parameter(title: "Product", requestValueDialog: "What do you want to price check?")
  var product: String

  static var parameterSummary: some ParameterSummary {
    Summary("Check the price of \(\.$product)")
  }

  func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
    let query = product.trimmingCharacters(in: .whitespacesAndNewlines)
    guard query.count >= 2 else {
      let text = "Tell me the name of a product to price check."
      return .result(value: text, dialog: "\(text)")
    }
    switch await SwiftScanAPI.checkPrice(query) {
    case .found(let check):
      await AppIntentDispatcher.shared.dispatch(name: "priceChecked", params: ["result": .string(check.resultJSON)])
      let text = SwiftScanAPI.summary(
        name: check.productName, msrp: check.msrp, goodPrice: check.goodPrice,
        greatDealPrice: check.greatDealPrice, rating: check.priceRating)
      return .result(value: text, dialog: "\(text)")
    case .limit(let message):
      let text = message + " SwiftScan Pro has unlimited price checks."
      return .result(value: text, dialog: "\(text)")
    case .failed(let message):
      return .result(value: message, dialog: "\(message)")
    }
  }
}

// MARK: - Saved price (instant, no network)

/// "Hey Siri, what's AirPods Pro worth in SwiftScan?" for something already scanned: answers from the
/// saved price check, instantly and without using a scan.
struct SavedPriceIntent: AppIntent {
  static let title: LocalizedStringResource = "Get a Saved Price"
  static var description: IntentDescription? {
    IntentDescription("Reads back the price check for an item you already scanned in SwiftScan.")
  }
  static let openAppWhenRun = false

  @Parameter(title: "Item", requestValueDialog: "Which item?")
  var item: ScannedItemEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Get the saved price of \(\.$item)")
  }

  func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
    let text = item.spokenSummary
    return .result(value: text, dialog: "\(text)")
  }
}

// MARK: - Watch a price by voice

/// "Hey Siri, watch a price in SwiftScan" → "Which item?" → picks from recent scans. Sets an email
/// alert for when the price drops to the great-deal price. Needs a signed-in account.
struct WatchPriceIntent: AppIntent {
  static let title: LocalizedStringResource = "Watch a Price"
  static var description: IntentDescription? {
    IntentDescription("Emails you when an item you scanned drops to a great-deal price.")
  }
  static let openAppWhenRun = false

  @Parameter(title: "Item", requestValueDialog: "Which item should I watch?")
  var item: ScannedItemEntity

  @Parameter(title: "Target price", description: "Leave empty to use SwiftScan's great-deal price.")
  var targetPrice: Double?

  static var parameterSummary: some ParameterSummary {
    Summary("Watch the price of \(\.$item)") {
      \.$targetPrice
    }
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let target = (targetPrice ?? 0) > 0 ? (targetPrice ?? 0) : (item.greatDealPrice > 0 ? item.greatDealPrice : item.goodPrice)
    guard target > 0 else {
      return .result(dialog: "SwiftScan doesn't have a price for \(item.name) yet. Scan it again first.")
    }
    switch await SwiftScanAPI.watchPrice(productName: item.name, brand: item.brand, targetPrice: target) {
    case .saved:
      await AppIntentDispatcher.shared.dispatch(
        name: "priceWatched", params: ["id": .string(item.id), "targetPrice": .double(target)])
      let text = "Done. SwiftScan will email you when \(item.name) drops to \(SwiftScanAPI.money(target)) or less."
      return .result(dialog: "\(text)")
    case .signInRequired:
      return .result(dialog: "Price alerts need a SwiftScan account. Open SwiftScan, tap Account, and sign in with your email first.")
    case .failed(let message):
      return .result(dialog: "\(message)")
    }
  }
}

// MARK: - Open an item (Spotlight / Siri AI)

/// Opens a scanned item's result screen, used when someone taps it in Spotlight or asks Siri to show it.
struct OpenScannedItemIntent: OpenIntent {
  static let title: LocalizedStringResource = "Open Scanned Item"
  static let openAppWhenRun = true

  @Parameter(title: "Item")
  var target: ScannedItemEntity

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "openItem", params: ["id": .string(target.id)])
    return .result()
  }
}

// MARK: - Learning from use (Siri suggestions and Siri AI)

extension ScanPriceIntent: DonatableAppIntent {}

extension CheckPriceIntent: DonatableAppIntent {
  struct DonationParams: Record {
    @Field(.required) var product: String = ""
  }

  init(donationParams: DonationParams) {
    self.init()
    self.product = donationParams.product
  }
}
