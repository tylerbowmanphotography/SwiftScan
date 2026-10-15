/**
 * Monetization: affiliate config, free-scan quota, Stripe Checkout / billing portal / webhook.
 *
 * With a database (Upstash Redis) + email sign-in configured:
 *   - Pro entitlement lives in the DB, keyed by the signed-in user's email (portable across devices)
 *   - the free-scan quota is enforced server-side (per signed-in user, per device cookie and per IP)
 * Without them everything degrades to the previous behaviour: signed-cookie quota + cookie Pro flag.
 */
import crypto from "crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { getStore, type Store } from "./db";
import { isAuthEnabled, readSessionEmail, upsertUser, getUser } from "./auth";
import { clean, hmac, safeEqual, readCookie, setCookie, clientIp, hashShort, appOrigin, today, normalizeEmail } from "./util";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

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
  // backstop is looser than the per-device limit by default.
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

/** Accounts (sign-in + stored Pro status) are on only when both the DB and the email provider are configured. */
export const accountsEnabled = () => isAuthEnabled();

// Stripe client factory (overridable in tests).
let stripeOverride: any;
export function setStripeForTests(s: any) {
  stripeOverride = s;
}
async function getStripe(): Promise<any> {
  if (stripeOverride) return stripeOverride;
  const { default: Stripe } = await import("stripe");
  return new Stripe(stripeConfig().secretKey);
}

// ---------------------------------------------------------------------------
// Pro entitlement (database)
// ---------------------------------------------------------------------------

export interface ProRecord {
  status: string; // Stripe subscription status, or "canceled"
  customerId?: string;
  subscriptionId?: string;
  periodEnd?: number; // ms
  graceUntil?: number; // ms; set when a payment fails
  updatedAt: number;
}

const PAST_DUE_GRACE_MS = 3 * 86400_000;

export function proRecordActive(rec: ProRecord | null | undefined, now = Date.now()): boolean {
  if (!rec) return false;
  if (rec.status === "active" || rec.status === "trialing") return true;
  if (rec.status === "past_due") return !!rec.graceUntil && rec.graceUntil > now;
  return false;
}

async function getProRecord(email: string): Promise<ProRecord | null> {
  const s = getStore();
  return s ? s.get<ProRecord>(`pro:${email}`) : null;
}

async function putProRecord(email: string, patch: Partial<ProRecord>) {
  const s = getStore();
  if (!s) throw new Error("No database configured");
  const prev = (await s.get<ProRecord>(`pro:${email}`)) || ({} as ProRecord);
  const next: ProRecord = { ...prev, ...patch, updatedAt: Date.now() };
  if (next.status === "past_due") next.graceUntil = next.graceUntil && prev.status === "past_due" ? next.graceUntil : Date.now() + PAST_DUE_GRACE_MS;
  else delete next.graceUntil;
  await s.set(`pro:${email}`, next);
  if (next.customerId) {
    await s.set(`cust:${next.customerId}`, email);
    await upsertUser(email, { stripeCustomerId: next.customerId });
  }
}

async function emailForCustomer(customerId: string | undefined, hint?: string | null): Promise<string | null> {
  const fromHint = normalizeEmail(hint);
  if (fromHint) return fromHint;
  if (!customerId) return null;
  const s = getStore();
  const mapped = s ? await s.get<string>(`cust:${customerId}`) : null;
  if (mapped) return mapped;
  try {
    const stripe = await getStripe();
    const c = await stripe.customers.retrieve(customerId);
    return normalizeEmail((c as any)?.email);
  } catch (err: any) {
    console.warn("Stripe customer lookup failed:", err?.message || err);
    return null;
  }
}

const idOf = (v: any): string | undefined => (typeof v === "string" ? v : v?.id) || undefined;

function periodEndMs(sub: any): number | undefined {
  const sec = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return typeof sec === "number" ? sec * 1000 : undefined;
}

/** Applies one verified Stripe event to the database. Returns a short description (for logs/tests). */
export async function applyStripeEvent(event: any): Promise<string> {
  const obj = event?.data?.object || {};
  switch (event?.type) {
    case "checkout.session.completed": {
      if (obj.mode && obj.mode !== "subscription") return "ignored (not a subscription)";
      const paid = obj.payment_status === "paid" || obj.payment_status === "no_payment_required";
      const customerId = idOf(obj.customer);
      const email = await emailForCustomer(customerId, obj.client_reference_id || obj.metadata?.email || obj.customer_details?.email || obj.customer_email);
      if (!email) return "no email for session";
      if (!paid) return "session not paid yet";
      await putProRecord(email, { status: "active", customerId, subscriptionId: idOf(obj.subscription) });
      return `pro on: ${email}`;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const customerId = idOf(obj.customer);
      const email = await emailForCustomer(customerId, obj.metadata?.email);
      if (!email) return "no email for subscription";
      const status = event.type === "customer.subscription.deleted" ? "canceled" : String(obj.status || "unknown");
      await putProRecord(email, { status, customerId, subscriptionId: obj.id, periodEnd: periodEndMs(obj) });
      return `subscription ${status}: ${email}`;
    }
    case "invoice.payment_failed": {
      const customerId = idOf(obj.customer);
      const email = await emailForCustomer(customerId, obj.customer_email);
      if (!email) return "no email for invoice";
      const existing = await getProRecord(email);
      // Only meaningful if this person has (or had) Pro; keep Pro through a short grace window while Stripe retries.
      if (!existing) return "no pro record";
      if (existing.status === "canceled") return "already canceled";
      await putProRecord(email, { status: "past_due", customerId });
      return `payment failed (grace): ${email}`;
    }
    default:
      return "ignored";
  }
}

// ---------------------------------------------------------------------------
// Cookie-based fallback (no database): signed cookie Pro flag + quota cookie + per-instance IP counter
// ---------------------------------------------------------------------------

const ipCounts = new Map<string, { day: string; count: number }>();
const ipKey = (req: Request) => hashShort(clientIp(req));

function readCookieCount(req: Request, day: string): number {
  const raw = readCookie(req, "ss_q");
  if (!raw) return 0;
  const [d, c, sig] = raw.split(".");
  if (d !== day || !/^\d+$/.test(c || "") || !sig || !safeEqual(sig, hmac(`${d}.${c}`))) return 0;
  return Number(c);
}

function readMemoryIpCount(req: Request, day: string): number {
  const e = ipCounts.get(ipKey(req));
  return e && e.day === day ? e.count : 0;
}

function cookieIsPro(req: Request): boolean {
  const raw = readCookie(req, "ss_pro");
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  return !!sig && /^\d+$/.test(exp || "") && Number(exp) > Date.now() && safeEqual(sig, hmac(`pro.${exp}`));
}

function recordCookieScan(req: Request, res: Response, day: string) {
  const next = readCookieCount(req, day) + 1;
  setCookie(req, res, "ss_q", `${day}.${next}.${hmac(`${day}.${next}`)}`, 60 * 60 * 36);
  const key = ipKey(req);
  const e = ipCounts.get(key);
  ipCounts.set(key, { day, count: (e && e.day === day ? e.count : 0) + 1 });
  if (ipCounts.size > 20000) {
    for (const [k, v] of ipCounts) if (v.day !== day) ipCounts.delete(k);
    if (ipCounts.size > 20000) ipCounts.clear();
  }
}

// ---------------------------------------------------------------------------
// Usage / quota
// ---------------------------------------------------------------------------

export interface Usage {
  isPro: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  exhausted: boolean;
}

const DEVICE_COOKIE = "ss_d";

function deviceId(req: Request, res?: Response): string | null {
  const raw = readCookie(req, DEVICE_COOKIE);
  if (raw) {
    const [id, sig] = raw.split(".");
    if (id && sig && safeEqual(sig, hmac("dev." + id, 16))) return id;
  }
  if (!res) return null;
  const id = crypto.randomBytes(12).toString("hex");
  setCookie(req, res, DEVICE_COOKIE, `${id}.${hmac("dev." + id, 16)}`, 60 * 60 * 24 * 400);
  // make it visible to the rest of this request too
  req.headers.cookie = `${req.headers.cookie ? req.headers.cookie + "; " : ""}${DEVICE_COOKIE}=${encodeURIComponent(`${id}.${hmac("dev." + id, 16)}`)}`;
  return id;
}

const QUOTA_TTL = 60 * 60 * 48;
type QuotaKeys = { device?: string; ip: string; user?: string };

function quotaKeys(req: Request, res: Response | undefined, day: string, email: string | null): QuotaKeys {
  const dev = deviceId(req, res);
  return {
    device: dev ? `q:${day}:d:${dev}` : undefined,
    ip: `q:${day}:i:${ipKey(req)}`,
    user: email ? `q:${day}:u:${hashShort(email)}` : undefined,
  };
}

async function readNum(s: Store, key?: string): Promise<number> {
  if (!key) return 0;
  const v = await s.get<number | string>(key);
  return Number(v) || 0;
}

interface UsageDetail extends Usage {
  email: string | null;
  source: "db" | "cookie";
}

function buildUsage(pro: boolean, used: number, ipUsed: number): Usage {
  const limit = getFreeScanLimit();
  const exhausted = !pro && (used >= limit || ipUsed >= getIpLimit(limit));
  return {
    isPro: pro,
    limit: Number.isFinite(limit) ? limit : null,
    used,
    remaining: pro || !Number.isFinite(limit) ? null : exhausted ? 0 : Math.max(limit - used, 0),
    exhausted,
  };
}

export async function getUsageDetail(req: Request, res?: Response): Promise<UsageDetail> {
  const day = today();
  const store = getStore();
  const email = isAuthEnabled() ? readSessionEmail(req) : null;
  if (store) {
    try {
      const pro = (email ? proRecordActive(await getProRecord(email)) : false) || cookieIsPro(req);
      const keys = quotaKeys(req, res, day, email);
      const [d, i, u] = await Promise.all([readNum(store, keys.device), readNum(store, keys.ip), readNum(store, keys.user)]);
      return { ...buildUsage(pro, Math.max(d, u), i), email, source: "db" };
    } catch (err: any) {
      console.warn("Quota DB read failed, falling back to cookies:", err?.message || err);
    }
  }
  return { ...buildUsage(cookieIsPro(req), readCookieCount(req, day), readMemoryIpCount(req, day)), email, source: "cookie" };
}

export async function getUsage(req: Request, res?: Response): Promise<Usage> {
  const { email: _e, source: _s, ...usage } = await getUsageDetail(req, res);
  return usage;
}

async function recordScan(req: Request, res: Response, before: UsageDetail): Promise<Usage> {
  const day = today();
  const store = getStore();
  if (store && before.source === "db") {
    try {
      const keys = quotaKeys(req, res, day, before.email);
      const [d, , u] = await Promise.all([
        keys.device ? store.incr(keys.device, QUOTA_TTL) : Promise.resolve(0),
        store.incr(keys.ip, QUOTA_TTL),
        keys.user ? store.incr(keys.user, QUOTA_TTL) : Promise.resolve(0),
      ]);
      return buildUsage(false, Math.max(d, u), 0);
    } catch (err: any) {
      console.warn("Quota DB write failed, using cookie counter:", err?.message || err);
    }
  }
  recordCookieScan(req, res, day);
  return buildUsage(false, readCookieCount(req, day) + 1, 0);
}

/** Express middleware for /api/scan: blocks when the free limit is used up, counts successful scans. */
export async function scanQuota(req: Request, res: Response, next: NextFunction) {
  let before: UsageDetail;
  try {
    before = await getUsageDetail(req, res);
  } catch (err: any) {
    console.warn("Quota check failed, allowing scan:", err?.message || err);
    return next();
  }
  const { email: _e, source: _s, ...beforeUsage } = before;
  if (before.exhausted) {
    return res.status(429).json({
      success: false,
      code: "FREE_LIMIT_REACHED",
      error: `You've used your ${before.limit} free scans for today. Upgrade to SwiftScan Pro for unlimited scans, or come back tomorrow.`,
      usage: beforeUsage,
      upgrade: { available: isStripeEnabled() },
    });
  }
  const originalJson = res.json.bind(res);
  let done = false;
  (res as any).json = (body: any) => {
    if (done) return originalJson(body);
    done = true;
    const counts = body && typeof body === "object" && res.statusCode === 200 && body.success === true && !before.isPro;
    if (counts) {
      recordScan(req, res, before)
        .then((usage) => originalJson({ ...body, usage }))
        .catch(() => originalJson({ ...body, usage: beforeUsage }));
      return res;
    }
    if (body && typeof body === "object" && !("usage" in body)) body = { ...body, usage: beforeUsage };
    return originalJson(body);
  };
  next();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerMonetizationRoutes(app: Express) {
  // Public (non-secret) config for the UI: affiliate IDs are visible in links anyway.
  app.get(["/api/config", "/api/config/"], async (req, res) => {
    const a = getAffiliateConfig();
    const detail = await getUsageDetail(req, res);
    const { email, source: _s, ...usage } = detail;
    res.json({
      affiliate: {
        amazonTag: a.amazonTag || null,
        ebayCampaignId: a.ebayCampaignId || null,
        walmartLinkPrefix: a.walmartLinkPrefix || null,
        targetLinkPrefix: a.targetLinkPrefix || null,
        bestBuyLinkPrefix: a.bestBuyLinkPrefix || null,
      },
      paid: { enabled: isStripeEnabled(), comingSoon: !isStripeEnabled() },
      accounts: { enabled: accountsEnabled() },
      user: email ? { email, isPro: usage.isPro } : null,
      usage,
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
      const params: any = {
        mode: "subscription",
        line_items: [{ price: stripeConfig().priceId, quantity: 1 }],
        allow_promotion_codes: true,
      };
      const origin = appOrigin(req);
      params.success_url = `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
      params.cancel_url = `${origin}/?checkout=cancel`;

      if (accountsEnabled()) {
        const email = readSessionEmail(req);
        if (!email) {
          return res.status(401).json({ success: false, code: "SIGN_IN_REQUIRED", error: "Sign in with your email first so Pro follows you to any device." });
        }
        const pro = await getProRecord(email);
        if (proRecordActive(pro)) {
          return res.status(409).json({ success: false, code: "ALREADY_PRO", error: "You already have SwiftScan Pro. Use Manage subscription." });
        }
        const user = await getUser(email);
        const customer = pro?.customerId || user?.stripeCustomerId;
        if (customer) params.customer = customer;
        else params.customer_email = email;
        params.client_reference_id = email;
        params.metadata = { email };
        params.subscription_data = { metadata: { email } };
      }

      const stripe = await getStripe();
      const session = await stripe.checkout.sessions.create(params);
      return res.json({ success: true, url: session.url });
    } catch (err: any) {
      console.warn("Checkout error:", err?.message || err);
      return res.status(502).json({ success: false, error: "Couldn't start checkout right now. Please try again." });
    }
  });

  // After Stripe redirects back, confirm the session with Stripe. With accounts this records Pro in
  // the DB right away (the webhook does the same, idempotently); without them it sets a cookie.
  app.get(["/api/checkout/verify", "/api/checkout/verify/"], async (req, res) => {
    const sessionId = String(req.query.session_id || "");
    if (!isStripeEnabled()) return res.status(503).json({ success: false, enabled: false, comingSoon: true });
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return res.status(400).json({ success: false, error: "Invalid session." });
    try {
      const stripe = await getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const ok = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
      if (!ok) return res.status(402).json({ success: false, error: "Payment isn't complete yet." });

      if (accountsEnabled()) {
        const email = readSessionEmail(req);
        if (!email) return res.status(401).json({ success: false, code: "SIGN_IN_REQUIRED", error: "Sign in to finish activating Pro." });
        const owner = normalizeEmail(session.client_reference_id || session.metadata?.email);
        if (owner && owner !== email) {
          return res.status(403).json({ success: false, error: "This payment belongs to a different account." });
        }
        await putProRecord(email, { status: "active", customerId: idOf(session.customer), subscriptionId: idOf(session.subscription) });
        return res.json({ success: true, usage: await getUsage(req, res) });
      }

      const exp = Date.now() + 1000 * 60 * 60 * 24 * 32;
      setCookie(req, res, "ss_pro", `${exp}.${hmac(`pro.${exp}`)}`, 60 * 60 * 24 * 32);
      return res.json({ success: true, usage: { ...(await getUsage(req, res)), isPro: true, exhausted: false, remaining: null } });
    } catch (err: any) {
      console.warn("Checkout verify error:", err?.message || err);
      return res.status(502).json({ success: false, error: "Couldn't confirm the payment. Please contact support." });
    }
  });

  // Stripe billing portal (update card, cancel, invoices). Needs the portal activated in the Stripe dashboard.
  app.post(["/api/billing-portal", "/api/billing-portal/"], async (req, res) => {
    if (!isStripeEnabled() || !accountsEnabled()) return res.status(503).json({ success: false, error: "Billing isn't available yet." });
    const email = readSessionEmail(req);
    if (!email) return res.status(401).json({ success: false, code: "SIGN_IN_REQUIRED", error: "Sign in first." });
    try {
      const pro = await getProRecord(email);
      const user = await getUser(email);
      const customer = pro?.customerId || user?.stripeCustomerId;
      if (!customer) return res.status(404).json({ success: false, error: "No subscription found for this account." });
      const stripe = await getStripe();
      const session = await stripe.billingPortal.sessions.create({ customer, return_url: appOrigin(req) });
      return res.json({ success: true, url: session.url });
    } catch (err: any) {
      console.warn("Billing portal error:", err?.message || err);
      return res.status(502).json({ success: false, error: "Couldn't open the billing portal right now. Please try again later." });
    }
  });

  // Stripe webhook: verifies the signature, then updates Pro in the database.
  app.post(["/api/stripe-webhook", "/api/stripe-webhook/"], async (req, res) => {
    const { secretKey, webhookSecret } = stripeConfig();
    if (!secretKey || !webhookSecret) {
      return res.status(503).json({ received: false, enabled: false, comingSoon: true });
    }
    const raw: Buffer | undefined = (req as any).rawBody;
    const sig = req.headers["stripe-signature"];
    if (!raw || !sig) return res.status(400).json({ received: false, error: "Missing signature or body." });
    let event: any;
    try {
      const stripe = await getStripe();
      event = stripe.webhooks.constructEvent(raw, String(sig), webhookSecret);
    } catch (err: any) {
      console.warn("Stripe webhook signature failure:", err?.message || err);
      return res.status(400).json({ received: false, error: "Invalid signature." });
    }
    const store = getStore();
    if (!store) {
      // Ask Stripe to retry later rather than silently dropping a paid subscription.
      return res.status(503).json({ received: false, error: "Database not configured." });
    }
    try {
      const fresh = await store.set(`evt:${event.id}`, 1, { nx: true, ex: 7 * 86400 });
      if (!fresh) return res.json({ received: true, duplicate: true });
      try {
        const result = await applyStripeEvent(event);
        console.log(`Stripe webhook ${event.type} (${event.id}): ${result}`);
      } catch (err) {
        await store.del(`evt:${event.id}`);
        throw err;
      }
      return res.json({ received: true });
    } catch (err: any) {
      console.warn("Stripe webhook processing error:", err?.message || err);
      return res.status(500).json({ received: false, error: "Processing failed; will retry." });
    }
  });
}
