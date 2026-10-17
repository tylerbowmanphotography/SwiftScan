// server.ts
import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// server/monetization.ts
import crypto3 from "crypto";

// server/db.ts
import { Redis } from "@upstash/redis";
var clean = (v) => (v || "").trim();
function dbCredentials() {
  const url = clean(process.env.KV_REST_API_URL) || clean(process.env.UPSTASH_REDIS_REST_URL);
  const token = clean(process.env.KV_REST_API_TOKEN) || clean(process.env.UPSTASH_REDIS_REST_TOKEN);
  return url && token ? { url, token } : null;
}
var UpstashStore = class {
  constructor(url, token) {
    this.r = new Redis({ url, token, retry: { retries: 1, backoff: () => 200 } });
  }
  async get(key) {
    return await this.r.get(key) ?? null;
  }
  async set(key, value, opts) {
    let res;
    if (opts?.nx && opts?.ex) res = await this.r.set(key, value, { nx: true, ex: opts.ex });
    else if (opts?.nx) res = await this.r.set(key, value, { nx: true });
    else if (opts?.ex) res = await this.r.set(key, value, { ex: opts.ex });
    else res = await this.r.set(key, value);
    return res === "OK";
  }
  async del(key) {
    await this.r.del(key);
  }
  async incr(key, ttlSec) {
    const n = await this.r.incr(key);
    if (n === 1) await this.r.expire(key, ttlSec);
    return n;
  }
  async sadd(key, member) {
    await this.r.sadd(key, member);
  }
  async srem(key, member) {
    await this.r.srem(key, member);
  }
  async smembers(key) {
    return (await this.r.smembers(key)).map(String);
  }
  async hset(key, field, value) {
    await this.r.hset(key, { [field]: value });
  }
  async hdel(key, field) {
    await this.r.hdel(key, field);
  }
  async hgetall(key) {
    return await this.r.hgetall(key) || {};
  }
};
var override;
var cached;
function getStore() {
  if (override !== void 0) return override;
  if (cached !== void 0) return cached;
  const c = dbCredentials();
  cached = c ? new UpstashStore(c.url, c.token) : null;
  return cached;
}

// server/auth.ts
import crypto2 from "crypto";

// server/util.ts
import crypto from "crypto";
var clean2 = (v) => (v || "").trim();
function secret() {
  const explicit = clean2(process.env.AUTH_SECRET) || clean2(process.env.QUOTA_COOKIE_SECRET);
  if (explicit) return explicit;
  const base = clean2(process.env.STRIPE_SECRET_KEY) || clean2(process.env.GEMINI_API_KEY) || clean2(process.env.GoogleAIStudio) || clean2(process.env.GOOGLE_API_KEY) || "swiftscan-dev-secret";
  return crypto.createHash("sha256").update("swiftscan-quota:" + base).digest("hex");
}
var hmac = (payload, len = 32) => crypto.createHmac("sha256", secret()).update(payload).digest("hex").slice(0, len);
var safeEqual = (a, b) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return void 0;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return void 0;
      }
    }
  }
  return void 0;
}
function setCookie(req, res, name, value, maxAgeSec) {
  const secure = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0] === "https";
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", prev ? [].concat(prev, cookie) : cookie);
}
var clearCookie = (req, res, name) => setCookie(req, res, name, "", 0);
function clientIp(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return clean2(String(req.headers["x-real-ip"] || "")) || xff || req.socket?.remoteAddress || "unknown";
}
var hashShort = (s, len = 24) => crypto.createHash("sha256").update(s).digest("hex").slice(0, len);
function appOrigin(req) {
  const configured = clean2(process.env.APP_URL);
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0];
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}
function today() {
  const tz = clean2(process.env.QUOTA_TIMEZONE) || "America/Chicago";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
  } catch {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
}
var EMAIL_RE = /^[^\s@<>()"',;:]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
function normalizeEmail(raw) {
  const e = String(raw ?? "").trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
var escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var isEmailConfigured = () => !!clean2(process.env.RESEND_API_KEY);
async function sendEmail(msg) {
  const key = clean2(process.env.RESEND_API_KEY);
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const from = clean2(process.env.RESEND_FROM) || "SwiftScan <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

// server/brand.ts
var BRAND_BUTTON = "#db2777";
var BRAND_LINK = "#be185d";

// server/auth.ts
var SESSION_COOKIE = "ss_sess";
var SESSION_DAYS = 30;
var CODE_TTL_SEC = 10 * 60;
var MAX_CODE_ATTEMPTS = 5;
var isAuthEnabled = () => !!getStore() && isEmailConfigured();
function createSessionToken(email, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ e: email, x: now + SESSION_DAYS * 864e5 })).toString("base64url");
  return `${payload}.${hmac("sess." + payload, 40)}`;
}
function readSessionEmail(req) {
  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sig, hmac("sess." + payload, 40))) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof e === "string" && typeof x === "number" && x > Date.now() ? e : null;
  } catch {
    return null;
  }
}
function startSession(req, res, email) {
  setCookie(req, res, SESSION_COOKIE, createSessionToken(email), SESSION_DAYS * 86400);
}
function endSession(req, res) {
  clearCookie(req, res, SESSION_COOKIE);
}
async function getUser(email) {
  const s = getStore();
  return s ? s.get(`user:${email}`) : null;
}
async function upsertUser(email, patch = {}) {
  const s = getStore();
  if (!s) throw new Error("No database configured");
  const existing = await s.get(`user:${email}`);
  const next = { ...existing || { email, createdAt: Date.now() }, ...patch, email };
  await s.set(`user:${email}`, next);
  return next;
}
async function rateLimited(key, max, ttlSec) {
  const s = getStore();
  if (!s) return false;
  return await s.incr(key, ttlSec) > max;
}
function codeEmail(code) {
  const subject = `Your SwiftScan sign-in code: ${code}`;
  const text = `Your SwiftScan sign-in code is ${code}. It expires in 10 minutes.

If you didn't ask for this, you can ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px"><h2 style="margin:0 0 12px">SwiftScan sign-in</h2><p>Your sign-in code is:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:8px 0;color:${BRAND_BUTTON}">${escapeHtml(code)}</p><p style="color:#555">It expires in 10 minutes. If you didn't ask for this, you can ignore this email.</p></div>`;
  return { subject, text, html };
}
function registerAuthRoutes(app2) {
  app2.post(["/api/auth/request", "/api/auth/request/"], async (req, res) => {
    if (!isAuthEnabled()) {
      return res.status(503).json({ success: false, error: "Sign-in isn't available yet." });
    }
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ success: false, error: "Enter a valid email address." });
    const s = getStore();
    try {
      if (await rateLimited(`rl:auth:e:${hashShort(email)}`, 5, 15 * 60) || await rateLimited(`rl:auth:ip:${hashShort(clientIp(req))}`, 20, 60 * 60)) {
        return res.status(429).json({ success: false, error: "Too many sign-in attempts. Please wait a few minutes and try again." });
      }
      const code = String(crypto2.randomInt(0, 1e6)).padStart(6, "0");
      await s.set(`code:${hashShort(email, 32)}`, { h: hmac(`code.${email}.${code}`, 40), a: 0 }, { ex: CODE_TTL_SEC });
      try {
        await sendEmail({ to: email, ...codeEmail(code) });
      } catch (err) {
        await s.del(`code:${hashShort(email, 32)}`);
        console.warn("Sign-in email failed:", err?.message || err);
        return res.status(502).json({ success: false, error: "Couldn't send the sign-in email right now. Please try again." });
      }
      return res.json({ success: true });
    } catch (err) {
      console.warn("Auth request error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
    }
  });
  app2.post(["/api/auth/verify", "/api/auth/verify/"], async (req, res) => {
    if (!isAuthEnabled()) return res.status(503).json({ success: false, error: "Sign-in isn't available yet." });
    const email = normalizeEmail(req.body?.email);
    const code = clean2(String(req.body?.code ?? "")).replace(/\s/g, "");
    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: "Enter the 6-digit code from your email." });
    }
    const s = getStore();
    try {
      const key = `code:${hashShort(email, 32)}`;
      const rec = await s.get(key);
      if (!rec) return res.status(401).json({ success: false, error: "That code has expired. Request a new one." });
      if (rec.a >= MAX_CODE_ATTEMPTS) {
        await s.del(key);
        return res.status(401).json({ success: false, error: "Too many wrong attempts. Request a new code." });
      }
      if (!safeEqual(rec.h, hmac(`code.${email}.${code}`, 40))) {
        await s.set(key, { ...rec, a: rec.a + 1 }, { ex: CODE_TTL_SEC });
        return res.status(401).json({ success: false, error: "That code isn't right. Check the email and try again." });
      }
      await s.del(key);
      await upsertUser(email);
      startSession(req, res, email);
      return res.json({ success: true, user: { email } });
    } catch (err) {
      console.warn("Auth verify error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
    }
  });
  app2.post(["/api/auth/logout", "/api/auth/logout/"], (req, res) => {
    endSession(req, res);
    res.json({ success: true });
  });
}

// server/monetization.ts
function getAffiliateConfig() {
  const prefix = (name) => {
    const v = clean2(process.env[name]);
    return /^https:\/\//i.test(v) ? v : "";
  };
  return {
    amazonTag: clean2(process.env.AMAZON_ASSOCIATE_TAG),
    ebayCampaignId: clean2(process.env.EBAY_CAMPAIGN_ID),
    // Impact-style deep-link prefixes, e.g. https://goto.walmart.com/c/123456/568844/9383
    walmartLinkPrefix: prefix("WALMART_IMPACT_LINK_PREFIX"),
    targetLinkPrefix: prefix("TARGET_IMPACT_LINK_PREFIX"),
    bestBuyLinkPrefix: prefix("BESTBUY_IMPACT_LINK_PREFIX")
  };
}
function getFreeScanLimit() {
  const raw = clean2(process.env.FREE_SCANS_PER_DAY).toLowerCase();
  if (raw === "unlimited" || raw === "-1") return Infinity;
  const n = Number(raw);
  return raw !== "" && Number.isInteger(n) && n >= 0 ? n : 5;
}
function getIpLimit(limit) {
  if (!Number.isFinite(limit)) return Infinity;
  const raw = Number(clean2(process.env.FREE_SCANS_PER_IP_PER_DAY));
  return Number.isInteger(raw) && raw >= limit ? raw : Math.max(limit * 3, limit);
}
var stripeConfig = () => ({
  secretKey: clean2(process.env.STRIPE_SECRET_KEY),
  priceId: clean2(process.env.STRIPE_PRICE_ID),
  webhookSecret: clean2(process.env.STRIPE_WEBHOOK_SECRET)
});
var isStripeEnabled = () => {
  const c = stripeConfig();
  return !!(c.secretKey && c.priceId);
};
var accountsEnabled = () => isAuthEnabled();
var stripeOverride;
async function getStripe() {
  if (stripeOverride) return stripeOverride;
  const { default: Stripe } = await import("stripe");
  return new Stripe(stripeConfig().secretKey);
}
var PAST_DUE_GRACE_MS = 3 * 864e5;
function isUnlimitedEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  return clean2(process.env.UNLIMITED_EMAILS).split(/[,\s]+/).map((x) => normalizeEmail(x)).includes(e);
}
function proRecordActive(rec, now = Date.now()) {
  if (!rec) return false;
  if (rec.status === "active" || rec.status === "trialing") return true;
  if (rec.status === "past_due") return !!rec.graceUntil && rec.graceUntil > now;
  return false;
}
async function getProRecord(email) {
  const s = getStore();
  return s ? s.get(`pro:${email}`) : null;
}
async function putProRecord(email, patch) {
  const s = getStore();
  if (!s) throw new Error("No database configured");
  const prev = await s.get(`pro:${email}`) || {};
  const next = { ...prev, ...patch, updatedAt: Date.now() };
  if (next.status === "past_due") next.graceUntil = next.graceUntil && prev.status === "past_due" ? next.graceUntil : Date.now() + PAST_DUE_GRACE_MS;
  else delete next.graceUntil;
  await s.set(`pro:${email}`, next);
  if (next.customerId) {
    await s.set(`cust:${next.customerId}`, email);
    await upsertUser(email, { stripeCustomerId: next.customerId });
  }
}
async function endProForDeletedAccount(email) {
  const s = getStore();
  if (!s) return;
  const rec = await getProRecord(email);
  if (rec?.subscriptionId && rec.status !== "canceled" && isStripeEnabled()) {
    const stripe = await getStripe();
    try {
      await stripe.subscriptions.cancel(rec.subscriptionId);
    } catch (err) {
      if (err?.code !== "resource_missing") throw err;
    }
  }
  if (rec?.customerId) await s.del(`cust:${rec.customerId}`);
  await s.del(`pro:${email}`);
}
async function emailForCustomer(customerId, hint) {
  const fromHint = normalizeEmail(hint);
  if (fromHint) return fromHint;
  if (!customerId) return null;
  const s = getStore();
  const mapped = s ? await s.get(`cust:${customerId}`) : null;
  if (mapped) return mapped;
  try {
    const stripe = await getStripe();
    const c = await stripe.customers.retrieve(customerId);
    return normalizeEmail(c?.email);
  } catch (err) {
    console.warn("Stripe customer lookup failed:", err?.message || err);
    return null;
  }
}
var idOf = (v) => (typeof v === "string" ? v : v?.id) || void 0;
function periodEndMs(sub) {
  const sec = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return typeof sec === "number" ? sec * 1e3 : void 0;
}
async function applyStripeEvent(event) {
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
      if (!existing) return "no pro record";
      if (existing.status === "canceled") return "already canceled";
      await putProRecord(email, { status: "past_due", customerId });
      return `payment failed (grace): ${email}`;
    }
    default:
      return "ignored";
  }
}
var ipCounts = /* @__PURE__ */ new Map();
var ipKey = (req) => hashShort(clientIp(req));
function readCookieCount(req, day) {
  const raw = readCookie(req, "ss_q");
  if (!raw) return 0;
  const [d, c, sig] = raw.split(".");
  if (d !== day || !/^\d+$/.test(c || "") || !sig || !safeEqual(sig, hmac(`${d}.${c}`))) return 0;
  return Number(c);
}
function readMemoryIpCount(req, day) {
  const e = ipCounts.get(ipKey(req));
  return e && e.day === day ? e.count : 0;
}
function cookieIsPro(req) {
  const raw = readCookie(req, "ss_pro");
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  return !!sig && /^\d+$/.test(exp || "") && Number(exp) > Date.now() && safeEqual(sig, hmac(`pro.${exp}`));
}
function recordCookieScan(req, res, day) {
  const next = readCookieCount(req, day) + 1;
  setCookie(req, res, "ss_q", `${day}.${next}.${hmac(`${day}.${next}`)}`, 60 * 60 * 36);
  const key = ipKey(req);
  const e = ipCounts.get(key);
  ipCounts.set(key, { day, count: (e && e.day === day ? e.count : 0) + 1 });
  if (ipCounts.size > 2e4) {
    for (const [k, v] of ipCounts) if (v.day !== day) ipCounts.delete(k);
    if (ipCounts.size > 2e4) ipCounts.clear();
  }
}
var DEVICE_COOKIE = "ss_d";
function deviceId(req, res) {
  const raw = readCookie(req, DEVICE_COOKIE);
  if (raw) {
    const [id2, sig] = raw.split(".");
    if (id2 && sig && safeEqual(sig, hmac("dev." + id2, 16))) return id2;
  }
  if (!res) return null;
  const id = crypto3.randomBytes(12).toString("hex");
  setCookie(req, res, DEVICE_COOKIE, `${id}.${hmac("dev." + id, 16)}`, 60 * 60 * 24 * 400);
  req.headers.cookie = `${req.headers.cookie ? req.headers.cookie + "; " : ""}${DEVICE_COOKIE}=${encodeURIComponent(`${id}.${hmac("dev." + id, 16)}`)}`;
  return id;
}
var QUOTA_TTL = 60 * 60 * 48;
function quotaKeys(req, res, day, email) {
  const dev = deviceId(req, res);
  return {
    device: dev ? `q:${day}:d:${dev}` : void 0,
    ip: `q:${day}:i:${ipKey(req)}`,
    user: email ? `q:${day}:u:${hashShort(email)}` : void 0
  };
}
async function readNum(s, key) {
  if (!key) return 0;
  const v = await s.get(key);
  return Number(v) || 0;
}
function buildUsage(pro, used, ipUsed) {
  const limit = getFreeScanLimit();
  const exhausted = !pro && (used >= limit || ipUsed >= getIpLimit(limit));
  return {
    isPro: pro,
    limit: Number.isFinite(limit) ? limit : null,
    used,
    remaining: pro || !Number.isFinite(limit) ? null : exhausted ? 0 : Math.max(limit - used, 0),
    exhausted
  };
}
async function getUsageDetail(req, res) {
  const day = today();
  const store = getStore();
  const email = isAuthEnabled() ? readSessionEmail(req) : null;
  if (store) {
    try {
      const pro = isUnlimitedEmail(email) || (email ? proRecordActive(await getProRecord(email)) : false) || cookieIsPro(req);
      const keys = quotaKeys(req, res, day, email);
      const [d, i, u] = await Promise.all([readNum(store, keys.device), readNum(store, keys.ip), readNum(store, keys.user)]);
      return { ...buildUsage(pro, Math.max(d, u), i), email, source: "db" };
    } catch (err) {
      console.warn("Quota DB read failed, falling back to cookies:", err?.message || err);
    }
  }
  return { ...buildUsage(cookieIsPro(req), readCookieCount(req, day), readMemoryIpCount(req, day)), email, source: "cookie" };
}
async function getUsage(req, res) {
  const { email: _e, source: _s, ...usage } = await getUsageDetail(req, res);
  return usage;
}
async function recordScan(req, res, before) {
  const day = today();
  const store = getStore();
  if (store && before.source === "db") {
    try {
      const keys = quotaKeys(req, res, day, before.email);
      const [d, , u] = await Promise.all([
        keys.device ? store.incr(keys.device, QUOTA_TTL) : Promise.resolve(0),
        store.incr(keys.ip, QUOTA_TTL),
        keys.user ? store.incr(keys.user, QUOTA_TTL) : Promise.resolve(0)
      ]);
      return buildUsage(false, Math.max(d, u), 0);
    } catch (err) {
      console.warn("Quota DB write failed, using cookie counter:", err?.message || err);
    }
  }
  recordCookieScan(req, res, day);
  return buildUsage(false, readCookieCount(req, day) + 1, 0);
}
async function scanQuota(req, res, next) {
  let before;
  try {
    before = await getUsageDetail(req, res);
  } catch (err) {
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
      upgrade: { available: isStripeEnabled() }
    });
  }
  const originalJson = res.json.bind(res);
  let done = false;
  res.json = (body) => {
    if (done) return originalJson(body);
    done = true;
    const counts = body && typeof body === "object" && res.statusCode === 200 && body.success === true && !before.isPro;
    if (counts) {
      recordScan(req, res, before).then((usage) => originalJson({ ...body, usage })).catch(() => originalJson({ ...body, usage: beforeUsage }));
      return res;
    }
    if (body && typeof body === "object" && !("usage" in body)) body = { ...body, usage: beforeUsage };
    return originalJson(body);
  };
  next();
}
function registerMonetizationRoutes(app2) {
  app2.get(["/api/config", "/api/config/"], async (req, res) => {
    const a = getAffiliateConfig();
    const detail = await getUsageDetail(req, res);
    const { email, source: _s, ...usage } = detail;
    res.json({
      affiliate: {
        amazonTag: a.amazonTag || null,
        ebayCampaignId: a.ebayCampaignId || null,
        walmartLinkPrefix: a.walmartLinkPrefix || null,
        targetLinkPrefix: a.targetLinkPrefix || null,
        bestBuyLinkPrefix: a.bestBuyLinkPrefix || null
      },
      paid: { enabled: isStripeEnabled(), comingSoon: !isStripeEnabled() },
      accounts: { enabled: accountsEnabled() },
      user: email ? { email, isPro: usage.isPro } : null,
      usage
    });
  });
  app2.post(["/api/checkout", "/api/checkout/"], async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(503).json({
        success: false,
        enabled: false,
        comingSoon: true,
        error: "SwiftScan Pro is coming soon. Paid plans aren't open yet."
      });
    }
    try {
      const params = {
        mode: "subscription",
        line_items: [{ price: stripeConfig().priceId, quantity: 1 }],
        allow_promotion_codes: true
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
    } catch (err) {
      console.warn("Checkout error:", err?.message || err);
      return res.status(502).json({ success: false, error: "Couldn't start checkout right now. Please try again." });
    }
  });
  app2.get(["/api/checkout/verify", "/api/checkout/verify/"], async (req, res) => {
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
      const exp = Date.now() + 1e3 * 60 * 60 * 24 * 32;
      setCookie(req, res, "ss_pro", `${exp}.${hmac(`pro.${exp}`)}`, 60 * 60 * 24 * 32);
      return res.json({ success: true, usage: { ...await getUsage(req, res), isPro: true, exhausted: false, remaining: null } });
    } catch (err) {
      console.warn("Checkout verify error:", err?.message || err);
      return res.status(502).json({ success: false, error: "Couldn't confirm the payment. Please contact support." });
    }
  });
  app2.post(["/api/billing-portal", "/api/billing-portal/"], async (req, res) => {
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
    } catch (err) {
      console.warn("Billing portal error:", err?.message || err);
      return res.status(502).json({ success: false, error: "Couldn't open the billing portal right now. Please try again later." });
    }
  });
  app2.post(["/api/stripe-webhook", "/api/stripe-webhook/"], async (req, res) => {
    const { secretKey, webhookSecret } = stripeConfig();
    if (!secretKey || !webhookSecret) {
      return res.status(503).json({ received: false, enabled: false, comingSoon: true });
    }
    const raw = req.rawBody;
    const sig = req.headers["stripe-signature"];
    if (!raw || !sig) return res.status(400).json({ received: false, error: "Missing signature or body." });
    let event;
    try {
      const stripe = await getStripe();
      event = stripe.webhooks.constructEvent(raw, String(sig), webhookSecret);
    } catch (err) {
      console.warn("Stripe webhook signature failure:", err?.message || err);
      return res.status(400).json({ received: false, error: "Invalid signature." });
    }
    const store = getStore();
    if (!store) {
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
    } catch (err) {
      console.warn("Stripe webhook processing error:", err?.message || err);
      return res.status(500).json({ received: false, error: "Processing failed; will retry." });
    }
  });
}

// server/account.ts
async function deleteAccountData(email) {
  const s = getStore();
  if (!s) throw new Error("No database configured");
  await endProForDeletedAccount(email);
  await s.del(`alerts:${email}`);
  await s.srem("alerts:index", email);
  await s.del(`items:${email}`);
  await s.del(`user:${email}`);
}
function registerAccountRoutes(app2) {
  app2.post(["/api/account/delete", "/api/account/delete/"], async (req, res) => {
    const email = getStore() ? readSessionEmail(req) : null;
    if (!email) return res.status(401).json({ success: false, code: "SIGN_IN_REQUIRED", error: "Sign in to delete your account." });
    if (req.body?.confirm !== true) {
      return res.status(400).json({ success: false, error: "Confirm the deletion to continue." });
    }
    try {
      await deleteAccountData(email);
      endSession(req, res);
      return res.json({ success: true });
    } catch (err) {
      console.error("Account deletion failed:", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "We couldn't delete your account right now. Please try again, or email us and we'll do it for you."
      });
    }
  });
}

// server/alerts.ts
var INDEX_KEY = "alerts:index";
var alertsKey = (email) => `alerts:${email}`;
var alertId = (productName) => hashShort(productName.trim().toLowerCase(), 16);
var intEnv = (name, dflt) => {
  const raw = clean2(process.env[name]);
  const n = Number(raw);
  return raw !== "" && Number.isInteger(n) && n >= 0 ? n : dflt;
};
var maxAlertsFor = (pro) => pro ? intEnv("ALERTS_MAX_PRO", 25) : intEnv("ALERTS_MAX_FREE", 3);
async function listAlerts(email) {
  const s = getStore();
  if (!s) return [];
  const all = await s.hgetall(alertsKey(email));
  return Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
}
async function removeAlert(email, id) {
  const s = getStore();
  if (!s) return;
  await s.hdel(alertsKey(email), id);
  if ((await listAlerts(email)).length === 0) await s.srem(INDEX_KEY, email);
}
var money = (n) => `$${n.toFixed(2)}`;
function unsubToken(email, id) {
  return `${Buffer.from(JSON.stringify({ e: email, i: id })).toString("base64url")}.${hmac(`unsub.${email}.${id}`, 32)}`;
}
function readUnsubToken(token) {
  const [p, sig] = String(token || "").split(".");
  if (!p || !sig) return null;
  try {
    const { e, i } = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    if (typeof e !== "string" || typeof i !== "string") return null;
    return safeEqual(sig, hmac(`unsub.${e}.${i}`, 32)) ? { email: e, id: i } : null;
  } catch {
    return null;
  }
}
function amazonSearchUrl(productName) {
  const tag = getAffiliateConfig().amazonTag;
  return `https://www.amazon.com/s?k=${encodeURIComponent(productName)}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`;
}
function buildAlertEmail(email, alert, est, origin) {
  const unsub = `${origin}/api/alerts/unsubscribe?t=${unsubToken(email, alert.id)}`;
  const hasTag = !!getAffiliateConfig().amazonTag;
  const link = amazonSearchUrl(alert.productName);
  const subject = `Price alert: ${alert.productName} is around ${money(est.price)}`;
  const disclosure = hasTag ? "As an Amazon Associate I earn from qualifying purchases." : "";
  const text = [
    `${alert.productName} now looks to be around ${money(est.price)} (estimate), at or below your target of ${money(alert.targetPrice)}.`,
    "",
    "This is an AI/web-search estimate, not a live store price. Check the price at the store before you buy.",
    "",
    `Look it up: ${link}`,
    disclosure,
    "",
    `You're getting this because you set a price alert in SwiftScan. Stop this alert: ${unsub}`
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5">
<h2 style="margin:0 0 8px">Price alert</h2>
<p><strong>${escapeHtml(alert.productName)}</strong> now looks to be around <strong>${money(est.price)}</strong>${est.retailer ? ` at ${escapeHtml(est.retailer)}` : ""} (estimate), at or below your target of ${money(alert.targetPrice)}.</p>
<p style="color:#555;font-size:13px">This is an AI/web-search estimate, not a live store price. Check the price at the store before you buy.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:${BRAND_BUTTON};color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">Look it up on Amazon</a></p>
${disclosure ? `<p style="color:#777;font-size:12px">${disclosure}</p>` : ""}
<p style="color:#777;font-size:12px">You're getting this because you set a price alert in SwiftScan. <a href="${escapeHtml(unsub)}" style="color:${BRAND_LINK}">Stop this alert</a></p>
</div>`;
  return { subject, text, html };
}
async function runAlertCheck(opts) {
  const s = getStore();
  const summary = { checked: 0, notified: 0, failed: 0, skipped: 0 };
  if (!s) return summary;
  const send = opts.send || sendEmail;
  const started = Date.now();
  const budget = opts.budgetMs ?? 45e3;
  const max = opts.maxAlerts ?? 60;
  const queue = [];
  for (const email of await s.smembers(INDEX_KEY)) {
    const list = await listAlerts(email);
    if (!list.length) await s.srem(INDEX_KEY, email);
    for (const alert of list) queue.push({ email, alert });
  }
  queue.sort((a, b) => (a.alert.lastChecked || 0) - (b.alert.lastChecked || 0));
  const work = queue.slice(0, max);
  summary.skipped = queue.length - work.length;
  let next = 0;
  const worker = async () => {
    while (next < work.length) {
      if (Date.now() - started > budget) {
        summary.skipped += work.length - next;
        return;
      }
      const { email, alert } = work[next++];
      try {
        const est = await opts.estimate(alert.productName, alert.brand);
        summary.checked++;
        const updated = { ...alert, lastChecked: Date.now() };
        if (est && Number.isFinite(est.price) && est.price > 0) {
          updated.lastPrice = est.price;
          if (est.price <= alert.targetPrice) {
            if (!alert.notified) {
              await send({ to: email, ...buildAlertEmail(email, alert, est, opts.origin) });
              updated.notified = true;
              updated.notifiedAt = Date.now();
              summary.notified++;
            }
          } else {
            updated.notified = false;
          }
        }
        const current = await s.hgetall(alertsKey(email));
        const live = current[alert.id];
        if (live && live.targetPrice === alert.targetPrice) await s.hset(alertsKey(email), alert.id, updated);
      } catch (err) {
        summary.failed++;
        console.warn(`Alert check failed for ${alert.id}:`, err?.message || err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 4) }, worker));
  return summary;
}
function requireUser(req, res) {
  if (!accountsEnabled() || !getStore()) {
    res.status(503).json({ success: false, error: "Accounts aren't available yet." });
    return null;
  }
  const email = readSessionEmail(req);
  if (!email) {
    res.status(401).json({ success: false, code: "SIGN_IN_REQUIRED", error: "Sign in to use this." });
    return null;
  }
  return email;
}
var MAX_ITEMS = 150;
var MAX_ITEMS_BYTES = 9e5;
function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return null;
  const items = raw.filter((it) => it && typeof it === "object" && typeof it.id === "string" && it.scanResult && typeof it.scanResult.productName === "string").map((it) => {
    const { thumbnailUrl, ...rest } = it;
    return typeof thumbnailUrl === "string" && /^https:\/\//.test(thumbnailUrl) && thumbnailUrl.length < 500 ? { ...rest, thumbnailUrl } : rest;
  }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, MAX_ITEMS);
  while (items.length > 1 && JSON.stringify(items).length > MAX_ITEMS_BYTES) items.pop();
  return items;
}
function registerAlertRoutes(app2, estimate) {
  app2.get(["/api/items", "/api/items/"], async (req, res) => {
    const email = requireUser(req, res);
    if (!email) return;
    try {
      const items = await getStore().get(`items:${email}`) || [];
      res.json({ success: true, items });
    } catch (err) {
      console.warn("Items read error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't load your saved items." });
    }
  });
  app2.put(["/api/items", "/api/items/"], async (req, res) => {
    const email = requireUser(req, res);
    if (!email) return;
    const items = sanitizeItems(req.body?.items);
    if (!items) return res.status(400).json({ success: false, error: "Invalid items." });
    try {
      await getStore().set(`items:${email}`, items);
      res.json({ success: true, count: items.length });
    } catch (err) {
      console.warn("Items write error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't save your items." });
    }
  });
  app2.get(["/api/alerts", "/api/alerts/"], async (req, res) => {
    const email = requireUser(req, res);
    if (!email) return;
    try {
      res.json({ success: true, alerts: await listAlerts(email) });
    } catch (err) {
      console.warn("Alerts read error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't load your alerts." });
    }
  });
  app2.put(["/api/alerts", "/api/alerts/"], async (req, res) => {
    const email = requireUser(req, res);
    if (!email) return;
    const productName = clean2(String(req.body?.productName ?? "")).slice(0, 200);
    const brand = clean2(String(req.body?.brand ?? "")).slice(0, 100);
    const targetPrice = Number(req.body?.targetPrice);
    if (!productName) return res.status(400).json({ success: false, error: "Missing product name." });
    if (!Number.isFinite(targetPrice) || targetPrice <= 0 || targetPrice > 1e5) {
      return res.status(400).json({ success: false, error: "Enter a target price above $0." });
    }
    try {
      const s = getStore();
      const id = alertId(productName);
      const existing = await listAlerts(email);
      if (!existing.some((a) => a.id === id)) {
        const pro = isUnlimitedEmail(email) || proRecordActive(await s.get(`pro:${email}`));
        const cap = maxAlertsFor(pro);
        if (existing.length >= cap) {
          return res.status(403).json({
            success: false,
            code: "ALERT_LIMIT",
            error: pro ? `You can have up to ${cap} price alerts.` : `Free accounts can have up to ${cap} price alerts. Upgrade to Pro for more.`
          });
        }
      }
      const prev = existing.find((a) => a.id === id);
      const alert = {
        id,
        productName,
        brand: brand || void 0,
        targetPrice: Number(targetPrice.toFixed(2)),
        createdAt: prev?.createdAt || Date.now(),
        lastPrice: prev?.lastPrice,
        lastChecked: prev?.lastChecked,
        // changing the target re-arms the alert
        notified: prev && prev.targetPrice === Number(targetPrice.toFixed(2)) ? prev.notified : false,
        notifiedAt: prev?.notifiedAt
      };
      await s.hset(alertsKey(email), id, alert);
      await s.sadd(INDEX_KEY, email);
      res.json({ success: true, alert });
    } catch (err) {
      console.warn("Alert save error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't save the alert." });
    }
  });
  app2.post(["/api/alerts/remove", "/api/alerts/remove/"], async (req, res) => {
    const email = requireUser(req, res);
    if (!email) return;
    const productName = clean2(String(req.body?.productName ?? ""));
    if (!productName) return res.status(400).json({ success: false, error: "Missing product name." });
    try {
      await removeAlert(email, alertId(productName));
      res.json({ success: true });
    } catch (err) {
      console.warn("Alert remove error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't remove the alert." });
    }
  });
  app2.get(["/api/alerts/unsubscribe", "/api/alerts/unsubscribe/"], (req, res) => {
    const token = String(req.query.t || "");
    res.type("html");
    if (!readUnsubToken(token)) {
      return res.status(400).send(page("That link isn't valid", "This stop-alert link is invalid or expired. You can remove alerts inside SwiftScan."));
    }
    return res.send(page("Stop this price alert?", "", `<form method="POST" action="/api/alerts/unsubscribe"><input type="hidden" name="t" value="${escapeHtml(token)}"><button style="padding:10px 16px;border-radius:10px;border:0;background:${BRAND_BUTTON};color:#fff;font-weight:700">Stop alert</button></form>`));
  });
  app2.post(["/api/alerts/unsubscribe", "/api/alerts/unsubscribe/"], async (req, res) => {
    const t = readUnsubToken(String(req.body?.t || req.query.t || ""));
    res.type("html");
    if (!t || !normalizeEmail(t.email)) {
      return res.status(400).send(page("That link isn't valid", "This stop-alert link is invalid or expired. You can remove alerts inside SwiftScan."));
    }
    try {
      await removeAlert(t.email, t.id);
      return res.send(page("Alert stopped", "You won't get emails for that price alert anymore."));
    } catch {
      return res.status(500).send(page("Something went wrong", "Please try again, or remove the alert inside SwiftScan."));
    }
  });
  app2.get(["/api/cron/check-alerts", "/api/cron/check-alerts/"], async (req, res) => {
    const cronSecret = clean2(process.env.CRON_SECRET);
    if (!cronSecret) return res.status(503).json({ success: false, error: "CRON_SECRET is not configured." });
    const header = String(req.headers.authorization || "");
    if (!safeEqual(header, `Bearer ${cronSecret}`)) return res.status(401).json({ success: false, error: "Unauthorized." });
    if (!getStore()) return res.status(503).json({ success: false, error: "Database not configured." });
    try {
      const summary = await runAlertCheck({ estimate, origin: appOrigin(req) });
      console.log("Alert check:", JSON.stringify(summary));
      res.json({ success: true, ...summary });
    } catch (err) {
      console.warn("Alert cron error:", err?.message || err);
      res.status(500).json({ success: false, error: "Alert check failed." });
    }
  });
}
function page(title, body, extraHtml = "") {
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - SwiftScan</title><body style="font-family:system-ui,sans-serif;max-width:440px;margin:15vh auto;padding:0 20px"><h2>${escapeHtml(title)}</h2>${body ? `<p>${escapeHtml(body)}</p>` : ""}${extraHtml}<p><a href="/" style="color:${BRAND_LINK}">Back to SwiftScan</a></p></body>`;
}

// server.ts
dotenv.config();
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
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
app.use(express.json({
  limit: "50mb",
  // Stripe webhook signature verification needs the exact raw bytes.
  verify: (req, _res, buf) => {
    if (typeof req.originalUrl === "string" && req.originalUrl.startsWith("/api/stripe-webhook")) req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
var GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  // More free-tier models. Each has its own daily allowance, so they act as overflow;
  // an ID Google doesn't serve to this key just fails fast and is skipped.
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite"
].filter((m, i, arr) => !!m && arr.indexOf(m) === i);
var lastGeminiError = "";
var AI_BUDGET_MS = 5e4;
var SCAN_CACHE_SECONDS = 3 * 86400;
var SEARCH_GROUNDING = process.env.GEMINI_SEARCH === "1";
var AI_PER_MODEL_MS = 25e3;
async function generateWithFallback(params, opts = {}) {
  const ai = getGeminiClient();
  const deadline = opts.deadline ?? Date.now() + AI_BUDGET_MS;
  const perModelMs = opts.perModelMs ?? AI_PER_MODEL_MS;
  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    const left = deadline - Date.now();
    if (left < 3e3) {
      lastErr = lastErr || new Error("AI request ran out of time");
      break;
    }
    try {
      const abortSignal = AbortSignal.timeout(Math.min(perModelMs, left));
      const response = await ai.models.generateContent({ model, ...params, config: { ...params.config || {}, abortSignal } });
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
registerAuthRoutes(app);
registerAccountRoutes(app);
registerMonetizationRoutes(app);
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
var MEMORY_SOURCE = "SwiftScan users";
var barcodeMemoryKey = (code) => `upcmem:${code}`;
async function recallBarcode(variants) {
  const store = getStore();
  if (!store) return null;
  for (const v of variants.slice(0, 3)) {
    try {
      const hit = await store.get(barcodeMemoryKey(v));
      if (hit?.name) return { ...hit, source: MEMORY_SOURCE };
    } catch (err) {
      console.warn("Barcode memory read failed:", err?.message || err);
      return null;
    }
  }
  return null;
}
async function rememberBarcode(code, product) {
  const store = getStore();
  const name = String(product.productName || "").trim();
  if (!store || name.length < 3) return;
  await store.set(barcodeMemoryKey(code), { name, brand: product.brand, category: product.category, source: MEMORY_SOURCE }, { ex: 365 * 86400 }).catch((err) => console.warn("Barcode memory write failed:", err?.message || err));
}
async function lookupBarcode(variants) {
  const errors = [];
  const sources = [
    { label: "Open Food Facts", run: (c) => lookupOpenFactsFamily("world.openfoodfacts.org", "Open Food Facts", c) },
    { label: "Open Beauty Facts", run: (c) => lookupOpenFactsFamily("world.openbeautyfacts.org", "Open Beauty Facts", c) },
    { label: "Open Products Facts", run: (c) => lookupOpenFactsFamily("world.openproductsfacts.org", "Open Products Facts", c) },
    { label: "Open Pet Food Facts", run: (c) => lookupOpenFactsFamily("world.openpetfoodfacts.org", "Open Pet Food Facts", c) },
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
  const remembered = await recallBarcode(variants);
  if (remembered) return { product: remembered, incomplete: false, errors };
  const openFacts = await Promise.all(sources.slice(0, 4).map(runSource));
  const openHit = openFacts.find((h) => !!h);
  if (openHit) return { product: openHit, incomplete: errors.length > 0, errors };
  for (const source of sources.slice(4)) {
    const hit = await runSource(source);
    if (hit) return { product: hit, incomplete: errors.length > 0, errors };
  }
  return { product: null, incomplete: errors.length > 0, errors };
}
var WEB_LOOKUP_SOURCE = "Web search";
async function identifyBarcodeOnWeb(code, deadline) {
  if (!resolveGeminiKey().key || !SEARCH_GROUNDING) return null;
  const prompt = `Search the web for the retail product barcode (UPC/EAN/GTIN) ${code}.
Only answer with a product if you find a page (retailer, manufacturer or barcode database) that lists exactly this number ${code} for that product.
Reply with ONLY this JSON, no other text:
{"found": true or false, "name": "full product name with size/variant", "brand": "brand", "category": "short category", "evidence": "domain of the page that lists ${code}"}
If you cannot find this exact number, reply {"found": false}.`;
  try {
    const text = await generateWithFallback({ contents: prompt, config: { tools: [{ googleSearch: {} }] } }, { deadline, perModelMs: 15e3 });
    const j = extractAndParseJSON(text);
    const name = typeof j?.name === "string" ? j.name.trim() : "";
    if (j?.found !== true || name.length < 3 || !j?.evidence) return null;
    return {
      name,
      brand: typeof j.brand === "string" && j.brand.trim() ? j.brand.trim() : void 0,
      category: typeof j.category === "string" && j.category.trim() ? j.category.trim() : void 0,
      source: WEB_LOOKUP_SOURCE
    };
  } catch (err) {
    console.warn(`Web barcode lookup failed for ${code}:`, err?.message || err);
    return null;
  }
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
async function estimateCurrentPrice(productName, brand) {
  if (!resolveGeminiKey().key) throw new Error("No Gemini API key configured");
  const label = brand && !productName.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${productName}` : productName;
  const prompt = `Find the lowest typical current US retail price (new, in stock, USD) for this exact product: "${label}".
Use web search if available. Return ONLY valid JSON (no markdown):
{"lowestPrice": 24.99, "retailer": "Retailer Name", "url": "https://www.retailer.com/product", "goodPrice": 24.99}
These are estimates. If you cannot find a credible price, return {"lowestPrice": null}.`;
  let text = "";
  try {
    if (!SEARCH_GROUNDING) throw new Error("search grounding off");
    text = await generateWithFallback({ contents: prompt, config: { tools: [{ googleSearch: {} }] } });
    extractAndParseJSON(text);
  } catch {
    text = await generateWithFallback({ contents: prompt, config: { responseMimeType: "application/json" } });
  }
  const parsed = extractAndParseJSON(text);
  const price = Number(parsed?.lowestPrice ?? parsed?.goodPrice);
  if (!Number.isFinite(price) || price <= 0 || price > 1e5) return null;
  const url = typeof parsed.url === "string" && /^https?:\/\//i.test(parsed.url) ? parsed.url : void 0;
  return { price: Number(price.toFixed(2)), retailer: parsed.retailer ? String(parsed.retailer).slice(0, 60) : void 0, url };
}
registerAlertRoutes(app, estimateCurrentPrice);
app.post(["/api/scan", "/api/scan/"], scanQuota, async (req, res) => {
  const startedAt = Date.now();
  const { imageBase64, mimeType = "image/jpeg", textQuery, barcode, correctionHint, linkBarcode } = req.body || {};
  const linkCode = linkBarcode && (imageBase64 || textQuery || correctionHint) ? normalizeBarcode(String(linkBarcode)) : null;
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
      const web = await identifyBarcodeOnWeb(norm.code, startedAt + 22e3);
      if (web) {
        outcome.product = web;
        console.log(`Barcode ${norm.code} not in databases; matched by web search: ${web.name}`);
      }
    }
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
  const webMatched = groundTruth?.source === WEB_LOOKUP_SOURCE || groundTruth?.source === MEMORY_SOURCE;
  const method = correctionHint ? "correction" : hasPhoto ? "photo" : groundTruth && !webMatched ? "database" : "search";
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
    promptInstruction = `The product has ALREADY been identified from its barcode (source: ${groundTruth.source}), UPC ${normalizedCode}:
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
  const cacheKey = !hasPhoto && !correctionHint ? `scancache:v1:${normalizedCode ? "b:" + normalizedCode : "q:" + hashShort(String(textQuery || "").trim().toLowerCase(), 32)}` : null;
  const cache = cacheKey ? getStore() : null;
  if (cache && cacheKey) {
    try {
      const hit = await cache.get(cacheKey);
      if (hit?.productName) {
        if (linkCode?.ok) await rememberBarcode(linkCode.code, hit);
        return res.json({ success: true, found: true, data: hit, cached: true });
      }
    } catch (err) {
      console.warn("Scan cache read failed:", err?.message || err);
    }
  }
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
    const scanDeadline = startedAt + AI_BUDGET_MS;
    try {
      if (!SEARCH_GROUNDING) throw new Error("search grounding off");
      responseText = await generateWithFallback({
        contents: { parts },
        config: { tools: [{ googleSearch: {} }] }
      }, { deadline: Math.min(scanDeadline, Date.now() + 3e4) });
      extractAndParseJSON(responseText);
    } catch (groundedErr) {
      if (SEARCH_GROUNDING) console.warn("Grounded Gemini call failed, retrying without search:", groundedErr?.message || groundedErr);
      responseText = "";
      try {
        responseText = await generateWithFallback({
          contents: { parts },
          config: { responseMimeType: "application/json" }
        }, { deadline: scanDeadline, perModelMs: 2e4 });
      } catch (aiErr) {
        aiError = String(aiErr?.message || aiErr).slice(0, 300);
        console.warn("All Gemini models failed for scan:", aiError);
      }
    }
    if (responseText) {
      try {
        const parsed = extractAndParseJSON(responseText);
        const normalized = normalizeProductScanResult(parsed, queryTerm, identification, groundTruth);
        if (cache && cacheKey) {
          await cache.set(cacheKey, normalized, { ex: SCAN_CACHE_SECONDS }).catch((err) => console.warn("Scan cache write failed:", err?.message || err));
        }
        if (linkCode?.ok) await rememberBarcode(linkCode.code, normalized);
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
  const q = typeof query === "string" ? query.trim().toLowerCase().slice(0, 80) : "";
  if (q.length < 3) {
    return res.json({ suggestions: [] });
  }
  const store = getStore();
  const key = `suggest:v1:${hashShort(q, 32)}`;
  if (store) {
    try {
      const hit = await store.get(key);
      if (Array.isArray(hit)) return res.json({ suggestions: hit });
    } catch {
    }
  }
  try {
    const suggestionsText = await generateWithFallback({
      contents: `You are a fast product search autocomplete engine. Given the partial query "${query}", provide a JSON array of 5 popular product search strings that start with or relate to this query. Focus on consumer electronics, home goods, or apparel. Only return a JSON array of strings. Example: ["sony headphones", "sony tv 4k", "sony camera"]`,
      config: {
        responseMimeType: "application/json"
      }
    });
    try {
      const parsed = JSON.parse(suggestionsText || "[]");
      const suggestions = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").slice(0, 6) : [];
      if (store && suggestions.length) await store.set(key, suggestions, { ex: 7 * 86400 }).catch(() => {
      });
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
      "/api/local-stores",
      "/api/config",
      "/api/auth/request",
      "/api/auth/verify"
    ]
  });
});
async function startServer() {
  for (const name of ["privacy", "terms"]) {
    app.get(`/${name}`, (_req, res) => res.sendFile(path.join(process.cwd(), "public", `${name}.html`)));
  }
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
