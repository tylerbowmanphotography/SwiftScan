/**
 * AdSense IDs come from Vite env (VITE_ADSENSE_CLIENT_ID / VITE_ADSENSE_SLOT_ID).
 * Anything that is not the expected shape is treated as unset so it cannot be
 * injected into HTML or rendered as a broken ad unit.
 */

/** Publisher ID: ca-pub- followed by digits. Empty string when unset or invalid. */
export function adsenseClientId(raw: unknown): string {
  const id = typeof raw === "string" ? raw.trim() : "";
  return /^ca-pub-\d+$/.test(id) ? id : "";
}

/** Ad unit slot: 8–12 digits. Empty string when unset, placeholder, or invalid. */
export function adsenseSlotId(raw: unknown): string {
  const id = typeof raw === "string" ? raw.trim() : "";
  return /^\d{8,12}$/.test(id) ? id : "";
}
