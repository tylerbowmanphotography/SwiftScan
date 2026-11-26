/**
 * Holiday gift list: items with the price the shopper plans to pay and a budget.
 * Plain data and arithmetic only. (A copy lives in mobile/src/lib/giftList.ts; keep the two identical.)
 */
export interface GiftItem {
  name: string;
  price: number;
  t: number;
}
export interface GiftList {
  budget: number;
  items: GiftItem[];
}

export const MAX_GIFTS = 60;
const key = (n: string) => n.trim().toLowerCase();
export const emptyList = (): GiftList => ({ budget: 0, items: [] });

/** Newest first; adding the same product again replaces its earlier entry. */
export function addGift(list: GiftList, item: GiftItem): GiftList {
  if (!item.name.trim() || !(item.price > 0)) return list;
  const rest = list.items.filter((g) => key(g.name) !== key(item.name));
  return { ...list, items: [item, ...rest].slice(0, MAX_GIFTS) };
}

export function removeGift(list: GiftList, name: string): GiftList {
  return { ...list, items: list.items.filter((g) => key(g.name) !== key(name)) };
}

export function setBudget(list: GiftList, budget: number): GiftList {
  return { ...list, budget: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) / 100 : 0 };
}

export function totals(list: GiftList) {
  const total = Math.round(list.items.reduce((s, g) => s + g.price, 0) * 100) / 100;
  const left = list.budget > 0 ? Math.round((list.budget - total) * 100) / 100 : null;
  return { total, count: list.items.length, left, over: left !== null && left < 0 };
}

export function parseGiftList(raw: string | null): GiftList {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return emptyList();
    const items = Array.isArray(v.items)
      ? v.items.filter((g: any) => g && typeof g.name === 'string' && g.price > 0 && typeof g.t === 'number').slice(0, MAX_GIFTS)
      : [];
    return { budget: v.budget > 0 ? Number(v.budget) : 0, items };
  } catch {
    return emptyList();
  }
}

/**
 * Share link: the list is packed into the URL fragment (#l=...), which browsers never send to a
 * server, so nothing is stored on SwiftScan's side. Only names, prices and the budget are included.
 */
export function encodeShare(list: GiftList): string {
  const compact = { b: list.budget || 0, i: list.items.slice(0, MAX_GIFTS).map((g) => [g.name.slice(0, 80), g.price]) };
  return `l=${encodeURIComponent(JSON.stringify(compact))}`;
}

export function decodeShare(fragment: string): GiftList | null {
  try {
    const m = /(?:^|[#&])l=([^&]+)/.exec(fragment);
    if (!m) return null;
    const v = JSON.parse(decodeURIComponent(m[1]));
    if (!v || !Array.isArray(v.i)) return null;
    const items: GiftItem[] = v.i
      .filter((r: any) => Array.isArray(r) && typeof r[0] === 'string' && r[0].trim() && typeof r[1] === 'number' && r[1] > 0 && r[1] < 1e7)
      .slice(0, MAX_GIFTS)
      .map((r: any) => ({ name: String(r[0]).slice(0, 80), price: Math.round(r[1] * 100) / 100, t: 0 }));
    if (!items.length) return null;
    return { budget: typeof v.b === 'number' && v.b > 0 && v.b < 1e8 ? Math.round(v.b * 100) / 100 : 0, items };
  } catch {
    return null;
  }
}
