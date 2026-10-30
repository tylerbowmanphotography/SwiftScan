/**
 * Coupon finder helpers (pure functions, unit-tested in test/coupons.test.ts).
 *
 * Coupons come from a Gemini call with Google Search grounding. Codes go stale fast and a model
 * can misread a page, so a coupon is only kept when:
 *   - it has an http(s) source URL, and
 *   - that URL's site is one of the pages Google Search actually returned for the call
 *     (the grounding metadata), so the model can't invent a source.
 * Everything shown to users is labeled "found on the web, not guaranteed".
 */

export type CouponKind = "code" | "deal" | "store_coupon" | "manufacturer" | "rebate";

export interface Coupon {
  store: string;
  title: string;
  kind: CouponKind;
  code?: string;
  expires?: string;
  sourceUrl: string;
  sourceDomain: string;
}

export interface CouponLink {
  label: string;
  url: string;
}

export interface CouponResult {
  coupons: Coupon[];
  links: CouponLink[];
  searchedAt: string;
}

const KINDS: CouponKind[] = ["code", "deal", "store_coupon", "manufacturer", "rebate"];
export const MAX_COUPONS = 8;

export function couponCacheKey(productName: string, brand?: string): string {
  return `${productName} | ${brand || ""}`.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildCouponPrompt(productName: string, brand?: string, category?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Today is ${today}. Search the web for coupons and deals a US shopper can use RIGHT NOW to buy this product:
- Product: ${productName}
- Brand: ${brand || "unknown"}
- Category: ${category || "unknown"}

You MUST use Google Search before answering. Run several searches, for example:
"${productName} coupon", "${brand || productName} coupon", "${brand || productName} promo code", "${productName} rebate", "${productName} sale".

Look for: promo codes, store coupons (Amazon clip coupons, Target Circle, Walmart, Best Buy, etc.), manufacturer coupons, mail-in or instant rebates, and current sales on this product or its brand.
Rules:
- Only include a deal you actually found on a web page in your search results, and give that page's exact URL.
- Skip anything expired, anything for a different product, and generic "sign up for emails" offers.
- If you find nothing current, return an empty list. Never invent a code.

Reply with ONLY this JSON, no other text:
{"coupons":[{"store":"retailer or brand","title":"short description, e.g. $20 off or 15% off","kind":"code|deal|store_coupon|manufacturer|rebate","code":"promo code if one is needed, else omit","expires":"YYYY-MM-DD if stated, else omit","sourceUrl":"https://... page where you found it"}]}`;
}

/** Hostname without "www.", or null if the URL isn't a usable http(s) link. */
export function domainOf(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface GroundedSources {
  /** Sites Google Search returned for the call (grounding chunk titles are domains). */
  domains: Set<string>;
  /** Google redirect link -> the real site it points to. */
  redirects: Map<string, string>;
}

const isGoogleRedirect = (d: string | null) => !!d && d.endsWith("vertexaisearch.cloud.google.com");

export function groundedSources(response: any): GroundedSources {
  const domains = new Set<string>();
  const redirects = new Map<string, string>();
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return { domains, redirects };
  for (const c of chunks) {
    const title = typeof c?.web?.title === "string" ? c.web.title.trim().toLowerCase().replace(/^www\./, "") : "";
    const uri = typeof c?.web?.uri === "string" ? c.web.uri.trim() : "";
    const d = domainOf(uri);
    const site = title && title.includes(".") && !title.includes(" ") ? title : !isGoogleRedirect(d) ? d : null;
    if (!site) continue;
    domains.add(site);
    if (isGoogleRedirect(d)) redirects.set(uri, site);
  }
  return { domains, redirects };
}

/** Back-compat helper: just the domain set. */
export function groundedDomains(response: any): Set<string> {
  return groundedSources(response).domains;
}

function sameSite(domain: string, allowed: Set<string>): boolean {
  for (const a of allowed) {
    if (domain === a || domain.endsWith("." + a) || a.endsWith("." + domain)) return true;
  }
  return false;
}

/**
 * Validate the model's coupon list. When `allowed` is non-empty, coupons whose source site
 * isn't in it are dropped. Expired coupons and duplicates are dropped too.
 */
export function cleanCoupons(raw: any, allowed: Set<string>, now = new Date(), redirects: Map<string, string> = new Map()): Coupon[] {
  const list = Array.isArray(raw?.coupons) ? raw.coupons : Array.isArray(raw) ? raw : [];
  const today = now.toISOString().slice(0, 10);
  const seen = new Set<string>();
  const out: Coupon[] = [];
  for (const c of list) {
    if (!c || typeof c !== "object") continue;
    const url = typeof c.sourceUrl === "string" ? c.sourceUrl.trim() : "";
    const rawDomain = domainOf(url);
    // The model often cites Google's grounding redirect link; it opens the real page, so keep it
    // and use the site it points to. A redirect link we can't map came from nowhere: drop it.
    const sourceDomain = isGoogleRedirect(rawDomain) ? redirects.get(url) ?? null : rawDomain;
    if (!sourceDomain) continue;
    if (allowed.size > 0 && !sameSite(sourceDomain, allowed)) continue;
    const title = String(c.title || "").trim().slice(0, 140);
    const store = String(c.store || sourceDomain).trim().slice(0, 60);
    if (title.length < 3) continue;
    const kind: CouponKind = KINDS.includes(c.kind) ? c.kind : "deal";
    const code = typeof c.code === "string" && /^[A-Za-z0-9_-]{3,30}$/.test(c.code.trim()) ? c.code.trim().toUpperCase() : undefined;
    const expires = typeof c.expires === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.expires.trim()) ? c.expires.trim() : undefined;
    if (expires && expires < today) continue;
    const key = `${store.toLowerCase()}|${(code || title).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ store, title, kind: code ? "code" : kind, code, expires, sourceUrl: url, sourceDomain });
    if (out.length >= MAX_COUPONS) break;
  }
  return out;
}

/** Always-available search links, shown under the results (or alone when nothing was found). */
export function fallbackCouponLinks(productName: string, brand?: string): CouponLink[] {
  const q = (s: string) => `https://www.google.com/search?q=${encodeURIComponent(s)}`;
  const b = brand && !/^unknown/i.test(brand) ? brand.trim() : "";
  const links: CouponLink[] = [{ label: `Coupons for ${productName}`.slice(0, 80), url: q(`${productName} coupon promo code`) }];
  if (b) links.push({ label: `${b} promo codes`, url: q(`${b} promo code`) });
  links.push({ label: "Rebates", url: q(`${productName} rebate`) });
  return links;
}
