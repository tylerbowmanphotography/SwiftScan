/**
 * Monetization helpers: affiliate config, free-scan quota, Stripe Checkout scaffold.
 * Everything here is driven by environment variables and degrades gracefully when unset.
 *
 * NOTE: Vercel serverless is stateless. The quota uses a signed cookie (survives across
 * instances, resets if the user clears cookies) plus a best-effort in-memory per-IP counter
 * (per warm instance only). For real enforcement use Vercel KV / Upstash Redis.
 */
import crypto from "crypto";
import type { Express, Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const clean = (v: string | undefined): string => (v || "").trim();

export function getAffiliateConfig() {
  const prefix = (name: string) => {
    const v = clean(process.env[name]);
    return /^https:\/\//i.test(v) ? v : "";
  };
  return {
    amazonTag: clean(process.env.AMAZON_ASSOCIATE_TAG),
    ebayCampaignId: clean(process.env.EBAY_CAMPAIGN_ID),
    // Impact-style deep-link prefixes, e.g. https://goto.walmart.com/c/123456/568844/9383
    walmartLinkPrefix: prefix("WALMART_IMPACT_LINK_PREFIX"),
    targetLinkPrefix: prefix("TARGET_IMPACT_LINK_PREFIX"),
    bestBuyLinkPrefix: prefix("BESTBUY_IMPACT_LINK_PREFIX"),
  };
}

export function getFreeScanLimit(): number {
  const raw = clean(process.env.FREE_SCANS_PER_DAY).toLowerCase();
  if (raw === "unlimited" || raw === "-1") return Infinity;
  const n = Number(raw);
  return raw !== "" && Number.isInteger(n) && n >= 0 ? n : 5;
}

function getIpLimit(limit: number): number {
  if (!Number.isFinite(limit)) return Infinity;
  const raw = Number(clean(process.env.FREE_SCANS_PER_IP_PER_DAY));
  // Shared Wi-Fi / mobile carrier NAT means many people can share one IP, so the IP
  // backstop is looser than the per-device cookie limit by default.
  return Number.isInteger(raw) && raw >= limit ? raw : Math.max(limit * 3, limit);
}

const stripeConfig = () => ({
  secretKey: clean(process.env.STRIPE_SECRET_KEY),
  priceId: clean(process.env.STRIPE_PRICE_ID),
  webhookSecret: clean(process.env.STRIPE_WEBHOOK_SECRET),
});

export const isStripeEnabled = () => {
  const c = stripeConfig();
  return !!(c.secretKey && c.priceId);
};

// ---------------------------------------------------------------------------
// Signed cookies
// ---------------------------------------------------------------------------

function secret(): string {
  const explicit = clean(process.env.QUOTA_COOKIE_SECRET);
  if (explicit) return explicit;
  // Stable across serverless instances without extra config: derive from a secret we already hold.
  const base = clean(process.env.STRIPE_SECRET_KEY) || clean(process.env.GEMINI_API_KEY) ||
    clean(process.env.GoogleAIStudio) || clean(process.env.GOOGLE_API_KEY) || "swiftscan-dev-secret";
  return crypto.createHash("sha256").update("swiftscan-quota:" + base).digest("hex");
}

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

function setCookie(req: Request, res: Response, name: string, value: string, maxAgeSec: number) {
  const secure = (req.headers["x-forwarded-proto"] || req.protocol) === "https";
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", prev ? ([] as string[]).concat(prev as any, cookie) : cookie);
}

// ---------------------------------------------------------------------------
// Free scan quota
// ---------------------------------------------------------------------------

const QUOTA_TZ = clean(process.env.QUOTA_TIMEZONE) || "America/Chicago";

function today(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: QUOTA_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const ipCounts = new Map<string, { day: string; count: number }>();

function clientIp(req: Request): string {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return clean(String(req.headers["x-real-ip"] || "")) || xff || req.socket?.remoteAddress || "unknown";
}

const ipKey = (req: Request) => crypto.createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 24);

function readDeviceCount(req: Request, day: string): number {
  const raw = readCookie(req, "ss_q");
  if (!raw) return 0;
  const [d, c, sig] = raw.split(".");
  if (d !== day || !/^\d+$/.test(c || "") || !sig || sig !== sign(`${d}.${c}`)) return 0;
  return Number(c);
}

function readIpCount(req: Request, day: string): number {
  const e = ipCounts.get(ipKey(req));
  return e && e.day === day ? e.count : 0;
}

function isPro(req: Request): boolean {
  const raw = readCookie(req, "ss_pro");
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  return !!sig && /^\d+$/.test(exp || "") && Number(exp) > Date.now() && sig === sign(`pro.${exp}`);
}

export function getUsage(req: Request) {
  const limit = getFreeScanLimit();
  const day = today();
  const pro = isPro(req);
  const used = Math.max(readDeviceCount(req, day), 0);
  const ipUsed = readIpCount(req, day);
  const exhausted = !pro && (used >= limit || ipUsed >= getIpLimit(limit));
  return {
    isPro: pro,
    limit: Number.isFinite(limit) ? limit : null,
    used,
    remaining: pro || !Number.isFinite(limit) ? null : exhausted ? 0 : Math.max(limit - used, 0),
    exhausted,
  };
}

function recordScan(req: Request, res: Response) {
  const day = today();
  const next = readDeviceCount(req, day) + 1;
  setCookie(req, res, "ss_q", `${day}.${next}.${sign(`${day}.${next}`)}`, 60 * 60 * 36);
  const key = ipKey(req);
  const e = ipCounts.get(key);
  ipCounts.set(key, { day, count: (e && e.day === day ? e.count : 0) + 1 });
  if (ipCounts.size > 20000) {
    for (const [k, v] of ipCounts) if (v.day !== day) ipCounts.delete(k);
    if (ipCounts.size > 20000) ipCounts.clear();
  }
}

/** Express middleware for /api/scan: blocks when the free limit is used up, counts successful scans. */
export function scanQuota(req: Request, res: Response, next: NextFunction) {
  const before = getUsage(req);
  if (before.exhausted) {
    return res.status(429).json({
      success: false,
      code: "FREE_LIMIT_REACHED",
      error: `You've used your ${before.limit} free scans for today. Upgrade to SwiftScan Pro for unlimited scans, or come back tomorrow.`,
      usage: before,
      upgrade: { available: isStripeEnabled() },
    });
  }
  const originalJson = res.json.bind(res);
  (res as any).json = (body: any) => {
    if (body && typeof body === "object" && res.statusCode === 200 && body.success === true && !before.isPro) {
      recordScan(req, res);
      const day = today();
      const used = readDeviceCount(req, day) + 1; // request cookie is pre-increment
      const limit = getFreeScanLimit();
      body = { ...body, usage: { ...before, used, remaining: Number.isFinite(limit) ? Math.max(limit - used, 0) : null, exhausted: used >= limit } };
    } else if (body && typeof body === "object" && !("usage" in body)) {
      body = { ...body, usage: before };
    }
    return originalJson(body);
  };
  next();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function appOrigin(req: Request): string {
  const configured = clean(process.env.APP_URL);
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0];
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}

async function getStripe() {
  const { default: Stripe } = await import("stripe");
  return new Stripe(stripeConfig().secretKey);
}

export function registerMonetizationRoutes(app: Express) {
  // Public (non-secret) config for the UI: affiliate IDs are visible in links anyway.
  app.get(["/api/config", "/api/config/"], (req, res) => {
    const a = getAffiliateConfig();
    res.json({
      affiliate: {
        amazonTag: a.amazonTag || null,
        ebayCampaignId: a.ebayCampaignId || null,
        walmartLinkPrefix: a.walmartLinkPrefix || null,
        targetLinkPrefix: a.targetLinkPrefix || null,
        bestBuyLinkPrefix: a.bestBuyLinkPrefix || null,
      },
      paid: { enabled: isStripeEnabled(), comingSoon: !isStripeEnabled() },
      usage: getUsage(req),
    });
  });

  app.post(["/api/checkout", "/api/checkout/"], async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(503).json({
        success: false,
        enabled: false,
        comingSoon: true,
        error: "SwiftScan Pro is coming soon. Paid plans aren't open yet.",
      });
    }
    try {
      const stripe = await getStripe();
      const origin = appOrigin(req);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: stripeConfig().priceId, quantity: 1 }],
        success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?checkout=cancel`,
        allow_promotion_codes: true,
      });
      return res.json({ success: true, url: session.url });
    } catch (err: any) {
      console.warn("Checkout error:", err?.message || err);
      return res.status(502).json({ success: false, error: "Couldn't start checkout right now. Please try again." });
    }
  });

  // After Stripe redirects back, confirm the session with Stripe and mark this browser as Pro.
  // (A durable, per-customer entitlement store comes with a database; see the webhook stub.)
  app.get(["/api/checkout/verify", "/api/checkout/verify/"], async (req, res) => {
    const sessionId = String(req.query.session_id || "");
    if (!isStripeEnabled()) return res.status(503).json({ success: false, enabled: false, comingSoon: true });
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return res.status(400).json({ success: false, error: "Invalid session." });
    try {
      const stripe = await getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const ok = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
      if (!ok) return res.status(402).json({ success: false, error: "Payment isn't complete yet." });
      const exp = Date.now() + 1000 * 60 * 60 * 24 * 32;
      setCookie(req, res, "ss_pro", `${exp}.${sign(`pro.${exp}`)}`, 60 * 60 * 24 * 32);
      return res.json({ success: true, usage: { ...getUsage(req), isPro: true, exhausted: false, remaining: null } });
    } catch (err: any) {
      console.warn("Checkout verify error:", err?.message || err);
      return res.status(502).json({ success: false, error: "Couldn't confirm the payment. Please contact support." });
    }
  });

  // Webhook stub: verifies the Stripe signature and logs the event. It does not persist
  // anything yet; subscription state needs a database (Vercel KV/Upstash/Postgres).
  app.post(["/api/stripe-webhook", "/api/stripe-webhook/"], async (req, res) => {
    const { secretKey, webhookSecret } = stripeConfig();
    if (!secretKey || !webhookSecret) {
      return res.status(503).json({ received: false, enabled: false, comingSoon: true });
    }
    const raw: Buffer | undefined = (req as any).rawBody;
    const sig = req.headers["stripe-signature"];
    if (!raw || !sig) return res.status(400).json({ received: false, error: "Missing signature or body." });
    try {
      const stripe = await getStripe();
      const event = stripe.webhooks.constructEvent(raw, String(sig), webhookSecret);
      console.log(`Stripe webhook received: ${event.type} (${event.id}) - not persisted (stub)`);
      // TODO: on checkout.session.completed / customer.subscription.updated|deleted,
      // store entitlement keyed by customer id in a database.
      return res.json({ received: true });
    } catch (err: any) {
      console.warn("Stripe webhook signature failure:", err?.message || err);
      return res.status(400).json({ received: false, error: "Invalid signature." });
    }
  });
}
