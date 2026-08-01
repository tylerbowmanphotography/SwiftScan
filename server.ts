import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase limit to handle base64 image uploads from camera
app.use(express.json({ limit: "25mb" }));

// Initialize Gemini client lazily or when endpoint is called
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Main Product Scan API endpoint
app.post("/api/scan", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", textQuery } = req.body;

    if (!imageBase64 && !textQuery) {
      return res.status(400).json({ error: "Please provide either an image or a search query." });
    }

    const ai = getGeminiClient();

    const parts: any[] = [];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
    }

    const promptText = `You are an expert product advisor, price evaluator, and review analyst.
Analyze the provided ${imageBase64 ? "product photo" : "product search query: '" + textQuery + "'"}.
Identify the exact product model, brand, current average market prices, typical sales/discount prices, aggregated review score, pros, cons, key specs, customer sentiment, and retailer price comparisons.

Return a JSON object with this exact structure:
{
  "productName": "Full Official Product Name",
  "brand": "Brand Name",
  "category": "e.g. Headphones / Electronics / Kitchen / Footwear",
  "confidence": 0.95,
  "summary": "Clear 2-3 sentence summary of what this product is and who it's best for.",
  "msrp": 299.99,
  "goodPrice": 249.99,
  "greatDealPrice": 219.99,
  "priceRating": "GOOD_DEAL", // Choose one: OVERPRICED, FAIR, GOOD_DEAL, STEAL
  "priceAdvice": "Advice on whether to buy now, wait for a sale, or look for refurbished deals.",
  "rating": 4.6,
  "totalReviewsCount": 12850,
  "reviewSentiment": "OVERWHELMINGLY_POSITIVE", // Choose one: OVERWHELMINGLY_POSITIVE, POSITIVE, MIXED, NEGATIVE
  "pros": [
    "Industry-leading active noise cancellation",
    "30-hour battery life with quick charge"
  ],
  "cons": [
    "Does not fold as compactly as previous model"
  ],
  "keySpecs": [
    {"label": "Battery Life", "value": "Up to 30 hours"}
  ],
  "topReviews": [
    {
      "author": "TechReviewer_99",
      "source": "Verified Buyer",
      "rating": 5,
      "comment": "Best noise cancelling headphones I have owned.",
      "date": "2 weeks ago"
    }
  ],
  "priceComparison": [
    {"retailer": "Amazon", "price": 248.00, "inStock": true, "dealTag": "Lowest recent price"}
  ],
  "historicalPriceRange": {
    "lowestEver": 219.99,
    "averagePrice": 269.00,
    "highestPrice": 399.99
  },
  "verdict": "BUY NOW - Highly recommended at current prices under $250.",
  "geminiDescription": "Detailed Google Gemini AI analysis explaining core tech, engineering design, practical usability, key features, and ideal target users."
}

Be realistic and accurate with real-world prices, real specifications, and authentic consumer sentiment. Use Google Search to find up-to-date pricing, reviews, and specs.`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: { type: Type.STRING },
            brand: { type: Type.STRING },
            category: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            geminiDescription: { type: Type.STRING },
            msrp: { type: Type.NUMBER },
            goodPrice: { type: Type.NUMBER },
            greatDealPrice: { type: Type.NUMBER },
            priceRating: { type: Type.STRING },
            priceAdvice: { type: Type.STRING },
            rating: { type: Type.NUMBER },
            totalReviewsCount: { type: Type.INTEGER },
            reviewSentiment: { type: Type.STRING },
            pros: { type: Type.ARRAY, items: { type: Type.STRING } },
            cons: { type: Type.ARRAY, items: { type: Type.STRING } },
            keySpecs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                },
              },
            },
            topReviews: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  author: { type: Type.STRING },
                  source: { type: Type.STRING },
                  rating: { type: Type.NUMBER },
                  comment: { type: Type.STRING },
                  date: { type: Type.STRING },
                },
              },
            },
            priceComparison: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  retailer: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  inStock: { type: Type.BOOLEAN },
                  dealTag: { type: Type.STRING },
                },
              },
            },
            historicalPriceRange: {
              type: Type.OBJECT,
              properties: {
                lowestEver: { type: Type.NUMBER },
                averagePrice: { type: Type.NUMBER },
                highestPrice: { type: Type.NUMBER },
              },
            },
            verdict: { type: Type.STRING },
          },
          required: [
            "productName",
            "brand",
            "category",
            "summary",
            "msrp",
            "goodPrice",
            "greatDealPrice",
            "priceRating",
            "priceAdvice",
            "rating",
            "totalReviewsCount",
            "reviewSentiment",
            "pros",
            "cons",
            "keySpecs",
            "topReviews",
            "priceComparison",
            "historicalPriceRange",
            "verdict",
          ],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response generated from AI model");
    }

    const parsed = JSON.parse(resultText);
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("Scan error:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to analyze product photo. Please try again.",
    });
  }
});

// Product Q&A Endpoint powered by Google Gemini (High Thinking)
app.post("/api/ask", async (req, res) => {
  try {
    const { productName, brand, category, summary, question } = req.body;

    if (!question || !productName) {
      return res.status(400).json({ error: "Missing product information or question." });
    }

    const ai = getGeminiClient();

    const promptText = `You are PriceLens AI, an expert, objective product advisor and buyer assistant.
The user is asking a specific question about the following product:
- Product: ${productName} (${brand})
- Category: ${category}
- Context/Summary: ${summary}

User Question: "${question}"

Provide a direct, accurate, and structured answer to the user's question. Include key practical insights, compatibility details, warranty or build considerations, or real-world user advice if applicable. Keep the answer clear, professional, and well-formatted.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: promptText,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH
        }
      }
    });

    res.json({ success: true, answer: response.text || "No response generated." });
  } catch (error: any) {
    console.error("Ask API error:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to answer question about this product.",
    });
  }
});

// Autocomplete / Search Suggestions (Low Latency)
app.post("/api/autocomplete", async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const ai = getGeminiClient();
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: `You are a fast product search autocomplete engine. Given the partial query "${query}", provide a JSON array of 5 popular product search strings that start with or relate to this query. Focus on consumer electronics, home goods, or apparel. Only return a JSON array of strings. Example: ["sony headphones", "sony tv 4k", "sony camera"]`,
      config: {
        responseMimeType: "application/json",
      },
    });

    try {
      const suggestions = JSON.parse(response.text || "[]");
      res.json({ suggestions });
    } catch(e) {
       res.json({ suggestions: [] });
    }
  } catch (error) {
    res.status(500).json({ error: "Autocomplete failed" });
  }
});

// Find Local Stores using Maps Grounding
app.post("/api/local-stores", async (req, res) => {
  try {
    const { productName, location } = req.body;
    
    if (!productName) {
      return res.status(400).json({ error: "Product name required" });
    }

    const ai = getGeminiClient();
    const locString = location || "my current location";
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Find 3-5 local retail stores near ${locString} that are likely to sell "${productName}". Provide the store name, address, and why they might carry it. Return as JSON array of objects with keys: name, address, reason.`,
      config: {
        tools: [{ googleMaps: {} }],
        responseMimeType: "application/json",
      },
    });

    let stores = [];
    try {
      stores = JSON.parse(response.text || "[]");
    } catch(e) {
      // ignore
    }
    
    res.json({ success: true, stores });
  } catch (error: any) {
    console.error("Local stores error:", error);
    res.status(500).json({ error: "Failed to find local stores" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
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

startServer();
