/**
 * Passwordless email sign-in: a 6-digit one-time code sent by email (Resend), then a signed,
 * HttpOnly session cookie. Requires a database (codes + users) and RESEND_API_KEY.
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { getStore } from "./db";
import {
  clean, hmac, safeEqual, readCookie, setCookie, clearCookie, clientIp, hashShort, normalizeEmail,
  escapeHtml, isEmailConfigured, sendEmail,
} from "./util";
import { BRAND_BUTTON } from "./brand";

const SESSION_COOKIE = "ss_sess";
const SESSION_DAYS = 30;
const CODE_TTL_SEC = 10 * 60;
const MAX_CODE_ATTEMPTS = 5;

export const isAuthEnabled = () => !!getStore() && isEmailConfigured();

// ---- session cookie -------------------------------------------------------

export function createSessionToken(email: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ e: email, x: now + SESSION_DAYS * 86400_000 })).toString("base64url");
  return `${payload}.${hmac("sess." + payload, 40)}`;
}

export function readSessionEmail(req: Request): string | null {
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

export function startSession(req: Request, res: Response, email: string) {
  setCookie(req, res, SESSION_COOKIE, createSessionToken(email), SESSION_DAYS * 86400);
}

export function endSession(req: Request, res: Response) {
  clearCookie(req, res, SESSION_COOKIE);
}

// ---- users ----------------------------------------------------------------

export interface UserRecord {
  email: string;
  createdAt: number;
  stripeCustomerId?: string;
}

export async function getUser(email: string): Promise<UserRecord | null> {
  const s = getStore();
  return s ? s.get<UserRecord>(`user:${email}`) : null;
}

export async function upsertUser(email: string, patch: Partial<UserRecord> = {}): Promise<UserRecord> {
  const s = getStore();
  if (!s) throw new Error("No database configured");
  const existing = await s.get<UserRecord>(`user:${email}`);
  const next: UserRecord = { ...(existing || { email, createdAt: Date.now() }), ...patch, email };
  await s.set(`user:${email}`, next);
  return next;
}

// ---- rate limiting --------------------------------------------------------

async function rateLimited(key: string, max: number, ttlSec: number): Promise<boolean> {
  const s = getStore();
  if (!s) return false;
  return (await s.incr(key, ttlSec)) > max;
}

// ---- email ----------------------------------------------------------------

function codeEmail(code: string) {
  const subject = `Your SwiftScan sign-in code: ${code}`;
  const text = `Your SwiftScan sign-in code is ${code}. It expires in 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px"><h2 style="margin:0 0 12px">SwiftScan sign-in</h2><p>Your sign-in code is:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:8px 0;color:${BRAND_BUTTON}">${escapeHtml(code)}</p><p style="color:#555">It expires in 10 minutes. If you didn't ask for this, you can ignore this email.</p></div>`;
  return { subject, text, html };
}

// ---- routes ---------------------------------------------------------------

export function registerAuthRoutes(app: Express) {
  app.post(["/api/auth/request", "/api/auth/request/"], async (req, res) => {
    if (!isAuthEnabled()) {
      return res.status(503).json({ success: false, error: "Sign-in isn't available yet." });
    }
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ success: false, error: "Enter a valid email address." });
    const s = getStore()!;
    try {
      if (
        (await rateLimited(`rl:auth:e:${hashShort(email)}`, 5, 15 * 60)) ||
        (await rateLimited(`rl:auth:ip:${hashShort(clientIp(req))}`, 20, 60 * 60))
      ) {
        return res.status(429).json({ success: false, error: "Too many sign-in attempts. Please wait a few minutes and try again." });
      }
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      await s.set(`code:${hashShort(email, 32)}`, { h: hmac(`code.${email}.${code}`, 40), a: 0 }, { ex: CODE_TTL_SEC });
      try {
        await sendEmail({ to: email, ...codeEmail(code) });
      } catch (err: any) {
        await s.del(`code:${hashShort(email, 32)}`);
        console.warn("Sign-in email failed:", err?.message || err);
        return res.status(502).json({ success: false, error: "Couldn't send the sign-in email right now. Please try again." });
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.warn("Auth request error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
    }
  });

  app.post(["/api/auth/verify", "/api/auth/verify/"], async (req, res) => {
    if (!isAuthEnabled()) return res.status(503).json({ success: false, error: "Sign-in isn't available yet." });
    const email = normalizeEmail(req.body?.email);
    const code = clean(String(req.body?.code ?? "")).replace(/\s/g, "");
    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: "Enter the 6-digit code from your email." });
    }
    const s = getStore()!;
    try {
      const key = `code:${hashShort(email, 32)}`;
      const rec = await s.get<{ h: string; a: number }>(key);
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
    } catch (err: any) {
      console.warn("Auth verify error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
    }
  });

  app.post(["/api/auth/logout", "/api/auth/logout/"], (req, res) => {
    endSession(req, res);
    res.json({ success: true });
  });
}
