import AppIntents
@preconcurrency import CoreSpotlight
internal import ExpoAppIntents
import Foundation

private func normalizeItemText(_ value: String) -> String {
  return value
    .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
    .trimmingCharacters(in: .whitespacesAndNewlines)
}

/// A product the user has checked in SwiftScan ("Your scans"). The app publishes its recent scans
/// with `setEntityCatalogAsync('scannedItem', ...)`; Siri, Shortcuts, Spotlight and Siri AI resolve
/// spoken product names against that list, and the saved price check answers instantly.
struct ScannedItemEntity: AppEntity, AppIntentEntityRecordConvertible {
  static let kind = "scannedItem"
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Scanned Item"
  static let defaultQuery = ScannedItemQuery()

  var id: String
  @Property(title: "Product")
  var name: String
  @Property(title: "Brand")
  var brand: String
  var subtitle: String?
  var synonyms: [String]
  var msrp: Double
  var goodPrice: Double
  var greatDealPrice: Double
  var priceRating: String
  var isHiddenInSpotlight: Bool

  init(record: AppIntentEntityRecord) {
    func num(_ key: String) -> Double { Double(record.metadata[key] ?? "") ?? 0 }
    self.id = record.id
    self.subtitle = record.subtitle
    self.synonyms = record.synonyms
    self.msrp = num("msrp")
    self.goodPrice = num("goodPrice")
    self.greatDealPrice = num("greatDealPrice")
    self.priceRating = record.metadata["priceRating"] ?? "FAIR"
    self.isHiddenInSpotlight = record.hideInSpotlight
    self.name = record.title
    self.brand = record.metadata["brand"] ?? ""
  }

  var displayRepresentation: DisplayRepresentation {
    if #available(iOS 17.0, *) {
      if let subtitle {
        return DisplayRepresentation(
          title: "\(name)", subtitle: "\(subtitle)",
          synonyms: synonyms.map { LocalizedStringResource(stringLiteral: $0) })
      }
      return DisplayRepresentation(title: "\(name)", synonyms: synonyms.map { LocalizedStringResource(stringLiteral: $0) })
    }
    if let subtitle {
      return DisplayRepresentation(title: "\(name)", subtitle: "\(subtitle)")
    }
    return DisplayRepresentation(title: "\(name)")
  }

  var spokenSummary: String {
    return SwiftScanAPI.summary(name: name, msrp: msrp, goodPrice: goodPrice, greatDealPrice: greatDealPrice, rating: priceRating)
  }

  func matches(_ searchText: String) -> Bool {
    let search = normalizeItemText(searchText)
    guard !search.isEmpty else { return false }
    return ([id, name, brand] + synonyms).map(normalizeItemText).contains { term in
      !term.isEmpty && (search == term || search.contains(term) || term.contains(search))
    }
  }
}

/// Resolves scanned items from the catalog the app publishes. Most recent scans come first.
struct ScannedItemQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [ScannedItemEntity] {
    return try await AppIntentEntityStore.shared.entities(ofKind: ScannedItemEntity.kind, matching: identifiers)
      .map(ScannedItemEntity.init(record:))
  }

  func suggestedEntities() async throws -> [ScannedItemEntity] {
    return try await AppIntentEntityStore.shared.entities(ofKind: ScannedItemEntity.kind)
      .map(ScannedItemEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [ScannedItemEntity] {
    return try await suggestedEntities().filter { $0.matches(string) }
  }
}

/// Lets the system list every scanned item, which Spotlight (and Siri AI's semantic index) needs.
@available(iOS 18.0, *)
extension ScannedItemQuery: EnumerableEntityQuery {
  func allEntities() async throws -> [ScannedItemEntity] {
    return try await suggestedEntities()
  }
}

/// Puts scanned items in the Spotlight semantic index, so Siri AI can find and act on them.
@available(iOS 18.0, *)
extension ScannedItemEntity: IndexedEntity {
  static let spotlightDomainIdentifier = "store.swiftscan.app.scannedItem"

  var hideInSpotlight: Bool {
    return isHiddenInSpotlight
  }

  var attributeSet: CSSearchableItemAttributeSet {
    let attributes = defaultAttributeSet
    attributes.displayName = name
    attributes.title = name
    attributes.contentDescription = subtitle ?? spokenSummary
    attributes.domainIdentifier = Self.spotlightDomainIdentifier
    attributes.keywords = ["price", "deal", "SwiftScan", name] + (brand.isEmpty ? [] : [brand])
    return attributes
  }
}

#if compiler(>=6.4)
@available(iOS 27.0, *)
extension ScannedItemQuery: IndexedEntityQuery {
  func reindexEntities(for identifiers: [ScannedItemEntity.ID], indexDescription: CSSearchableIndexDescription) async throws {
    try await AppEntityIdentifierRegistry.shared.updateIndexFromCatalog(kind: ScannedItemEntity.kind, matching: identifiers)
  }

  func reindexAllEntities(indexDescription: CSSearchableIndexDescription) async throws {
    try await AppEntityIdentifierRegistry.shared.replaceIndexFromCatalog(kind: ScannedItemEntity.kind)
  }
}
#endif
