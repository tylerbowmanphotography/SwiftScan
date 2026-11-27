/**
 * Real star ratings for a product, found with Google Search grounding. A rating is kept only when
 * it cites a page that Google Search actually returned. Nothing is ever estimated by the model.
 */
import { domainOf } from "./coupons";

export interface ProductRating {
  rating: number; // 1.0 to 5.0
  reviewCount?: number;
  source: string; // site name, e.g. "Amazon"
  sourceUrl: string;
}

export function ratingCacheKey(productName: string, brand?: string): string {
  return `${productName} | ${brand || ""}`.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildRatingPrompt(productName: string, brand?: string): string {
  return `Search the web for the real customer star rating of this exact product:
- Product: ${productName}
- Brand: ${brand || "unknown"}

You MUST use Google Search before answering. Look at a major retailer or review page (Amazon, Best Buy, Walmart, Target, Home Depot, etc.) for this exact product.
Rules:
- Only report a rating you actually read on a web page in your search results, and give that page's exact URL.
- The rating must be for this product, not a different model or a similar item.
- If you cannot find a real rating, return null. Never estimate or invent a rating or review count.

Reply with ONLY this JSON, no other text:
{"rating":4.6,"reviewCount":12430,"source":"site name","sourceUrl":"https://... page where you read it"}
or {"rating":null}`;
}

function sameSite(domain: string, allowed: Set<string>): boolean {
  for (const a of allowed) if (domain === a || domain.endsWith("." + a) || a.endsWith("." + domain)) return true;
  return false;
}

/** Validate the model's answer. Returns null unless it is a plausible rating from a grounded page. */
export function cleanRating(raw: any, allowed: Set<string>, redirects: Map<string, string> = new Map()): ProductRating | null {
  if (!raw || typeof raw !== "object") return null;
  const rating = typeof raw.rating === "number" ? raw.rating : Number.NaN;
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;
  const url = typeof raw.sourceUrl === "string" ? raw.sourceUrl.trim() : "";
  const rawDomain = domainOf(url);
  const isRedirect = !!rawDomain && rawDomain.endsWith("vertexaisearch.cloud.google.com");
  const domain = isRedirect ? redirects.get(url) ?? null : rawDomain;
  if (!domain || allowed.size === 0 || !sameSite(domain, allowed)) return null;
  const count = typeof raw.reviewCount === "number" && Number.isInteger(raw.reviewCount) && raw.reviewCount > 0 ? raw.reviewCount : undefined;
  const source = String(raw.source || domain).trim().slice(0, 40) || domain;
  return { rating: Math.round(rating * 10) / 10, reviewCount: count, source, sourceUrl: url };
}
