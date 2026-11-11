/**
 * Usage stats: how many people use SwiftScan, on the website and the iPhone app.
 *
 * Counted on the server, so the iPhone app (which never loads the website) is included.
 * Per day and per platform we keep: unique devices that opened SwiftScan, unique devices that
 * scanned, number of scans, and Pro purchases. Device IDs are the existing anonymous device
 * cookie, hashed again here; no emails or IPs are stored.
 */
import type { Request } from "express";
import { getStore } from "./db";
import { clean, hashShort, readCookie, today } from "./util";

export type Platform = "ios" | "web";
const TTL = 60 * 60 * 24 * 400; // keep ~13 months

/** iPhone app requests come from React Native's networking (CFNetwork), not a browser. */
export function platformOf(req: Request): Platform {
  const hint = String(req.headers["x-swiftscan-client"] || "").toLowerCase();
  if (hint === "ios") return "ios";
  if (hint === "web") return "web";
  const ua = String(req.headers["user-agent"] || "");
  return /CFNetwork|Darwin/i.test(ua) && !/Mozilla/i.test(ua) ? "ios" : "web";
}

function visitorKey(req: Request): string | null {
  const dev = readCookie(req, "ss_d");
  if (!dev) return null;
  return hashShort("stats:" + dev.split(".")[0], 16);
}

async function bump(kind: "opens" | "scans", req: Request) {
  const store = getStore();
  if (!store) return;
  const day = today();
  const p = platformOf(req);
  const who = visitorKey(req);
  const jobs: Promise<unknown>[] = [store.sadd("stats:days", day)];
  if (kind === "scans") jobs.push(store.incr(`stats:${day}:scans:${p}`, TTL));
  if (who) {
    // A hash per day keeps one entry per device; we only need the count of fields.
    jobs.push(store.hset(`stats:${day}:${kind === "opens" ? "openers" : "scanners"}:${p}`, who, 1));
  }
  await Promise.all(jobs);
}

/** Never let stats slow down or break a request. */
export function recordOpen(req: Request) {
  bump("opens", req).catch(() => {});
}
export function recordScanStat(req: Request) {
  bump("scans", req).catch(() => {});
}
export function recordPurchaseStat(source: "apple" | "stripe") {
  const store = getStore();
  if (!store) return;
  store.incr(`stats:${today()}:purchases:${source}`, TTL).catch(() => {});
}

export interface DayStats {
  day: string;
  web: { visitors: number; scanners: number; scans: number };
  ios: { visitors: number; scanners: number; scans: number };
  purchases: { apple: number; stripe: number };
}

export async function readStats(days: number): Promise<DayStats[]> {
  const store = getStore();
  if (!store) return [];
  const out: DayStats[] = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) {
    const d = new Date(now - i * 86400_000);
    const day = today(d);
    const count = async (k: string) => Object.keys((await store.hgetall(k)) || {}).length;
    const num = async (k: string) => Number((await store.get(k)) || 0);
    const [wv, ws, wn, iv, is, inn, pa, ps] = await Promise.all([
      count(`stats:${day}:openers:web`),
      count(`stats:${day}:scanners:web`),
      num(`stats:${day}:scans:web`),
      count(`stats:${day}:openers:ios`),
      count(`stats:${day}:scanners:ios`),
      num(`stats:${day}:scans:ios`),
      num(`stats:${day}:purchases:apple`),
      num(`stats:${day}:purchases:stripe`),
    ]);
    out.push({
      day,
      web: { visitors: wv, scanners: ws, scans: wn },
      ios: { visitors: iv, scanners: is, scans: inn },
      purchases: { apple: pa, stripe: ps },
    });
  }
  return out;
}

/** Signed-in emails allowed to see stats (ADMIN_EMAILS, comma separated). */
export function isAdminEmail(email: string | null): boolean {
  if (!email) return false;
  const list = clean(process.env.ADMIN_EMAILS).toLowerCase().split(/[,\s]+/).filter(Boolean);
  return list.includes(email.toLowerCase());
}
