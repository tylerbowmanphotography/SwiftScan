/**
 * Single config spot for Google AdSense.
 *
 * Ads are OFF unless VITE_ADSENSE_CLIENT is set (build-time env var, e.g. in Vercel):
 *   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX      (publisher ID from your AdSense account)
 *   VITE_ADSENSE_SLOT=1234567890                     (optional: ad unit ID; needed to show a banner)
 *
 * With no client ID nothing is loaded and no ad markup is rendered.
 * Ads never appear on the camera/scan screen or the landing page; the only slot is a single
 * banner at the bottom of a product result (see AdBanner.tsx).
 */
const CLIENT_PATTERN = /^ca-pub-\d{10,20}$/;
const SLOT_PATTERN = /^\d{6,20}$/;

const rawClient = String(import.meta.env.VITE_ADSENSE_CLIENT ?? '').trim();
const rawSlot = String(import.meta.env.VITE_ADSENSE_SLOT ?? '').trim();

/** The publisher ID, or '' when AdSense is not configured (or the value is malformed). */
export const ADSENSE_CLIENT = CLIENT_PATTERN.test(rawClient) ? rawClient : '';
/** The ad unit ID for the result-page banner, or ''. */
export const ADSENSE_SLOT = SLOT_PATTERN.test(rawSlot) ? rawSlot : '';

export const adsenseEnabled = () => ADSENSE_CLIENT !== '';
export const adBannerEnabled = () => ADSENSE_CLIENT !== '' && ADSENSE_SLOT !== '';

/** Load Google's adsbygoogle.js once, only when a publisher ID is configured. */
export function loadAdSense(): void {
  if (!ADSENSE_CLIENT || typeof document === 'undefined') return;
  if (document.querySelector('script[data-adsense="true"]')) return;

  const meta = document.createElement('meta');
  meta.name = 'google-adsense-account';
  meta.content = ADSENSE_CLIENT;
  document.head.appendChild(meta);

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.adsense = 'true';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
  document.head.appendChild(script);
}
