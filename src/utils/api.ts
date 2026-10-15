import { setAffiliateConfig, AffiliateConfig } from './affiliate';

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

export const USAGE_EVENT = 'swiftscan:usage';
export const LIMIT_EVENT = 'swiftscan:limit';

/** fetch('/api/scan') that also reports quota usage / limit-reached to the app via window events. */
export async function scanFetch(body: unknown): Promise<Response> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  try {
    const data = await res.clone().json();
    if (data?.usage) window.dispatchEvent(new CustomEvent(USAGE_EVENT, { detail: data.usage }));
    if (res.status === 429 && data?.code === 'FREE_LIMIT_REACHED') {
      window.dispatchEvent(new CustomEvent(LIMIT_EVENT, { detail: { usage: data.usage, message: data.error, upgradeAvailable: !!data?.upgrade?.available } }));
    }
  } catch {
    /* non-JSON response; the caller handles it */
  }
  return res;
}

export async function loadConfig(): Promise<AppConfig | null> {
  try {
    const res = await fetch('/api/config', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const cfg = (await res.json()) as AppConfig;
    setAffiliateConfig(cfg.affiliate);
    return cfg;
  } catch {
    return null;
  }
}

export async function startCheckout(): Promise<{ url?: string; comingSoon?: boolean; signInRequired?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/checkout', { method: 'POST', credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) return { url: data.url };
    return { comingSoon: !!data.comingSoon, signInRequired: data.code === 'SIGN_IN_REQUIRED', error: data.error || 'Checkout is unavailable right now.' };
  } catch {
    return { error: 'Network error. Please try again.' };
  }
}

export async function verifyCheckout(sessionId: string): Promise<{ ok: boolean; signInRequired?: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`, { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      window.dispatchEvent(new CustomEvent(USAGE_EVENT, { detail: data.usage }));
      return { ok: true };
    }
    return { ok: false, signInRequired: data.code === 'SIGN_IN_REQUIRED', error: data.error || 'Could not confirm payment.' };
  } catch {
    return { ok: false, error: 'Network error.' };
  }
}

// ---------------------------------------------------------------------------
// Accounts, billing portal, synced items and price alerts
// ---------------------------------------------------------------------------

async function postJson(url: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data?.success !== false, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error. Please try again.' } };
  }
}

export async function requestSignInCode(email: string): Promise<{ ok: boolean; error?: string }> {
  const r = await postJson('/api/auth/request', 'POST', { email });
  return { ok: r.ok, error: r.ok ? undefined : r.data?.error || 'Could not send the code.' };
}

export async function verifySignInCode(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const r = await postJson('/api/auth/verify', 'POST', { email, code });
  return { ok: r.ok, error: r.ok ? undefined : r.data?.error || 'Could not verify the code.' };
}

export async function signOut(): Promise<void> {
  await postJson('/api/auth/logout', 'POST', {});
}

export async function openBillingPortal(): Promise<{ url?: string; error?: string }> {
  const r = await postJson('/api/billing-portal', 'POST', {});
  return r.ok && r.data?.url ? { url: r.data.url } : { error: r.data?.error || 'Could not open billing right now.' };
}

export async function fetchServerItems(): Promise<any[] | null> {
  try {
    const res = await fetch('/api/items', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : null;
  } catch {
    return null;
  }
}

export async function pushServerItems(items: unknown[]): Promise<boolean> {
  return (await postJson('/api/items', 'PUT', { items })).ok;
}

export async function saveServerAlert(productName: string, brand: string | undefined, targetPrice: number): Promise<{ ok: boolean; error?: string }> {
  const r = await postJson('/api/alerts', 'PUT', { productName, brand, targetPrice });
  return { ok: r.ok, error: r.ok ? undefined : r.data?.error || 'Could not save the alert.' };
}

export async function removeServerAlert(productName: string): Promise<void> {
  await postJson('/api/alerts/remove', 'POST', { productName });
}
