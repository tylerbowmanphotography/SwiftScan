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
function isValidGtin(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop();
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += digits[i] * w;
  }
  return (10 - sum % 10) % 10 === check;
}
function isValidIsbn10(code) {
  if (!/^\d{9}[\dXx]$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = code[i];
    sum += (c === "X" || c === "x" ? 10 : Number(c)) * (10 - i);
  }
  return sum % 11 === 0;
}
function isbn10To13(code) {
  const body = "978" + code.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + (10 - sum % 10) % 10;
}
function normalizeBarcode(raw) {
  let code = String(raw || "").replace(/[\s-]/g, "");
  if (isValidIsbn10(code)) code = isbn10To13(code.toUpperCase());
  if (!isValidGtin(code)) {
    return { ok: false, reason: "invalid" };
  }
  const variants = [];
  const add = (c) => {
    if (c && !variants.includes(c)) variants.push(c);
  };
  const stripped = code.replace(/^0+/, "");
  add(code);
  if (stripped.length <= 12) add(stripped.padStart(12, "0"));
  if (stripped.length <= 13) add(stripped.padStart(13, "0"));
  if (stripped.length <= 14) add(stripped.padStart(14, "0"));
  if (code.length === 14 && code.startsWith("0")) add(code.slice(1));
  const sorted = variants.filter((v) => [12, 13].includes(v.length) || v === code);
  return { ok: true, code, variants: sorted.length ? sorted : variants };
}
var LOOKUP_UA = "SwiftScan/1.0 (https://scan-app-seven.vercel.app)";
var LOOKUP_TIMEOUT_MS = 3500;
async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": LOOKUP_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS)
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: non-JSON response`);
  }
  if (!res.ok && res.status !== 404 && !data?.status_verbose) {
    throw new Error(`HTTP ${res.status}${data?.code ? " " + data.code : ""}`);
  }
  return data;
}
async function lookupOpenFactsFamily(host, label, code) {
  const data = await fetchJson(`https://${host}/api/v2/product/${code}.json?fields=code,product_name,product_name_en,generic_name,brands,brand_owner,categories,quantity,image_front_url,image_url`);
  if (data?.status !== 1 || !data.product) return null;
  const p = data.product;
  const baseName = String(p.product_name || p.product_name_en || p.generic_name || "").trim();
  if (!baseName) return null;
  const brand = String(p.brands || p.brand_owner || "").split(",")[0].trim();
  let name = brand && !baseName.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${baseName}` : baseName;
  if (p.quantity && !name.toLowerCase().includes(String(p.quantity).toLowerCase())) name += ` (${p.quantity})`;
  const category = String(p.categories || "").split(",").map((s) => s.trim()).filter(Boolean).pop() || "";
  return { name, brand, category, imageUrl: p.image_front_url || p.image_url || void 0, source: label };
}
async function lookupOpenLibrary(code) {
  if (!/^97[89]\d{10}$/.test(code)) return null;
  const data = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`);
  const b = data?.[`ISBN:${code}`];
  if (!b?.title) return null;
  const author = b.authors?.[0]?.name || "";
  return {
    name: `${b.title}${author ? " by " + author : ""}`,
    brand: author || b.publishers?.[0]?.name || "",
    category: "Books",
    imageUrl: b.cover?.medium || b.cover?.large || void 0,
    source: "Open Library"
  };
}
async function lookupUpcItemDb(code) {
  const data = await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
  if (data?.code && data.code !== "OK") {
    if (data.code === "INVALID_UPC" || data.code === "NOT_FOUND") return null;
    throw new Error(`UPCitemdb ${data.code}`);
  }
  const item = data?.items?.[0];
  if (!item?.title) return null;
  return {
    name: String(item.title).trim(),
    brand: item.brand || "",
    category: item.category || "",
    imageUrl: Array.isArray(item.images) && item.images[0] ? item.images[0] : void 0,
    source: "UPCitemdb"
  };
}
async function lookupBarcode(variants) {
  const errors = [];
  const sources = [
    { label: "Open Food Facts", run: (c) => lookupOpenFactsFamily("world.openfoodfacts.org", "Open Food Facts", c) },
    { label: "Open Beauty Facts", run: (c) => lookupOpenFactsFamily("world.openbeautyfacts.org", "Open Beauty Facts", c) },
    { label: "Open Products Facts", run: (c) => lookupOpenFactsFamily("world.openproductsfacts.org", "Open Products Facts", c) },
    { label: "Open Library", run: lookupOpenLibrary },
    { label: "UPCitemdb", run: lookupUpcItemDb }
  ];
  const runSource = async (source) => {
    const tryVariants = source.label === "UPCitemdb" ? variants.slice(0, 2) : variants.slice(0, 1);
    for (const v of tryVariants) {
      try {
        const hit = await source.run(v);
        if (hit) return hit;
      } catch (e) {
        errors.push(`${source.label}: ${String(e?.message || e).slice(0, 120)}`);
        console.warn(`Barcode lookup via ${source.label} failed for ${v}:`, e?.message || e);
        break;
      }
    }
    return null;
  };
  const openFacts = await Promise.all(sources.slice(0, 3).map(runSource));
  const openHit = openFacts.find((h) => !!h);
  if (openHit) return { product: openHit, incomplete: errors.length > 0, errors };
  for (const source of sources.slice(3)) {
    const hit = await runSource(source);
    if (hit) return { product: hit, incomplete: errors.length > 0, errors };
  }
  return { product: null, incomplete: errors.length > 0, errors };
}
function normalizeProductScanResult(raw, fallbackQuery, identification, groundTruth) {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI response was not a product object");
  }
  const name = String(groundTruth?.name || raw.productName || raw.name || fallbackQuery || "Scanned Product").trim();
  const brand = String(groundTruth?.brand || raw.brand || "Unknown brand").trim();
  const category = String(groundTruth?.category || raw.category || "General Retail").trim();
  const msrp = typeof raw.msrp === "number" && !isNaN(raw.msrp) ? raw.msrp : parseFloat(raw.msrp) || 29.99;
  const goodPrice = typeof raw.goodPrice === "number" && !isNaN(raw.goodPrice) ? raw.goodPrice : parseFloat(raw.goodPrice) || msrp * 0.85;
  const greatDealPrice = typeof raw.greatDealPrice === "number" && !isNaN(raw.greatDealPrice) ? raw.greatDealPrice : parseFloat(raw.greatDealPrice) || msrp * 0.7;
  const validRatings = ["STEAL", "GOOD_DEAL", "FAIR", "OVERPRICED"];
  const priceRating = validRatings.includes(raw.priceRating) ? raw.priceRating : goodPrice < msrp * 0.8 ? "GOOD_DEAL" : "FAIR";
  const pros = Array.isArray(raw.pros) ? raw.pros.map((p) => String(p)).filter(Boolean) : [];
  const cons = Array.isArray(raw.cons) ? raw.cons.map((c) => String(c)).filter(Boolean) : [];
  const keySpecs = Array.isArray(raw.keySpecs) && raw.keySpecs.length > 0 ? raw.keySpecs.map((s) => ({ label: String(s.label || "Specification"), value: String(s.value || "Standard") })) : [
    { label: "Category", value: category },
    { label: "Brand", value: brand }
  ];
  const priceComparison = Array.isArray(raw.priceComparison) && raw.priceComparison.length > 0 ? raw.priceComparison.map((p) => ({
    retailer: String(p.retailer || "Online Retailer"),
    price: typeof p.price === "number" && !isNaN(p.price) ? p.price : parseFloat(p.price) || goodPrice,
    inStock: p.inStock !== false,
    dealTag: p.dealTag ? String(p.dealTag) : void 0,
    url: p.url ? String(p.url) : `https://www.google.com/search?q=${encodeURIComponent(name + " " + (p.retailer || "buy"))}`
  })) : retailerSearchLinks(name, goodPrice, msrp);
  const historicalPriceRange = raw.historicalPriceRange && typeof raw.historicalPriceRange === "object" ? {
    lowestEver: typeof raw.historicalPriceRange.lowestEver === "number" ? raw.historicalPriceRange.lowestEver : greatDealPrice,
    averagePrice: typeof raw.historicalPriceRange.averagePrice === "number" ? raw.historicalPriceRange.averagePrice : goodPrice,
    highestPrice: typeof raw.historicalPriceRange.highestPrice === "number" ? raw.historicalPriceRange.highestPrice : msrp
  } : { lowestEver: greatDealPrice, averagePrice: goodPrice, highestPrice: msrp };
  let confidence;
  if (identification.method === "photo") {
    const c = typeof raw.confidence === "number" && !isNaN(raw.confidence) ? raw.confidence : 0.5;
    confidence = Math.min(0.7, Math.max(0.1, c > 1 ? c / 100 : c));
  }
  const finalIdentification = { ...identification };
  if (groundTruth?.imageUrl) finalIdentification.imageUrl = groundTruth.imageUrl;
  return {
    productName: name,
    brand,
    category,
    confidence,
    identification: finalIdentification,
    pricesAreEstimates: true,
    summary: String(raw.summary || `${name} (${brand}) in ${category}.`),
    geminiDescription: String(raw.geminiDescription || raw.summary || `${name} (${brand}).`),
    msrp: Number(msrp.toFixed(2)),
    goodPrice: Number(goodPrice.toFixed(2)),
    greatDealPrice: Number(greatDealPrice.toFixed(2)),
    priceRating,
    priceAdvice: String(raw.priceAdvice || "Prices shown are AI estimates. Check the retailer links for current prices."),
    pros,
    cons,
    keySpecs,
    topReviews: [],
    priceComparison,
    historicalPriceRange,
    verdict: String(raw.verdict || "Price estimate only. Verify current prices at the retailer before buying.")
  };
}
function retailerSearchLinks(name, goodPrice, msrp) {
  return [
    { retailer: "Amazon", price: goodPrice, inStock: true, dealTag: "Estimate", url: `https://www.amazon.com/s?k=${encodeURIComponent(name)}` },
    { retailer: "Walmart", price: msrp, inStock: true, dealTag: "Estimate", url: `https://www.walmart.com/search?q=${encodeURIComponent(name)}` },
    { retailer: "Target", price: msrp, inStock: true, dealTag: "Estimate", url: `https://www.target.com/s?searchTerm=${encodeURIComponent(name)}` }
  ];
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
  const rawBarcode = barcode ? String(barcode).trim() : textQuery && /^\d{8,14}$/.test(String(textQuery).trim()) ? String(textQuery).trim() : null;
  const hasPhoto = !!imageBase64;
  let groundTruth = null;
  let normalizedCode = null;
  if (rawBarcode && !hasPhoto && !correctionHint) {
    const norm = normalizeBarcode(rawBarcode);
    if (!norm.ok) {
      return res.status(422).json({
        success: false,
        found: false,
        code: "BARCODE_MISREAD",
        barcode: rawBarcode,
        error: "Barcode misread, try again. The digits we read (" + rawBarcode + ") don't pass the barcode check-digit test, so the scanner probably read it wrong. Hold the camera steady and re-scan, or type the number from under the barcode."
      });
    }
    normalizedCode = norm.code;
    const outcome = await lookupBarcode(norm.variants);
    if (!outcome.product) {
      console.log(`Barcode ${norm.code} not found. Lookup issues: ${outcome.errors.join("; ") || "none"}`);
      return res.json({
        success: true,
        found: false,
        barcode: norm.code,
        lookupIncomplete: outcome.incomplete,
        message: outcome.incomplete ? "We couldn't identify this barcode. Some product databases were unavailable, so you can try again in a minute, or take a photo of the product front, or search by name." : "We couldn't identify this barcode. It isn't in the product databases we check. Take a photo of the product front or search by name instead."
      });
    }
    groundTruth = outcome.product;
    console.log(`Barcode '${norm.code}' found in ${groundTruth.source}:`, groundTruth.name);
  }
  const method = correctionHint ? "correction" : hasPhoto ? "photo" : groundTruth ? "database" : "search";
  const identification = {
    method,
    verified: method === "database",
    source: groundTruth?.source,
    upc: normalizedCode || void 0
  };
  let promptInstruction = "";
  if (correctionHint) {
    promptInstruction = `The user says the product is: '${correctionHint}'.
Analyze that exact product ('${correctionHint}'). Return productName as '${correctionHint}' or its official full model name.`;
  } else if (hasPhoto) {
    promptInstruction = `EXAMINE THE PROVIDED PRODUCT PHOTO VERY CAREFULLY.
Read all visible text, brand logos, model numbers, packaging details, tags and labels.
Identify the EXACT, SPECIFIC product shown. If you cannot read enough to be sure, say so in the summary and set a LOW confidence (below 0.5). Never invent a brand or model that is not visible.`;
  } else if (groundTruth) {
    promptInstruction = `The product has ALREADY been positively identified from the barcode database (${groundTruth.source}), UPC ${normalizedCode}:
- Title: ${groundTruth.name}
- Brand: ${groundTruth.brand || "(not listed)"}
- Category: ${groundTruth.category || "(not listed)"}
This identification is GROUND TRUTH. You MUST NOT change, rename, second-guess or substitute the product. Use the title above verbatim as productName. Use web search if available to find realistic current US pricing and a short summary for THIS product only.`;
  } else {
    promptInstruction = `Analyze product search query: '${textQuery}'. Identify the most likely matching product, its official MSRP, a fair deal price, and typical retail prices.`;
  }
  const promptText = `${promptInstruction}

Return ONLY a valid JSON object (no markdown) with this exact structure:
{
  "productName": "Full Official Product Name",
  "brand": "Brand Name",
  "category": "e.g. Health & Medicine / Headphones / Grocery / Footwear / Books",
  "confidence": 0.5,
  "summary": "2-3 sentence factual summary of what this item is and who it is for.",
  "msrp": 29.99,
  "goodPrice": 24.99,
  "greatDealPrice": 19.99,
  "priceRating": "GOOD_DEAL",
  "priceAdvice": "Short advice on buying now vs waiting. Say these are estimates.",
  "pros": ["short pro"],
  "cons": ["short con"],
  "keySpecs": [{"label": "Size / Type", "value": "value"}],
  "priceComparison": [
    {"retailer": "Retailer Name", "price": 24.99, "inStock": true, "dealTag": "Estimate", "url": "https://www.retailer.com/search?q=product"}
  ],
  "historicalPriceRange": {"lowestEver": 19.99, "averagePrice": 26.99, "highestPrice": 34.99},
  "verdict": "One-line buying verdict.",
  "geminiDescription": "A few sentences of factual detail about the product."
}

Rules: prices are USD numbers and are estimates; only include specs you are confident about. Do NOT include customer ratings, review counts or review quotes. If you are not sure about a value, leave it out rather than inventing it.`;
  const queryTerm = correctionHint || groundTruth?.name || textQuery || "Scanned Item";
  if (!resolveGeminiKey().key) {
    return res.status(503).json({
      success: false,
      error: "The scanning service is not configured: no Gemini API key is set on the server (GEMINI_API_KEY)."
    });
  }
  try {
    const parts = [];
    if (hasPhoto) {
      parts.push({ inlineData: { mimeType: detectedMimeType, data: cleanBase64 } });
    }
    parts.push({ text: promptText });
    let responseText = "";
    let aiError = "";
    try {
      responseText = await generateWithFallback({
        contents: { parts },
        config: { tools: [{ googleSearch: {} }] }
      });
      extractAndParseJSON(responseText);
    } catch (groundedErr) {
      console.warn("Grounded Gemini call failed, retrying without search:", groundedErr?.message || groundedErr);
      responseText = "";
      try {
        responseText = await generateWithFallback({
          contents: { parts },
          config: { responseMimeType: "application/json" }
        });
      } catch (aiErr) {
        aiError = String(aiErr?.message || aiErr).slice(0, 300);
        console.warn("All Gemini models failed for scan:", aiError);
      }
    }
    if (responseText) {
      try {
        const parsed = extractAndParseJSON(responseText);
        const normalized = normalizeProductScanResult(parsed, queryTerm, identification, groundTruth);
        return res.json({ success: true, found: true, data: normalized });
      } catch (jsonErr) {
        console.warn("JSON parse error:", jsonErr);
        aiError = aiError || "The AI returned a response that could not be read.";
      }
    }
    const known = groundTruth ? ` The barcode matched "${groundTruth.name}" (${groundTruth.source}), but` : "";
    return res.status(502).json({
      success: false,
      error: groundTruth ? `${known.trim()} price analysis is unavailable right now (${aiError || "AI service unavailable"}). Please try again.` : `Could not analyze this item right now (${aiError || "AI service unavailable"}). Please try again, or search by product name.`
    });
  } catch (error) {
    console.warn("Scan endpoint general error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Scan failed on the server. Please try again." });
  }
});
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
