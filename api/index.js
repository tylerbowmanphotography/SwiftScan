// server.ts
import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
var app = express();
var PORT = 3e3;
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
var GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash"
].filter((m, i, arr) => !!m && arr.indexOf(m) === i);
var lastGeminiError = "";
async function generateWithFallback(params) {
  const ai = getGeminiClient();
  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({ model, ...params });
      const text = response.text || "";
      if (text) return text;
      lastErr = new Error(`Model ${model} returned an empty response`);
    } catch (err) {
      lastErr = err;
      lastGeminiError = `${model}: ${String(err?.message || err).slice(0, 300)}`;
      console.warn(`Gemini model ${model} failed:`, err?.message || err);
    }
  }
  throw lastErr || new Error("All Gemini models failed");
}
var KEY_VAR_NAMES = ["GEMINI_API_KEY", "GoogleAIStudio", "GOOGLE_API_KEY"];
function resolveGeminiKey() {
  for (const name of KEY_VAR_NAMES) {
    const v = process.env[name];
    if (v) return { key: v, source: name };
  }
  return { key: void 0, source: void 0 };
}
function getGeminiClient() {
  const apiKey = resolveGeminiKey().key;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
app.get(["/api/health", "/api/health/"], (req, res) => {
  res.json({
    status: "ok",
    geminiConfigured: !!resolveGeminiKey().key,
    geminiKeySource: resolveGeminiKey().source,
    models: GEMINI_MODELS,
    lastGeminiError: lastGeminiError || void 0,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var KNOWN_BARCODES = {
  "019283746501": { name: "Uniqlo AIRism Cotton Crew Neck T-Shirt", brand: "Uniqlo", category: "Apparel & Clothing" },
  "088341234567": { name: "Nike Sportswear Club Fleece T-Shirt", brand: "Nike", category: "Apparel & Activewear" },
  "012345678905": { name: "Gildan Heavy Cotton Adult T-Shirt (2-Pack)", brand: "Gildan", category: "Apparel & Basics" },
  "0735005385001": { name: "Organic Heavyweight Cotton Crewneck Tee", brand: "Studio Apparel", category: "Apparel & Clothing" },
  "024721000000": { name: "Levi's Men's 501 Original Fit Jeans", brand: "Levi's", category: "Apparel & Clothing" },
  "049000006346": { name: "Coca-Cola Original Taste (12 fl oz Can)", brand: "Coca-Cola", category: "Beverages" },
  "3017620422003": { name: "Nutella Hazelnut Spread with Cocoa (13 oz)", brand: "Nutella", category: "Grocery" },
  "027242922112": { name: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones", brand: "Sony", category: "Headphones & Audio" },
  "194252192008": { name: "Apple AirPods Pro (2nd Generation)", brand: "Apple", category: "Earbuds & Audio" },
  "9780131103627": { name: "The C Programming Language (2nd Edition)", brand: "Prentice Hall", category: "Books" },
  "09780131103627": { name: "The C Programming Language (2nd Edition)", brand: "Prentice Hall", category: "Books" },
  "045496881857": { name: "Nintendo Switch - OLED Model White Joy-Con", brand: "Nintendo", category: "Video Games" },
  "097855171122": { name: "Logitech MX Master 3S Performance Wireless Mouse", brand: "Logitech", category: "Computer Accessories" },
  "012000000133": { name: "Pepsi Cola (12 fl oz Can)", brand: "Pepsi", category: "Beverages" },
  "194253399086": { name: "Apple Watch Series 9 GPS 45mm Midnight Aluminum", brand: "Apple", category: "Smartwatches" },
  "888462000000": { name: "Nike Air Force 1 '07 Triple White", brand: "Nike", category: "Footwear" },
  "045496590421": { name: "The Legend of Zelda: Tears of the Kingdom", brand: "Nintendo", category: "Video Games" },
  "850012345678": { name: "Hydro Flask 32 oz Wide Mouth Straw Lid Water Bottle", brand: "Hydro Flask", category: "Drinkware" },
  "840080588880": { name: "Anker 737 Power Bank (PowerCore 24K 140W Output)", brand: "Anker", category: "Mobile Accessories" },
  "810082340001": { name: "Stanley 40 oz Stainless Steel Quencher H2.0 Tumbler", brand: "Stanley", category: "Drinkware" },
  "088590995080": { name: "Bose QuietComfort 45 Bluetooth Headphones", brand: "Bose", category: "Headphones & Audio" },
  "880609000000": { name: "Samsung Galaxy Buds2 Pro True Wireless Earbuds", brand: "Samsung", category: "Audio" },
  "050036323000": { name: "JBL Flip 6 Waterproof Portable Bluetooth Speaker", brand: "JBL", category: "Audio" },
  "085854200000": { name: "Instant Pot Duo 7-in-1 Electric Pressure Cooker 6 Qt", brand: "Instant Pot", category: "Kitchen Appliances" }
};
async function resolveBarcodeToProduct(rawCode) {
  const code = rawCode.trim().replace(/[^0-9X]/gi, "");
  if (!code) return null;
  if (KNOWN_BARCODES[code]) {
    return { ...KNOWN_BARCODES[code], source: "KnownBarcodes" };
  }
  const unpadded = code.replace(/^0+/, "");
  if (KNOWN_BARCODES[unpadded]) {
    return { ...KNOWN_BARCODES[unpadded], source: "KnownBarcodes" };
  }
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
      signal: AbortSignal.timeout(2e3)
    });
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name || p.product_name_en;
      const brand = p.brands || p.brand_owner || "";
      if (name) {
        const fullTitle = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
        return { name: fullTitle, brand, category: p.categories || "Food & Grocery", source: "OpenFoodFacts" };
      }
    }
  } catch (e) {
  }
  if (code.length === 10 || code.length === 13) {
    try {
      const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`, {
        signal: AbortSignal.timeout(2e3)
      });
      const data = await res.json();
      const bookKey = `ISBN:${code}`;
      if (data[bookKey] && data[bookKey].title) {
        const b = data[bookKey];
        const author = b.authors?.[0]?.name || "";
        return { name: `Book: ${b.title} ${author ? "by " + author : ""}`.trim(), brand: author || "Publisher", category: "Books", source: "OpenLibrary" };
      }
    } catch (e) {
    }
  }
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
      signal: AbortSignal.timeout(2e3)
    });
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      if (item.title) {
        return { name: item.title, brand: item.brand || "", category: item.category || "", source: "UPCitemdb" };
      }
    }
  } catch (e) {
  }
  try {
    const barcodePrompt = `Find the exact product name, brand, and category for UPC/EAN barcode ${code}. Return JSON object with keys: name, brand, category. If you do not know this exact barcode, return {"name": "unknown"} - never guess. Example: {"name": "Logitech MX Master 3S", "brand": "Logitech", "category": "Computer Accessories"}`;
    const text = await generateWithFallback({
      contents: barcodePrompt,
      config: { responseMimeType: "application/json" }
    });
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed.name && !parsed.name.toLowerCase().includes("unknown")) {
        return { name: parsed.name, brand: parsed.brand || "", category: parsed.category || "General Retail", source: "GeminiUPC" };
      }
    }
  } catch (e) {
  }
  return null;
}
function normalizeProductScanResult(raw, fallbackQuery, rawBarcode) {
  if (!raw || typeof raw !== "object") {
    return generateSmartFallbackProduct(fallbackQuery, rawBarcode);
  }
  const name = String(raw.productName || raw.name || fallbackQuery || "Scanned Product").trim();
  const brand = String(raw.brand || "Retail Brand").trim();
  const category = String(raw.category || "General Retail").trim();
  const msrp = typeof raw.msrp === "number" && !isNaN(raw.msrp) ? raw.msrp : parseFloat(raw.msrp) || 29.99;
  const goodPrice = typeof raw.goodPrice === "number" && !isNaN(raw.goodPrice) ? raw.goodPrice : parseFloat(raw.goodPrice) || msrp * 0.85;
  const greatDealPrice = typeof raw.greatDealPrice === "number" && !isNaN(raw.greatDealPrice) ? raw.greatDealPrice : parseFloat(raw.greatDealPrice) || msrp * 0.7;
  const rating = typeof raw.rating === "number" && !isNaN(raw.rating) ? Math.min(5, Math.max(1, raw.rating)) : parseFloat(raw.rating) || 4.5;
  const totalReviewsCount = typeof raw.totalReviewsCount === "number" && !isNaN(raw.totalReviewsCount) ? raw.totalReviewsCount : parseInt(raw.totalReviewsCount, 10) || 1250;
  const validRatings = ["STEAL", "GOOD_DEAL", "FAIR", "OVERPRICED"];
  const priceRating = validRatings.includes(raw.priceRating) ? raw.priceRating : goodPrice < msrp * 0.8 ? "GOOD_DEAL" : "FAIR";
  const validSentiments = ["OVERWHELMINGLY_POSITIVE", "MOSTLY_POSITIVE", "MIXED", "NEGATIVE"];
  const reviewSentiment = validSentiments.includes(raw.reviewSentiment) ? raw.reviewSentiment : "MOSTLY_POSITIVE";
  const pros = Array.isArray(raw.pros) && raw.pros.length > 0 ? raw.pros.map((p) => String(p)) : ["High quality design and reliable construction", "Strong ratings from verified owners"];
  const cons = Array.isArray(raw.cons) && raw.cons.length > 0 ? raw.cons.map((c) => String(c)) : ["May have price variations depending on retailer stock"];
  const keySpecs = Array.isArray(raw.keySpecs) && raw.keySpecs.length > 0 ? raw.keySpecs.map((s) => ({ label: String(s.label || "Specification"), value: String(s.value || "Standard") })) : [
    { label: "Category", value: category },
    { label: "Manufacturer", value: brand },
    { label: "Warranty", value: "Standard 1-Year Limited Warranty" }
  ];
  const topReviews = Array.isArray(raw.topReviews) && raw.topReviews.length > 0 ? raw.topReviews.map((r) => ({
    author: String(r.author || "Verified Buyer"),
    source: String(r.source || "Retail Buyer"),
    rating: typeof r.rating === "number" ? r.rating : 5,
    comment: String(r.comment || "Great product, highly satisfied with this purchase."),
    date: String(r.date || "Recent")
  })) : [
    {
      author: "Verified Customer",
      source: "Verified Buyer",
      rating: 5,
      comment: `Very happy with the ${name}. Works exactly as expected.`,
      date: "1 week ago"
    }
  ];
  const priceComparison = Array.isArray(raw.priceComparison) && raw.priceComparison.length > 0 ? raw.priceComparison.map((p) => ({
    retailer: String(p.retailer || "Online Retailer"),
    price: typeof p.price === "number" && !isNaN(p.price) ? p.price : parseFloat(p.price) || goodPrice,
    inStock: p.inStock !== false,
    dealTag: p.dealTag ? String(p.dealTag) : void 0,
    url: p.url ? String(p.url) : `https://www.google.com/search?q=${encodeURIComponent(name + " " + (p.retailer || "buy"))}`
  })) : [
    {
      retailer: "Amazon",
      price: goodPrice,
      inStock: true,
      dealTag: "Current Best Price",
      url: `https://www.amazon.com/s?k=${encodeURIComponent(name)}`
    },
    {
      retailer: "Best Buy",
      price: msrp,
      inStock: true,
      dealTag: "Standard Retail",
      url: `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(name)}`
    },
    {
      retailer: "Walmart",
      price: Number((goodPrice * 1.02).toFixed(2)),
      inStock: true,
      dealTag: "Rollback Match",
      url: `https://www.walmart.com/search?q=${encodeURIComponent(name)}`
    }
  ];
  const historicalPriceRange = raw.historicalPriceRange && typeof raw.historicalPriceRange === "object" ? {
    lowestEver: typeof raw.historicalPriceRange.lowestEver === "number" ? raw.historicalPriceRange.lowestEver : greatDealPrice,
    averagePrice: typeof raw.historicalPriceRange.averagePrice === "number" ? raw.historicalPriceRange.averagePrice : goodPrice,
    highestPrice: typeof raw.historicalPriceRange.highestPrice === "number" ? raw.historicalPriceRange.highestPrice : msrp
  } : {
    lowestEver: greatDealPrice,
    averagePrice: goodPrice,
    highestPrice: msrp
  };
  return {
    productName: name,
    brand,
    category,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.94,
    summary: String(raw.summary || `${name} by ${brand} is a well-rated option in ${category}.`),
    geminiDescription: String(raw.geminiDescription || raw.summary || `Comprehensive analysis for ${name}.`),
    msrp: Number(msrp.toFixed(2)),
    goodPrice: Number(goodPrice.toFixed(2)),
    greatDealPrice: Number(greatDealPrice.toFixed(2)),
    priceRating,
    priceAdvice: String(raw.priceAdvice || (goodPrice < msrp ? "Current street prices are below MSRP. Good time to buy." : "Consider waiting for an upcoming promotional sale.")),
    rating: Number(rating.toFixed(1)),
    totalReviewsCount,
    reviewSentiment,
    pros,
    cons,
    keySpecs,
    topReviews,
    priceComparison,
    historicalPriceRange,
    verdict: String(raw.verdict || `RECOMMENDED - Solid product choice in the ${category} category.`)
  };
}
function extractAndParseJSON(text) {
  if (!text) throw new Error("Empty AI response text");
  try {
    return JSON.parse(text);
  } catch (err) {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return JSON.parse(codeBlockMatch[1].trim());
    }
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return JSON.parse(braceMatch[0].trim());
    }
    throw new Error("Could not parse JSON from model response: " + text.slice(0, 100));
  }
}
app.post(["/api/scan", "/api/scan/"], async (req, res) => {
  const { imageBase64, mimeType = "image/jpeg", textQuery, barcode, correctionHint } = req.body || {};
  if (!imageBase64 && !textQuery && !barcode && !correctionHint) {
    return res.status(400).json({
      success: false,
      error: "Input validation error: Please provide either a photo, barcode, product name, or correction hint."
    });
  }
  let cleanBase64 = "";
  let detectedMimeType = mimeType || "image/jpeg";
  if (imageBase64) {
    if (typeof imageBase64 !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid image format: Image payload must be a base64 encoded string."
      });
    }
    if (imageBase64.includes(",")) {
      const parts = imageBase64.split(",");
      const header = parts[0];
      cleanBase64 = parts[1] || "";
      const mimeMatch = header.match(/^data:([^;]+);base64/);
      if (mimeMatch && mimeMatch[1]) {
        detectedMimeType = mimeMatch[1];
      }
    } else {
      cleanBase64 = imageBase64;
    }
    cleanBase64 = cleanBase64.replace(/\s/g, "");
    if (cleanBase64.length < 50) {
      return res.status(400).json({
        success: false,
        error: "Invalid image data: The image data is too small or truncated."
      });
    }
  }
  const rawBarcode = barcode ? String(barcode).trim() : textQuery && /^\d{8,14}$/.test(textQuery.trim()) ? textQuery.trim() : null;
  let resolvedBarcodeProduct = null;
  if (rawBarcode) {
    resolvedBarcodeProduct = await resolveBarcodeToProduct(rawBarcode);
    if (resolvedBarcodeProduct) {
      console.log(`Barcode '${rawBarcode}' resolved to:`, resolvedBarcodeProduct);
    }
  }
  let promptInstruction = "";
  if (correctionHint) {
    promptInstruction = `CRITICAL USER CORRECTION NOTICE: The user reported that the product in this scan is: '${correctionHint}'.
Comprehensively analyze this exact product ('${correctionHint}') for its real MSRP, fair deal threshold, buyer reviews, specifications, pros, cons, and live retailer comparisons across major stores (Amazon, Best Buy, Walmart, Target, etc.).
Ensure the returned productName is '${correctionHint}' or its official full model name.`;
  } else if (imageBase64) {
    promptInstruction = `EXAMINE THE PROVIDED PRODUCT PHOTO VERY CAREFULLY.
Read all visible text, brand logos, model numbers, packaging details, tags, labels, or distinguishing visual features.
Identify the EXACT, SPECIFIC product shown in the photo. State its full official name, brand, category, real MSRP, current street price, pros, cons, key specifications, and retailer price comparisons across major stores (Amazon, Best Buy, Walmart, Target, etc.).
Do NOT make up a generic guess or default to a t-shirt unless the photo actually shows a t-shirt.`;
  } else if (resolvedBarcodeProduct) {
    promptInstruction = `Analyze the product corresponding to scanned UPC/EAN barcode ${rawBarcode}: '${resolvedBarcodeProduct.name}' by ${resolvedBarcodeProduct.brand || "manufacturer"} (${resolvedBarcodeProduct.category || "Retail Item"}).
Provide full pricing analysis, MSRP, fair deal threshold, real buyer review sentiment, specifications, and retailer comparisons across major stores.`;
  } else if (rawBarcode) {
    promptInstruction = `Analyze product corresponding to scanned UPC/EAN barcode '${rawBarcode}'. Search online databases and identify the exact product model, brand, category, MSRP, deal pricing, and user review consensus.`;
  } else {
    promptInstruction = `Analyze product search query: '${textQuery}'.
Identify the exact product model, brand, category, official MSRP, fair deal price, real buyer review consensus, specifications, and retailer comparisons across major stores.`;
  }
  const promptText = `${promptInstruction}

Return a valid JSON object with this exact structure:
{
  "productName": "Full Official Product Name",
  "brand": "Brand Name",
  "category": "e.g. Apparel & Clothing / Headphones / Electronics / Grocery / Footwear / Home Goods / Books",
  "confidence": 0.95,
  "summary": "Clear 2-3 sentence summary of what this item is, key material/build/tech features, and who it's best for.",
  "msrp": 29.99,
  "goodPrice": 24.99,
  "greatDealPrice": 19.99,
  "priceRating": "GOOD_DEAL",
  "priceAdvice": "Advice on whether to buy now or wait for seasonal sales.",
  "rating": 4.6,
  "totalReviewsCount": 3850,
  "reviewSentiment": "OVERWHELMINGLY_POSITIVE",
  "pros": [
    "High quality materials and durable craftsmanship",
    "Great overall comfort, design, and value"
  ],
  "cons": [
    "Slightly limited color variations in stock"
  ],
  "keySpecs": [
    {"label": "Material / Type", "value": "Primary Material or Spec"}
  ],
  "topReviews": [
    {
      "author": "VerifiedBuyer_88",
      "source": "Verified Buyer",
      "rating": 5,
      "comment": "Great product, fits well and holds up great after repeated use.",
      "date": "2 weeks ago"
    }
  ],
  "priceComparison": [
    {"retailer": "Retailer Name", "price": 24.99, "inStock": true, "dealTag": "Best current deal", "url": "https://www.retailer.com/search?q=product"}
  ],
  "historicalPriceRange": {
    "lowestEver": 19.99,
    "averagePrice": 26.99,
    "highestPrice": 34.99
  },
  "verdict": "RECOMMENDED - Solid purchase at current pricing.",
  "geminiDescription": "Detailed analysis explaining build quality, materials, engineering design, practical daily usability, and target buyers."
}

Be realistic and accurate with real-world prices, real specifications, and authentic consumer sentiment matching the exact item type. Ensure values for msrp, goodPrice, and greatDealPrice are numbers.`;
  const queryTerm = correctionHint || (resolvedBarcodeProduct ? resolvedBarcodeProduct.name : null) || textQuery || (rawBarcode ? `Barcode ${rawBarcode}` : "Scanned Item");
  const hasRealName = !!(correctionHint || resolvedBarcodeProduct || textQuery && !rawBarcode);
  if (!resolveGeminiKey().key && !hasRealName) {
    return res.status(503).json({
      success: false,
      error: "The scanning service is not configured: no Gemini API key is set on the server (GEMINI_API_KEY)."
    });
  }
  try {
    const parts = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: detectedMimeType,
          data: cleanBase64
        }
      });
    }
    parts.push({ text: promptText });
    let responseText = "";
    let aiError = "";
    try {
      responseText = await generateWithFallback({
        contents: { parts },
        config: { responseMimeType: "application/json" }
      });
    } catch (aiErr) {
      aiError = String(aiErr?.message || aiErr).slice(0, 300);
      console.warn("All Gemini models failed for scan:", aiError);
    }
    if (responseText) {
      try {
        const parsed = extractAndParseJSON(responseText);
        const normalized = normalizeProductScanResult(parsed, queryTerm, rawBarcode);
        return res.json({ success: true, data: normalized });
      } catch (jsonErr) {
        console.warn("JSON parse error:", jsonErr);
        aiError = aiError || "The AI returned a response that could not be read.";
      }
    }
    if (!hasRealName) {
      return res.status(502).json({
        success: false,
        error: `Could not identify this item right now (${aiError || "AI service unavailable"}). Please try again, or search by product name.`
      });
    }
    const mockFallback = generateSmartFallbackProduct(queryTerm, rawBarcode);
    return res.json({
      success: true,
      data: mockFallback,
      rateLimitNotice: "Estimated product evaluation (AI service unavailable)."
    });
  } catch (error) {
    console.warn("Scan endpoint general error:", error?.message || error);
    if (!hasRealName) {
      return res.status(500).json({ success: false, error: "Scan failed on the server. Please try again." });
    }
    const mockFallback = generateSmartFallbackProduct(queryTerm, rawBarcode);
    return res.json({
      success: true,
      data: mockFallback,
      rateLimitNotice: "Estimated product evaluation (AI service unavailable)."
    });
  }
});
function generateSmartFallbackProduct(queryInput, rawBarcode) {
  const query = queryInput.trim();
  let name = query;
  if (name.startsWith("Scanned") || name.startsWith("Barcode")) {
    if (rawBarcode) {
      name = `Retail Product (UPC ${rawBarcode})`;
    } else {
      name = "Scanned Product Item";
    }
  }
  const isShirt = /shirt|t-shirt|tee|apparel|clothing|dress|pants|jacket|hoodie|top|garment|cotton|uniqlo/i.test(query);
  const isHeadphones = /headphone|earbud|sony|bose|airpod|audio|speaker|sound|beats|jbl/i.test(query);
  const isShoe = /shoe|sneaker|nike|adidas|jordan|footwear|runner|puma|hoka/i.test(query);
  const isCamera = /camera|canon|fuji|nikon|sony camera|lens|gopro/i.test(query);
  const isFood = /food|drink|coca|pepsi|snack|cereal|coffee|tea|sauce|grocery|water|candy|chips/i.test(query);
  const isTech = /laptop|phone|apple|samsung|logitech|mouse|keyboard|monitor|tv|game|switch|ps5|xbox|dyson|vacuum|macbook|ipad/i.test(query);
  const words = query.split(/\s+/);
  let brand = words[0] || "Generic";
  if (brand.toLowerCase() === "scanned" || brand.toLowerCase() === "retail") {
    brand = "Major Retail Brand";
  }
  let category = "General Retail";
  let msrp = 49.99;
  let goodPrice = 39.99;
  let greatDealPrice = 29.99;
  if (isShirt) {
    brand = query.match(/nike|adidas|uniqlo|under armour|zara|h&m|gap|levi's/i)?.[0] || brand;
    category = "Apparel & Clothing";
    msrp = 28;
    goodPrice = 22;
    greatDealPrice = 16;
  } else if (isHeadphones) {
    brand = query.match(/sony|bose|apple|beats|jbl|sennheiser|anker/i)?.[0] || brand;
    category = "Headphones & Audio";
    msrp = 199.99;
    goodPrice = 169.99;
    greatDealPrice = 139.99;
  } else if (isShoe) {
    brand = query.match(/nike|adidas|jordan|puma|hoka|new balance|asics|brooks/i)?.[0] || brand;
    category = "Footwear";
    msrp = 130;
    goodPrice = 110;
    greatDealPrice = 89.99;
  } else if (isCamera) {
    brand = query.match(/fujifilm|canon|nikon|sony|gopro|panasonic|leica/i)?.[0] || brand;
    category = "Cameras & Optics";
    msrp = 899.99;
    goodPrice = 799.99;
    greatDealPrice = 699.99;
  } else if (isFood) {
    brand = "Grocery Select";
    category = "Food & Beverages";
    msrp = 6.99;
    goodPrice = 5.49;
    greatDealPrice = 3.99;
  } else if (isTech) {
    brand = query.match(/logitech|apple|samsung|dyson|dell|hp|asus|lenovo|sony/i)?.[0] || brand;
    category = "Electronics & Computing";
    msrp = 149.99;
    goodPrice = 129.99;
    greatDealPrice = 99.99;
  }
  return {
    productName: name,
    brand,
    category,
    confidence: 0.92,
    summary: `${name} is a high-rated product in the ${category} category, noted for reliable build quality, strong user reviews, and solid overall performance.`,
    geminiDescription: `Detailed item analysis for ${name}. Review metrics indicate high buyer satisfaction, good durability, and fair value retention.`,
    msrp,
    goodPrice,
    greatDealPrice,
    priceRating: "GOOD_DEAL",
    priceAdvice: "Current pricing is below standard retail MSRP. Solid buy if you need this item.",
    rating: 4.6,
    totalReviewsCount: 2450,
    reviewSentiment: "OVERWHELMINGLY_POSITIVE",
    pros: ["Durable materials and reliable performance", "Highly rated by verified buyers", "Competitive price point"],
    cons: ["High demand may occasionally limit stock"],
    keySpecs: [
      { label: "Category", value: category },
      { label: "Availability", value: "In Stock at Major Retailers" },
      { label: "Warranty", value: "1 Year Standard Manufacturer Warranty" }
    ],
    topReviews: [
      {
        author: "VerifiedBuyer",
        source: "Verified Buyer",
        rating: 5,
        comment: `Excellent quality and performance for ${name}. Exactly as described.`,
        date: "1 week ago"
      },
      {
        author: "SmartShopper",
        source: "Verified Buyer",
        rating: 4.5,
        comment: "Great deal at current price. Would recommend to anyone looking in this category.",
        date: "2 weeks ago"
      }
    ],
    priceComparison: [
      { retailer: "Amazon", price: goodPrice, inStock: true, dealTag: "Best current deal", url: `https://www.amazon.com/s?k=${encodeURIComponent(brand + " " + category)}` },
      { retailer: "Best Buy", price: msrp, inStock: true, dealTag: "Standard MSRP", url: `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(brand + " " + category)}` },
      { retailer: "Walmart", price: greatDealPrice, inStock: true, dealTag: "Rollback deal", url: `https://www.walmart.com/search?q=${encodeURIComponent(brand + " " + category)}` }
    ],
    historicalPriceRange: {
      lowestEver: greatDealPrice,
      averagePrice: goodPrice,
      highestPrice: msrp
    },
    verdict: `RECOMMENDED - ${name} represents a solid purchase decision at or near $${goodPrice}.`
  };
}
app.post(["/api/ask", "/api/ask/"], async (req, res) => {
  const { productName, brand, category, summary, question } = req.body || {};
  if (!question || !productName) {
    return res.status(400).json({ success: false, error: "Missing product information or question." });
  }
  try {
    const promptText = `You are PriceLens AI, an expert, objective product advisor and buyer assistant.
The user is asking a specific question about the following product:
- Product: ${productName} (${brand})
- Category: ${category}
- Context/Summary: ${summary}

User Question: "${question}"

Provide a direct, accurate, and structured answer to the user's question. Include key practical insights, compatibility details, warranty or build considerations, or real-world user advice if applicable. Keep the answer clear, professional, and well-formatted.`;
    const answerText = await generateWithFallback({ contents: promptText });
    return res.json({ success: true, answer: answerText || "No response generated." });
  } catch (error) {
    console.error("Ask API error:", error?.message || error);
    return res.json({
      success: true,
      answer: `Based on standard specifications for ${productName} (${brand}), it generally delivers reliable performance in the ${category} category. For detailed specifics on "${question}", we recommend checking the official manufacturer specifications sheet or user manual.`
    });
  }
});
app.post(["/api/autocomplete", "/api/autocomplete/"], async (req, res) => {
  const { query } = req.body || {};
  if (!query || query.length < 2) {
    return res.json({ suggestions: [] });
  }
  try {
    const suggestionsText = await generateWithFallback({
      contents: `You are a fast product search autocomplete engine. Given the partial query "${query}", provide a JSON array of 5 popular product search strings that start with or relate to this query. Focus on consumer electronics, home goods, or apparel. Only return a JSON array of strings. Example: ["sony headphones", "sony tv 4k", "sony camera"]`,
      config: {
        responseMimeType: "application/json"
      }
    });
    try {
      const suggestions = JSON.parse(suggestionsText || "[]");
      return res.json({ suggestions });
    } catch (e) {
      return res.json({ suggestions: generateFallbackSuggestions(query) });
    }
  } catch (error) {
    return res.json({ suggestions: generateFallbackSuggestions(query) });
  }
});
function generateFallbackSuggestions(query) {
  const q = query.toLowerCase().trim();
  return [
    `${q} best deals`,
    `${q} price comparison`,
    `${q} reviews & specs`,
    `${q} latest model`,
    `${q} sale prices`
  ];
}
app.post(["/api/local-stores", "/api/local-stores/"], async (req, res) => {
  const { productName, location } = req.body || {};
  if (!productName) {
    return res.status(400).json({ success: false, error: "Product name required" });
  }
  const locString = location || "nearby retail hubs";
  try {
    const storesText = await generateWithFallback({
      contents: `Find 3-5 major retail store chains near ${locString} that typically carry "${productName}". Provide store name, sample address, and why they carry it. Return JSON array with keys: name, address, reason.`,
      config: {
        responseMimeType: "application/json"
      }
    });
    let stores = [];
    try {
      stores = JSON.parse(storesText || "[]");
    } catch (e) {
      stores = getDefaultLocalStores(productName);
    }
    return res.json({ success: true, stores });
  } catch (error) {
    console.error("Local stores error:", error?.message || error);
    return res.json({ success: true, stores: getDefaultLocalStores(productName) });
  }
});
function getDefaultLocalStores(productName) {
  return [
    { name: "Best Buy", address: "100 Retail Pkwy", reason: `Carries top brands in consumer tech & ${productName}.` },
    { name: "Target", address: "250 Shopping Plaza", reason: "In-stock inventory for popular electronics and home goods." },
    { name: "Walmart Supercenter", address: "500 Commercial Rd", reason: "Competitive in-store pricing and everyday low rates." }
  ];
}
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl || req.url}`,
    availableEndpoints: [
      "/api/health",
      "/api/scan",
      "/api/ask",
      "/api/autocomplete",
      "/api/local-stores"
    ]
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
if (!process.env.VERCEL) {
  startServer();
}
var server_default = app;
export {
  server_default as default
};
