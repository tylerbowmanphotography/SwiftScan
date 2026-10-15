import crypto from "crypto";
import type { Request, Response } from "express";

export const clean = (v: string | undefined | null): string => (v || "").trim();

/** HMAC secret. Set AUTH_SECRET in production; otherwise derived from another secret we hold. */
export function secret(): string {
  const explicit = clean(process.env.AUTH_SECRET) || clean(process.env.QUOTA_COOKIE_SECRET);
  if (explicit) return explicit;
  const base = clean(process.env.STRIPE_SECRET_KEY) || clean(process.env.GEMINI_API_KEY) ||
    clean(process.env.GoogleAIStudio) || clean(process.env.GOOGLE_API_KEY) || "swiftscan-dev-secret";
  return crypto.createHash("sha256").update("swiftscan-quota:" + base).digest("hex");
}

export const hmac = (payload: string, len = 32) =>
  crypto.createHmac("sha256", secret()).update(payload).digest("hex").slice(0, len);

export const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function setCookie(req: Request, res: Response, name: string, value: string, maxAgeSec: number) {
  const secure = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0] === "https";
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", prev ? ([] as string[]).concat(prev as any, cookie) : cookie);
}

export const clearCookie = (req: Request, res: Response, name: string) => setCookie(req, res, name, "", 0);

export function clientIp(req: Request): string {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return clean(String(req.headers["x-real-ip"] || "")) || xff || req.socket?.remoteAddress || "unknown";
}

export const hashShort = (s: string, len = 24) => crypto.createHash("sha256").update(s).digest("hex").slice(0, len);

export function appOrigin(req: Request): string {
  const configured = clean(process.env.APP_URL);
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0];
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}

export function today(): string {
  const tz = clean(process.env.QUOTA_TIMEZONE) || "America/Chicago";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const EMAIL_RE = /^[^\s@<>()"',;:]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// ---------------------------------------------------------------------------
// Email via Resend (https://resend.com). Env: RESEND_API_KEY, RESEND_FROM.
// ---------------------------------------------------------------------------

export const isEmailConfigured = () => !!clean(process.env.RESEND_API_KEY);

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const key = clean(process.env.RESEND_API_KEY);
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const from = clean(process.env.RESEND_FROM) || "SwiftScan <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}
