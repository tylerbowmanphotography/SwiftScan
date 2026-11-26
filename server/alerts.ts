/**
 * Saved-item sync and real, server-side price alerts.
 *
 * Alerts live in the database. A daily Vercel cron (GET /api/cron/check-alerts, protected by
 * CRON_SECRET) re-estimates each alert's price and emails the user via Resend when the estimate
 * is at or below their target. Prices are AI/search estimates, not live store prices, and the
 * email says so.
 */
import type { Express, Request, Response } from "express";
import { getStore } from "./db";
import { accountsEnabled, getAffiliateConfig, isUnlimitedEmail, proRecordActive, type ProRecord } from "./monetization";
import { readSessionEmail } from "./auth";
import { clean, hmac, safeEqual, appOrigin, hashShort, escapeHtml, sendEmail, normalizeEmail } from "./util";
import { BRAND_BUTTON, BRAND_LINK } from "./brand";
import { sendPush, type PushMessage } from "./push";

export interface PriceEstimate {
  price: number;
  retailer?: string;
  url?: string;
}
export type PriceEstimator = (productName: string, brand?: string) => Promise<PriceEstimate | null>;

export interface Alert {
  id: string;
  productName: string;
  brand?: string;
  targetPrice: number;
  createdAt: number;
  lastPrice?: number;
  lastChecked?: number;
  notified?: boolean;
  notifiedAt?: number;
  /** Price at the start of the current week, used by the weekly price-drop email */
  baseline?: { price: number; t: number };
}

const INDEX_KEY = "alerts:index";
const alertsKey = (email: string) => `alerts:${email}`;
const alertId = (productName: string) => hashShort(productName.trim().toLowerCase(), 16);

const intEnv = (name: string, dflt: number) => {
  const raw = clean(process.env[name]);
  const n = Number(raw);
  return raw !== "" && Number.isInteger(n) && n >= 0 ? n : dflt;
};
export const maxAlertsFor = (pro: boolean) => (pro ? intEnv("ALERTS_MAX_PRO", 25) : intEnv("ALERTS_MAX_FREE", 3));

// ---------------------------------------------------------------------------
// Alert storage
// ---------------------------------------------------------------------------

export async function listAlerts(email: string): Promise<Alert[]> {
  const s = getStore();
  if (!s) return [];
  const all = await s.hgetall<Alert>(alertsKey(email));
  return Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
}

async function removeAlert(email: string, id: string) {
  const s = getStore();
  if (!s) return;
  await s.hdel(alertsKey(email), id);
  if ((await listAlerts(email)).length === 0) await s.srem(INDEX_KEY, email);
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

const money = (n: number) => `$${n.toFixed(2)}`;

function unsubToken(email: string, id: string) {
  return `${Buffer.from(JSON.stringify({ e: email, i: id })).toString("base64url")}.${hmac(`unsub.${email}.${id}`, 32)}`;
}

function readUnsubToken(token: string): { email: string; id: string } | null {
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

function amazonSearchUrl(productName: string): string {
  const tag = getAffiliateConfig().amazonTag;
  return `https://www.amazon.com/s?k=${encodeURIComponent(productName)}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`;
}

export function buildAlertEmail(email: string, alert: Alert, est: PriceEstimate, origin: string) {
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
    `You're getting this because you set a price alert in SwiftScan. Stop this alert: ${unsub}`,
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

// ---------------------------------------------------------------------------
// Cron runner
// ---------------------------------------------------------------------------

export interface CronSummary {
  checked: number;
  notified: number;
  failed: number;
  skipped: number;
}

export async function runAlertCheck(opts: {
  estimate: PriceEstimator;
  origin: string;
  maxAlerts?: number;
  budgetMs?: number;
  concurrency?: number;
  send?: typeof sendEmail;
  push?: (email: string, msg: PushMessage) => Promise<number>;
}): Promise<CronSummary> {
  const s = getStore();
  const summary: CronSummary = { checked: 0, notified: 0, failed: 0, skipped: 0 };
  if (!s) return summary;
  const send = opts.send || sendEmail;
  const push = opts.push || ((email: string, msg: PushMessage) => sendPush(email, msg));
  const started = Date.now();
  const budget = opts.budgetMs ?? 45_000;
  const max = opts.maxAlerts ?? 60;

  const queue: { email: string; alert: Alert }[] = [];
  for (const email of await s.smembers(INDEX_KEY)) {
    const list = await listAlerts(email);
    if (!list.length) await s.srem(INDEX_KEY, email);
    for (const alert of list) queue.push({ email, alert });
  }
  // Oldest-checked first so a backlog is worked through fairly across runs.
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
        const updated: Alert = { ...alert, lastChecked: Date.now() };
        if (est && Number.isFinite(est.price) && est.price > 0) {
          updated.lastPrice = est.price;
          if (!updated.baseline) updated.baseline = { price: est.price, t: Date.now() };
          if (est.price <= alert.targetPrice) {
            if (!alert.notified) {
              await send({ to: email, ...buildAlertEmail(email, alert, est, opts.origin) });
              await push(email, { title: `Price alert: ${alert.productName}`, body: `Looks to be around ${money(est.price)} (estimate), at or below your target of ${money(alert.targetPrice)}.`, data: { productName: alert.productName } });
              updated.notified = true;
              updated.notifiedAt = Date.now();
              summary.notified++;
            }
          } else {
            updated.notified = false; // price went back up: re-arm
          }
        }
        // The alert may have been removed/edited while we were checking; don't resurrect it.
        const current = await s.hgetall<Alert>(alertsKey(email));
        const live = current[alert.id];
        if (live && live.targetPrice === alert.targetPrice) await s.hset(alertsKey(email), alert.id, updated);
      } catch (err: any) {
        summary.failed++;
        console.warn(`Alert check failed for ${alert.id}:`, err?.message || err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 4) }, worker));
  return summary;
}

// ---------------------------------------------------------------------------
// Black Friday / Cyber Monday digest (one email per person who watches prices)
// ---------------------------------------------------------------------------

const ALL_ALERTS = "*";
export type DigestKind = "blackfriday" | "cybermonday";

export function buildDigestEmail(email: string, alerts: Alert[], origin: string, kind: DigestKind) {
  const unsub = `${origin}/api/alerts/unsubscribe?t=${unsubToken(email, ALL_ALERTS)}`;
  const day = kind === "blackfriday" ? "Black Friday" : "Cyber Monday";
  const rows = alerts.slice(0, 25).map((a) => {
    const last = typeof a.lastPrice === "number" && a.lastPrice > 0 ? a.lastPrice : null;
    const status = last === null ? "not checked yet" : last <= a.targetPrice ? `around ${money(last)}, at or below your target` : `around ${money(last)}, ${money(last - a.targetPrice)} above your target`;
    return { name: a.productName, target: a.targetPrice, status, link: amazonSearchUrl(a.productName) };
  });
  const subject = `${day}: your SwiftScan price watches`;
  const hasTag = !!getAffiliateConfig().amazonTag;
  const disclosure = hasTag ? "As an Amazon Associate I earn from qualifying purchases." : "";
  const text = [
    `Here is where the items you're watching stand for ${day}. Prices are AI/web-search estimates, not live store prices, so check the store before you buy.`,
    "",
    ...rows.map((r) => `- ${r.name}: ${r.status} (target ${money(r.target)}). Look it up: ${r.link}`),
    "",
    `Check a sale price any time: ${origin}/black-friday`,
    disclosure,
    "",
    `You're getting this because you set price alerts in SwiftScan. Stop all alert emails: ${unsub}`,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5">
<h2 style="margin:0 0 8px">${escapeHtml(day)}: your price watches</h2>
<p style="color:#555;font-size:13px">Prices are AI/web-search estimates, not live store prices. Check the store before you buy.</p>
<ul style="padding-left:18px">${rows.map((r) => `<li><strong>${escapeHtml(r.name)}</strong>: ${escapeHtml(r.status)} (target ${money(r.target)}). <a href="${escapeHtml(r.link)}" style="color:${BRAND_LINK}">Look it up</a></li>`).join("")}</ul>
<p><a href="${escapeHtml(origin)}/black-friday" style="display:inline-block;background:${BRAND_BUTTON};color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">Is this deal real?</a></p>
${disclosure ? `<p style="color:#777;font-size:12px">${disclosure}</p>` : ""}
<p style="color:#777;font-size:12px">You're getting this because you set price alerts in SwiftScan. <a href="${escapeHtml(unsub)}" style="color:${BRAND_LINK}">Stop all alert emails</a></p>
</div>`;
  return { subject, text, html };
}

/** Dry run by default: counts recipients and returns a sample. Only sends when `send` is true. */
export async function runDigest(opts: { origin: string; kind: DigestKind; send: boolean; sender?: typeof sendEmail }) {
  const s = getStore();
  const out = { recipients: 0, sent: 0, failed: 0, sample: null as null | { subject: string; text: string } };
  if (!s) return out;
  const sender = opts.sender || sendEmail;
  for (const email of await s.smembers(INDEX_KEY)) {
    const list = await listAlerts(email);
    if (!list.length) continue;
    out.recipients++;
    const mail = buildDigestEmail(email, list, opts.origin, opts.kind);
    if (!out.sample) out.sample = { subject: mail.subject, text: mail.text.replace(email, "you@example.com") };
    if (!opts.send) continue;
    try {
      await sender({ to: email, ...mail });
      out.sent++;
    } catch (err: any) {
      out.failed++;
      console.warn("Digest send failed:", err?.message || err);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weekly price-drop email: items whose estimate fell at least 5% since the start of the week
// ---------------------------------------------------------------------------

const WEEK_MS = 5 * 24 * 60 * 60 * 1000; // a baseline must be at least 5 days old to count
export const DROP_MIN_PCT = 5;

export interface PriceDrop {
  alert: Alert;
  from: number;
  to: number;
  pct: number;
}

export function findDrops(alerts: Alert[], now = Date.now()): PriceDrop[] {
  const out: PriceDrop[] = [];
  for (const a of alerts) {
    if (!a.baseline || !(a.lastPrice && a.lastPrice > 0) || now - a.baseline.t < WEEK_MS) continue;
    const pct = Math.round(((a.baseline.price - a.lastPrice) / a.baseline.price) * 100);
    if (pct >= DROP_MIN_PCT) out.push({ alert: a, from: a.baseline.price, to: a.lastPrice, pct });
  }
  return out.sort((x, y) => y.pct - x.pct);
}

export function buildDropsEmail(email: string, drops: PriceDrop[], origin: string) {
  const unsub = `${origin}/api/alerts/unsubscribe?t=${unsubToken(email, ALL_ALERTS)}`;
  const hasTag = !!getAffiliateConfig().amazonTag;
  const disclosure = hasTag ? "As an Amazon Associate I earn from qualifying purchases." : "";
  const n = drops.length;
  const subject = `${n} item${n === 1 ? "" : "s"} you're watching look cheaper this week`;
  const rows = drops.slice(0, 25).map((d) => ({ name: d.alert.productName, line: `was around ${money(d.from)}, now around ${money(d.to)} (about ${d.pct}% lower)`, link: amazonSearchUrl(d.alert.productName) }));
  const text = [
    "SwiftScan's estimates for these items fell this week. Prices are AI/web-search estimates, not live store prices, so check the store before you buy.",
    "",
    ...rows.map((r) => `- ${r.name}: ${r.line}. Look it up: ${r.link}`),
    disclosure,
    "",
    `You're getting this because you set price alerts in SwiftScan. Stop all alert emails: ${unsub}`,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5">
<h2 style="margin:0 0 8px">Cheaper this week</h2>
<p style="color:#555;font-size:13px">SwiftScan's estimates for these items fell this week. They are AI/web-search estimates, not live store prices. Check the store before you buy.</p>
<ul style="padding-left:18px">${rows.map((r) => `<li><strong>${escapeHtml(r.name)}</strong>: ${escapeHtml(r.line)}. <a href="${escapeHtml(r.link)}" style="color:${BRAND_LINK}">Look it up</a></li>`).join("")}</ul>
${disclosure ? `<p style="color:#777;font-size:12px">${disclosure}</p>` : ""}
<p style="color:#777;font-size:12px">You're getting this because you set price alerts in SwiftScan. <a href="${escapeHtml(unsub)}" style="color:${BRAND_LINK}">Stop all alert emails</a></p>
</div>`;
  return { subject, text, html };
}

/** Dry run by default. When sending, also starts a new week: every alert's baseline moves to its current price. */
export async function runWeeklyDrops(opts: { origin: string; send: boolean; sender?: typeof sendEmail; now?: number }) {
  const s = getStore();
  const out = { recipients: 0, sent: 0, failed: 0, sample: null as null | { subject: string; text: string } };
  if (!s) return out;
  const sender = opts.sender || sendEmail;
  const now = opts.now ?? Date.now();
  for (const email of await s.smembers(INDEX_KEY)) {
    const list = await listAlerts(email);
    const drops = findDrops(list, now);
    if (drops.length) {
      out.recipients++;
      const mail = buildDropsEmail(email, drops, opts.origin);
      if (!out.sample) out.sample = { subject: mail.subject, text: mail.text.replace(email, "you@example.com") };
      if (opts.send) {
        try {
          await sender({ to: email, ...mail });
          out.sent++;
        } catch (err: any) {
          out.failed++;
          console.warn("Weekly drops send failed:", err?.message || err);
        }
      }
    }
    if (opts.send) {
      for (const a of list) {
        if (a.baseline && a.lastPrice && now - a.baseline.t >= WEEK_MS) await s.hset(alertsKey(email), a.id, { ...a, baseline: { price: a.lastPrice, t: now } });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function requireUser(req: Request, res: Response): string | null {
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

const MAX_ITEMS = 150;
const MAX_ITEMS_BYTES = 900_000;

function sanitizeItems(raw: any): any[] | null {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .filter((it) => it && typeof it === "object" && typeof it.id === "string" && it.scanResult && typeof it.scanResult.productName === "string")
    .map((it) => {
      const { thumbnailUrl, ...rest } = it;
      // Thumbnails from the camera are big data: URLs; only keep short remote image links.
      return typeof thumbnailUrl === "string" && /^https:\/\//.test(thumbnailUrl) && thumbnailUrl.length < 500 ? { ...rest, thumbnailUrl } : rest;
    })
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, MAX_ITEMS);
  while (items.length > 1 && JSON.stringify(items).length > MAX_ITEMS_BYTES) items.pop();
  return items;
}

export function registerAlertRoutes(app: Express, estimate: PriceEstimator) {
  // ---- saved items sync ----
  app.get(["/api/items", "/api/items/"], async (req, res) => {
    const email = requireUser(req, res);
    if (!email) return;
    try {
      const items = (await getStore()!.get<any[]>(`items:${email}`)) || [];
      res.json({ success: true, items });
    } catch (err: any) {
      console.warn("Items read error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't load your saved items." });
    }
  });

  app.put(["/api/items", "/api/items/"], async (req, res) => {
    const email = requireUser(req, res);
    if (!email) return;
    const items = sanitizeItems(req.body?.items);
    if (!items) return res.status(400).json({ success: false, error: "Invalid items." });
    try {
      await getStore()!.set(`items:${email}`, items);
      res.json({ success: true, count: items.length });
    } catch (err: any) {
      console.warn("Items write error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't save your items." });
    }
  });

  // ---- alerts ----
  app.get(["/api/alerts", "/api/alerts/"], async (req, res) => {
    const email = requireUser(req, res);
    if (!email) return;
    try {
      res.json({ success: true, alerts: await listAlerts(email) });
    } catch (err: any) {
      console.warn("Alerts read error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't load your alerts." });
    }
  });

  app.put(["/api/alerts", "/api/alerts/"], async (req, res) => {
    const email = requireUser(req, res);
    if (!email) return;
    const productName = clean(String(req.body?.productName ?? "")).slice(0, 200);
    const brand = clean(String(req.body?.brand ?? "")).slice(0, 100);
    const targetPrice = Number(req.body?.targetPrice);
    if (!productName) return res.status(400).json({ success: false, error: "Missing product name." });
    if (!Number.isFinite(targetPrice) || targetPrice <= 0 || targetPrice > 100000) {
      return res.status(400).json({ success: false, error: "Enter a target price above $0." });
    }
    try {
      const s = getStore()!;
      const id = alertId(productName);
      const existing = await listAlerts(email);
      if (!existing.some((a) => a.id === id)) {
        const pro = isUnlimitedEmail(email) || proRecordActive(await s.get<ProRecord>(`pro:${email}`));
        const cap = maxAlertsFor(pro);
        if (existing.length >= cap) {
          return res.status(403).json({
            success: false,
            code: "ALERT_LIMIT",
            error: pro ? `You can have up to ${cap} price alerts.` : `Free accounts can have up to ${cap} price alerts. Upgrade to Pro for more.`,
          });
        }
      }
      const prev = existing.find((a) => a.id === id);
      const alert: Alert = {
        id,
        productName,
        brand: brand || undefined,
        targetPrice: Number(targetPrice.toFixed(2)),
        createdAt: prev?.createdAt || Date.now(),
        lastPrice: prev?.lastPrice,
        lastChecked: prev?.lastChecked,
        // changing the target re-arms the alert
        notified: prev && prev.targetPrice === Number(targetPrice.toFixed(2)) ? prev.notified : false,
        notifiedAt: prev?.notifiedAt,
        baseline: prev?.baseline,
      };
      await s.hset(alertsKey(email), id, alert);
      await s.sadd(INDEX_KEY, email);
      res.json({ success: true, alert });
    } catch (err: any) {
      console.warn("Alert save error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't save the alert." });
    }
  });

  app.post(["/api/alerts/remove", "/api/alerts/remove/"], async (req, res) => {
    const email = requireUser(req, res);
    if (!email) return;
    const productName = clean(String(req.body?.productName ?? ""));
    if (!productName) return res.status(400).json({ success: false, error: "Missing product name." });
    try {
      await removeAlert(email, alertId(productName));
      res.json({ success: true });
    } catch (err: any) {
      console.warn("Alert remove error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't remove the alert." });
    }
  });

  // "Stop this alert" link from the email (signed token; no sign-in needed). GET only shows a
  // confirm button, so mail-scanner link prefetching can't remove an alert by accident.
  app.get(["/api/alerts/unsubscribe", "/api/alerts/unsubscribe/"], (req, res) => {
    const token = String(req.query.t || "");
    res.type("html");
    if (!readUnsubToken(token)) {
      return res.status(400).send(page("That link isn't valid", "This stop-alert link is invalid or expired. You can remove alerts inside SwiftScan."));
    }
    return res.send(page(readUnsubToken(token)!.id === ALL_ALERTS ? "Stop all price alert emails?" : "Stop this price alert?", "", `<form method="POST" action="/api/alerts/unsubscribe"><input type="hidden" name="t" value="${escapeHtml(token)}"><button style="padding:10px 16px;border-radius:10px;border:0;background:${BRAND_BUTTON};color:#fff;font-weight:700">Stop alert</button></form>`));
  });

  app.post(["/api/alerts/unsubscribe", "/api/alerts/unsubscribe/"], async (req, res) => {
    const t = readUnsubToken(String(req.body?.t || req.query.t || ""));
    res.type("html");
    if (!t || !normalizeEmail(t.email)) {
      return res.status(400).send(page("That link isn't valid", "This stop-alert link is invalid or expired. You can remove alerts inside SwiftScan."));
    }
    try {
      if (t.id === ALL_ALERTS) {
        for (const a of await listAlerts(t.email)) await removeAlert(t.email, a.id);
        return res.send(page("Alerts stopped", "You won't get price alert or deal digest emails from SwiftScan anymore."));
      }
      await removeAlert(t.email, t.id);
      return res.send(page("Alert stopped", "You won't get emails for that price alert anymore."));
    } catch {
      return res.status(500).send(page("Something went wrong", "Please try again, or remove the alert inside SwiftScan."));
    }
  });

  // ---- cron ----

  // Weekly price-drop email. Dry run unless ?send=1 AND WEEKLY_DROPS_ENABLED=1; never scheduled.
  app.get(["/api/cron/weekly-drops", "/api/cron/weekly-drops/"], async (req, res) => {
    const cronSecret = clean(process.env.CRON_SECRET);
    if (!cronSecret) return res.status(503).json({ success: false, error: "CRON_SECRET is not configured." });
    if (!safeEqual(String(req.headers.authorization || ""), `Bearer ${cronSecret}`)) return res.status(401).json({ success: false, error: "Unauthorized." });
    if (!getStore()) return res.status(503).json({ success: false, error: "Database not configured." });
    const wantSend = req.query.send === "1";
    const enabled = clean(process.env.WEEKLY_DROPS_ENABLED) === "1";
    try {
      const result = await runWeeklyDrops({ origin: appOrigin(req), send: wantSend && enabled });
      res.json({ success: true, dryRun: !(wantSend && enabled), sendBlocked: wantSend && !enabled ? "Set WEEKLY_DROPS_ENABLED=1 to allow sending." : undefined, ...result });
    } catch (err: any) {
      console.warn("Weekly drops error:", err?.message || err);
      res.status(500).json({ success: false, error: "Weekly drops failed." });
    }
  });

  // Black Friday / Cyber Monday digest. Dry run unless ?send=1 AND BF_DIGEST_ENABLED=1; never scheduled.
  app.get(["/api/cron/bf-digest", "/api/cron/bf-digest/"], async (req, res) => {
    const cronSecret = clean(process.env.CRON_SECRET);
    if (!cronSecret) return res.status(503).json({ success: false, error: "CRON_SECRET is not configured." });
    if (!safeEqual(String(req.headers.authorization || ""), `Bearer ${cronSecret}`)) return res.status(401).json({ success: false, error: "Unauthorized." });
    if (!getStore()) return res.status(503).json({ success: false, error: "Database not configured." });
    const kind: DigestKind = req.query.kind === "cybermonday" ? "cybermonday" : "blackfriday";
    const wantSend = req.query.send === "1";
    const enabled = clean(process.env.BF_DIGEST_ENABLED) === "1";
    try {
      const result = await runDigest({ origin: appOrigin(req), kind, send: wantSend && enabled });
      res.json({ success: true, kind, dryRun: !(wantSend && enabled), sendBlocked: wantSend && !enabled ? "Set BF_DIGEST_ENABLED=1 to allow sending." : undefined, ...result });
    } catch (err: any) {
      console.warn("Digest error:", err?.message || err);
      res.status(500).json({ success: false, error: "Digest failed." });
    }
  });
  app.get(["/api/cron/check-alerts", "/api/cron/check-alerts/"], async (req, res) => {
    const cronSecret = clean(process.env.CRON_SECRET);
    if (!cronSecret) return res.status(503).json({ success: false, error: "CRON_SECRET is not configured." });
    const header = String(req.headers.authorization || "");
    if (!safeEqual(header, `Bearer ${cronSecret}`)) return res.status(401).json({ success: false, error: "Unauthorized." });
    if (!getStore()) return res.status(503).json({ success: false, error: "Database not configured." });
    try {
      const summary = await runAlertCheck({ estimate, origin: appOrigin(req) });
      console.log("Alert check:", JSON.stringify(summary));
      res.json({ success: true, ...summary });
    } catch (err: any) {
      console.warn("Alert cron error:", err?.message || err);
      res.status(500).json({ success: false, error: "Alert check failed." });
    }
  });
}

function page(title: string, body: string, extraHtml = ""): string {
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - SwiftScan</title><body style="font-family:system-ui,sans-serif;max-width:440px;margin:15vh auto;padding:0 20px"><h2>${escapeHtml(title)}</h2>${body ? `<p>${escapeHtml(body)}</p>` : ""}${extraHtml}<p><a href="/" style="color:${BRAND_LINK}">Back to SwiftScan</a></p></body>`;
}
