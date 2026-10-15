import { setAffiliateConfig, AffiliateConfig } from './affiliate';

export interface Usage {
  isPro: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  exhausted: boolean;
}

export interface AppConfig {
  affiliate: AffiliateConfig;
  paid: { enabled: boolean; comingSoon: boolean };
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

export async function startCheckout(): Promise<{ url?: string; comingSoon?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/checkout', { method: 'POST', credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) return { url: data.url };
    return { comingSoon: !!data.comingSoon, error: data.error || 'Checkout is unavailable right now.' };
  } catch {
    return { error: 'Network error. Please try again.' };
  }
}

export async function verifyCheckout(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`, { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      window.dispatchEvent(new CustomEvent(USAGE_EVENT, { detail: data.usage }));
      return { ok: true };
    }
    return { ok: false, error: data.error || 'Could not confirm payment.' };
  } catch {
    return { ok: false, error: 'Network error.' };
  }
}
