/**
 * Purchase log for "re-check after you buy": many stores adjust a price if it drops soon after a
 * purchase, but policies vary, so the window is the shopper's own choice. Plain data and dates only.
 * (A copy lives in mobile/src/lib/purchases.ts; keep the two identical.)
 */
export interface Purchase {
  name: string;
  price: number;
  boughtAt: number;
  windowDays: number;
}

export const WINDOWS = [14, 30, 60] as const;
export const MAX_PURCHASES = 100;
const DAY = 24 * 60 * 60 * 1000;
const key = (n: string) => n.trim().toLowerCase();

export function addPurchase(list: Purchase[], p: Purchase): Purchase[] {
  if (!p.name.trim() || !(p.price > 0) || !(p.windowDays > 0)) return list;
  return [p, ...list.filter((x) => key(x.name) !== key(p.name))].slice(0, MAX_PURCHASES);
}

export const removePurchase = (list: Purchase[], name: string): Purchase[] => list.filter((x) => key(x.name) !== key(name));

/** Last day to re-check, as a timestamp. */
export const recheckBy = (p: Purchase): number => p.boughtAt + p.windowDays * DAY;

/** Whole days left in the window (0 on the last day, negative once it has closed). */
export function daysLeft(p: Purchase, now: number = Date.now()): number {
  return Math.ceil((recheckBy(p) - now) / DAY);
}

export function parsePurchases(raw: string | null): Purchase[] {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v)
      ? v.filter((p) => p && typeof p.name === 'string' && p.price > 0 && typeof p.boughtAt === 'number' && p.windowDays > 0).slice(0, MAX_PURCHASES)
      : [];
  } catch {
    return [];
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** An all-day calendar reminder two days before the window closes (or today if that has passed). */
export function icsReminder(p: Purchase, now: number = Date.now()): string {
  const when = Math.max(recheckBy(p) - 2 * DAY, now);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SwiftScan//Recheck//EN',
    'BEGIN:VEVENT',
    `UID:${p.boughtAt}-${key(p.name).replace(/[^a-z0-9]/g, '').slice(0, 24)}@swiftscan.store`,
    `DTSTAMP:${new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `DTSTART;VALUE=DATE:${ymd(when)}`,
    `SUMMARY:${esc(`Re-check the price of ${p.name}`)}`,
    `DESCRIPTION:${esc(`You paid $${p.price.toFixed(2)}. Some stores adjust the price if it drops shortly after you buy; check the store's policy. Re-check in SwiftScan: https://www.swiftscan.store`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
