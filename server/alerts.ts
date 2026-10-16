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
import { accountsEnabled, getAffiliateConfig, proRecordActive, type ProRecord } from "./monetization";
import { readSessionEmail } from "./auth";
import { clean, hmac, safeEqual, appOrigin, hashShort, escapeHtml, sendEmail, normalizeEmail } from "./util";
import { BRAND_BUTTON, BRAND_LINK } from "./brand";

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
}): Promise<CronSummary> {
  const s = getStore();
  const summary: CronSummary = { checked: 0, notified: 0, failed: 0, skipped: 0 };
  if (!s) return summary;
  const send = opts.send || sendEmail;
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
          if (est.price <= alert.targetPrice) {
            if (!alert.notified) {
              await send({ to: email, ...buildAlertEmail(email, alert, est, opts.origin) });
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
        const pro = proRecordActive(await s.get<ProRecord>(`pro:${email}`));
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
    return res.send(page("Stop this price alert?", "", `<form method="POST" action="/api/alerts/unsubscribe"><input type="hidden" name="t" value="${escapeHtml(token)}"><button style="padding:10px 16px;border-radius:10px;border:0;background:${BRAND_BUTTON};color:#fff;font-weight:700">Stop alert</button></form>`));
  });

  app.post(["/api/alerts/unsubscribe", "/api/alerts/unsubscribe/"], async (req, res) => {
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

  // ---- cron ----
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
