/**
 * Push notifications for price alerts (iPhone app 1.3.0+). The app sends its Expo push token after
 * the user allows notifications; when an alert reaches its target we send a push in addition to the
 * email. Tokens belong to the signed-in account and are removed with it.
 */
import type { Express } from "express";
import { getStore } from "./db";
import { accountsEnabled } from "./monetization";
import { readSessionEmail } from "./auth";

const pushKey = (email: string) => `push:${email}`;
const TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/;
const MAX_TOKENS = 5;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function listPushTokens(email: string): Promise<string[]> {
  const s = getStore();
  if (!s) return [];
  const all = await s.hgetall<{ t: number }>(pushKey(email));
  return Object.entries(all).sort((a, b) => (b[1]?.t || 0) - (a[1]?.t || 0)).map(([token]) => token);
}

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Sends to every token the account registered. Never throws: push is a bonus on top of email. */
export async function sendPush(email: string, msg: PushMessage, fetcher: typeof fetch = fetch): Promise<number> {
  const s = getStore();
  if (!s) return 0;
  try {
    const tokens = await listPushTokens(email);
    if (!tokens.length) return 0;
    const res = await fetcher(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(tokens.map((to) => ({ to, title: msg.title, body: msg.body, data: msg.data || {}, sound: "default" }))),
    });
    if (!res.ok) return 0;
    const json: any = await res.json().catch(() => null);
    const results: any[] = Array.isArray(json?.data) ? json.data : [];
    let ok = 0;
    for (let i = 0; i < results.length; i++) {
      if (results[i]?.status === "ok") ok++;
      else if (results[i]?.details?.error === "DeviceNotRegistered") await s.hdel(pushKey(email), tokens[i]);
    }
    return ok;
  } catch (err: any) {
    console.warn("Push send failed:", err?.message || err);
    return 0;
  }
}

export function registerPushRoutes(app: Express) {
  const user = (req: any, res: any): string | null => {
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
  };

  app.post(["/api/push/register", "/api/push/register/"], async (req, res) => {
    const email = user(req, res);
    if (!email) return;
    const token = String(req.body?.token ?? "").trim();
    if (!TOKEN_RE.test(token)) return res.status(400).json({ success: false, error: "Invalid push token." });
    try {
      const s = getStore()!;
      await s.hset(pushKey(email), token, { t: Date.now() });
      const all = await listPushTokens(email);
      for (const old of all.slice(MAX_TOKENS)) await s.hdel(pushKey(email), old); // keep the newest few
      res.json({ success: true });
    } catch (err: any) {
      console.warn("Push register error:", err?.message || err);
      res.status(500).json({ success: false, error: "Couldn't save the push token." });
    }
  });

  app.post(["/api/push/unregister", "/api/push/unregister/"], async (req, res) => {
    const email = user(req, res);
    if (!email) return;
    try {
      await getStore()!.hdel(pushKey(email), String(req.body?.token ?? "").trim());
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: "Couldn't remove the push token." });
    }
  });
}
