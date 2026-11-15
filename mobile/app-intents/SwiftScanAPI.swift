import Foundation

/// Talks to the same SwiftScan server the app uses. `URLSession.shared` shares cookies with the
/// app's own networking, so a signed-in user's session, Pro status and free-scan count all apply
/// when Siri runs an action without opening the app.
enum SwiftScanAPI {
  static let base = "https://www.swiftscan.store"

  /// A price check, reduced to the plain values Siri needs (all Sendable).
  struct PriceCheck: Sendable {
    var productName: String
    var brand: String
    var msrp: Double
    var goodPrice: Double
    var greatDealPrice: Double
    var priceRating: String
    /// The full result as JSON, handed to the app so the check shows up in "Your scans".
    var resultJSON: String
  }

  enum Outcome: Sendable {
    case found(PriceCheck)
    case limit(String)
    case failed(String)
  }

  enum AlertOutcome: Sendable {
    case saved
    case signInRequired
    case failed(String)
  }

  private struct Reply: Sendable {
    var status: Int
    var data: Data
  }

  private static func send(_ path: String, method: String, body: [String: Any], timeout: TimeInterval) async throws -> Reply {
    guard let url = URL(string: base + path) else { throw URLError(.badURL) }
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.timeoutInterval = timeout
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("ios", forHTTPHeaderField: "X-SwiftScan-Client")
    request.setValue("siri", forHTTPHeaderField: "X-SwiftScan-Source")
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, response) = try await URLSession.shared.data(for: request)
    return Reply(status: (response as? HTTPURLResponse)?.statusCode ?? 0, data: data)
  }

  private static func object(_ data: Data) -> [String: Any] {
    return ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any]) ?? [:]
  }

  private static func number(_ value: Any?) -> Double {
    if let n = value as? NSNumber { return n.doubleValue }
    if let s = value as? String, let d = Double(s) { return d }
    return 0
  }

  static func checkPrice(_ query: String) async -> Outcome {
    let reply: Reply
    do {
      reply = try await send("/api/scan", method: "POST", body: ["textQuery": query], timeout: 28)
    } catch {
      return .failed("I couldn't reach SwiftScan. Check your connection and try again.")
    }
    let json = object(reply.data)
    if reply.status == 429 {
      return .limit((json["error"] as? String) ?? "You've used today's free scans in SwiftScan.")
    }
    guard reply.status == 200, let result = json["data"] as? [String: Any], let name = result["productName"] as? String else {
      return .failed((json["error"] as? String) ?? "SwiftScan couldn't check that price right now. Try again in a moment.")
    }
    let resultData = (try? JSONSerialization.data(withJSONObject: result)) ?? Data()
    return .found(
      PriceCheck(
        productName: name,
        brand: (result["brand"] as? String) ?? "",
        msrp: number(result["msrp"]),
        goodPrice: number(result["goodPrice"]),
        greatDealPrice: number(result["greatDealPrice"]),
        priceRating: (result["priceRating"] as? String) ?? "FAIR",
        resultJSON: String(data: resultData, encoding: .utf8) ?? "{}"
      )
    )
  }

  static func watchPrice(productName: String, brand: String, targetPrice: Double) async -> AlertOutcome {
    do {
      let reply = try await send(
        "/api/alerts", method: "PUT",
        body: ["productName": productName, "brand": brand, "targetPrice": targetPrice], timeout: 20)
      if reply.status == 401 { return .signInRequired }
      let json = object(reply.data)
      if reply.status == 200, (json["success"] as? Bool) != false { return .saved }
      return .failed((json["error"] as? String) ?? "SwiftScan couldn't save that price alert.")
    } catch {
      return .failed("I couldn't reach SwiftScan. Check your connection and try again.")
    }
  }

  /// "$4.29", or "$189" for bigger prices, which reads better aloud.
  static func money(_ value: Double) -> String {
    if value >= 100 { return "$" + String(Int(value.rounded())) }
    return String(format: "$%.2f", value)
  }

  /// One spoken sentence for a price check.
  static func summary(name: String, msrp: Double, goodPrice: Double, greatDealPrice: Double, rating: String) -> String {
    var parts: [String] = []
    if goodPrice > 0 { parts.append("a fair price is about \(money(goodPrice))") }
    if greatDealPrice > 0 { parts.append("a great deal is \(money(greatDealPrice)) or less") }
    var text = parts.isEmpty ? "\(name): SwiftScan couldn't estimate a price." : "\(name): " + parts.joined(separator: ", and ") + "."
    if msrp > 0, msrp > goodPrice { text += " It usually lists around \(money(msrp))." }
    if rating == "OVERPRICED" { text += " Prices for it run high right now, so it may pay to wait." }
    return text + " These are estimates."
  }
}
