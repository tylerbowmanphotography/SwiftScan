/**
 * Client for the SwiftScan backend (the same Express API the web app uses).
 * Requests go to the live site; the session cookie (HttpOnly) is stored by the
 * native networking layer, so sign-in, saved items and quotas work like the web.
 */
import { setAffiliateConfig, type AffiliateConfig } from './affiliate';
import type { ProductScanResult, SavedScanItem } from './types';

export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://www.swiftscan.store').replace(/\/$/, '');
export const SITE_URL = API_BASE;

export interface Usage {
  isPro: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  exhausted: boolean;
}

export interface AccountUser {
  email: string;
  isPro: boolean;
}

export interface AppConfig {
  affiliate: AffiliateConfig;
  paid: { enabled: boolean; comingSoon: boolean };
  accounts?: { enabled: boolean };
  user?: AccountUser | null;
  usage: Usage;
}

export interface LocalStore {
  name: string;
  address?: string;
  reason?: string;
}

export type ScanInput =
  | { barcode: string }
  | { textQuery: string }
  | { imageBase64: string; mimeType: string }
  | { imageBase64?: string; textQuery: string; correctionHint: string };

export type ScanOutcome =
  | { kind: 'found'; data: ProductScanResult; usage?: Usage }
  | { kind: 'notFound'; barcode: string; message: string; lookupIncomplete?: boolean; usage?: Usage }
  | { kind: 'limit'; message: string; usage?: Usage }
  | { kind: 'error'; message: string; code?: string; usage?: Usage };

type Json = Record<string, any>;

async function request(path: string, init: RequestInit = {}, timeoutMs = 30000): Promise<{ ok: boolean; status: number; data: Json }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_BASE + path, {
      credentials: 'include',
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
      signal: controller.signal,
    });
    const data: Json = await res.json().catch(() => ({}));
    return { ok: res.ok && data?.success !== false, status: res.status, data };
  } catch (e: any) {
    const timedOut = e?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: { error: timedOut ? 'That took too long. Check your connection and try again.' : 'Network error. Check your connection and try again.' },
    };
  } finally {
    clearTimeout(timer);
  }
}

const post = (path: string, body: unknown, timeoutMs?: number) =>
  request(path, { method: 'POST', body: JSON.stringify(body ?? {}) }, timeoutMs);
const put = (path: string, body: unknown) => request(path, { method: 'PUT', body: JSON.stringify(body ?? {}) });

export async function loadConfig(): Promise<AppConfig | null> {
  const r = await request('/api/config');
  if (r.status !== 200 || !r.data?.usage) return null;
  setAffiliateConfig(r.data.affiliate);
  return r.data as AppConfig;
}

/** Identify a product and get its price check. Scans can take up to a minute on the server. */
export async function scan(input: ScanInput): Promise<ScanOutcome> {
  const r = await post('/api/scan', input, 75000);
  const usage: Usage | undefined = r.data?.usage;
  if (r.status === 429 && r.data?.code === 'FREE_LIMIT_REACHED') {
    return { kind: 'limit', message: r.data.error || "You've used today's free scans.", usage };
  }
  if (r.ok && r.data?.found === false) {
    return {
      kind: 'notFound',
      barcode: r.data.barcode,
      message: r.data.message || "We couldn't identify this barcode.",
      lookupIncomplete: r.data.lookupIncomplete,
      usage,
    };
  }
  if (r.ok && r.data?.data) return { kind: 'found', data: r.data.data as ProductScanResult, usage };
  return {
    kind: 'error',
    code: r.data?.code,
    message:
      r.data?.error ||
      r.data?.message ||
      (r.status === 413
        ? 'That photo is too large. Try again.'
        : r.status === 504
          ? 'The price check took too long on our server. Try again in a moment.'
          : 'Scan failed. Please try again.'),
    usage,
  };
}

export async function autocomplete(query: string): Promise<string[]> {
  const r = await post('/api/autocomplete', { query }, 10000);
  return Array.isArray(r.data?.suggestions) ? r.data.suggestions : [];
}

export async function askQuestion(p: ProductScanResult, question: string): Promise<{ answer?: string; error?: string }> {
  const r = await post(
    '/api/ask',
    { productName: p.productName, brand: p.brand, category: p.category, summary: p.summary, question },
    60000,
  );
  return r.ok && r.data?.answer ? { answer: r.data.answer } : { error: r.data?.error || "Couldn't get an answer. Try again." };
}

export async function localStores(productName: string): Promise<{ stores: LocalStore[]; error?: string }> {
  const r = await post('/api/local-stores', { productName }, 45000);
  return r.ok ? { stores: Array.isArray(r.data?.stores) ? r.data.stores : [] } : { stores: [], error: r.data?.error || "Couldn't find stores." };
}

// ---- account (email one-time code) ------------------------------------------------------

export async function requestCode(email: string) {
  const r = await post('/api/auth/request', { email });
  return { ok: r.ok, error: r.ok ? undefined : r.data?.error || 'Could not send the code.' };
}

export async function verifyCode(email: string, code: string) {
  const r = await post('/api/auth/verify', { email, code });
  return { ok: r.ok, error: r.ok ? undefined : r.data?.error || 'Could not verify the code.' };
}

export async function logout() {
  await post('/api/auth/logout', {});
}

// ---- saved items + price alerts (signed in) ----------------------------------------------

export async function fetchServerItems(): Promise<SavedScanItem[] | null> {
  const r = await request('/api/items');
  return r.ok && Array.isArray(r.data?.items) ? r.data.items : null;
}

export async function saveServerItems(items: SavedScanItem[]): Promise<boolean> {
  // Local photo files only exist on this phone, so they're not uploaded.
  const portable = items.map((i) => (i.thumbnailUrl?.startsWith('file:') ? { ...i, thumbnailUrl: undefined } : i));
  return (await put('/api/items', { items: portable })).ok;
}

export async function setPriceAlert(productName: string, brand: string, targetPrice: number) {
  const r = await put('/api/alerts', { productName, brand, targetPrice });
  return { ok: r.ok, signInRequired: r.status === 401, error: r.ok ? undefined : r.data?.error || 'Could not save the alert.' };
}

export async function removePriceAlert(productName: string) {
  await post('/api/alerts/remove', { productName });
}

export async function deleteAccount() {
  const r = await post('/api/account/delete', { confirm: true });
  return { ok: r.ok, error: r.ok ? undefined : r.data?.error || "Couldn't delete your account. Please try again." };
}
