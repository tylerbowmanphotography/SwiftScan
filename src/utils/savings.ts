/**
 * Tally for "Is this sale real?": remembers the tag prices people typed and adds up how far below
 * SwiftScan's typical price they were. It is a tally of prices spotted, not money actually saved.
 * (A copy lives in mobile/src/lib/savings.ts; keep the two identical.)
 */
export interface SaleEntry {
  name: string;
  tag: number;
  typical: number;
  t: number;
}

export interface SavingsSummary {
  /** Products checked */
  items: number;
  /** Products whose tag price was below SwiftScan's typical price */
  below: number;
  /** Total distance below typical across those products, in dollars */
  spotted: number;
}

const MAX_ENTRIES = 200;
const key = (name: string) => name.trim().toLowerCase();

/** Newest first; checking the same product again replaces its earlier entry. */
export function recordEntry(list: SaleEntry[], entry: SaleEntry): SaleEntry[] {
  if (!entry.name.trim() || !(entry.tag > 0) || !(entry.typical > 0)) return list;
  const rest = list.filter((e) => key(e.name) !== key(entry.name));
  return [entry, ...rest].slice(0, MAX_ENTRIES);
}

export function summarize(list: SaleEntry[]): SavingsSummary {
  let below = 0;
  let spotted = 0;
  for (const e of list) {
    if (e.tag < e.typical) {
      below += 1;
      spotted += e.typical - e.tag;
    }
  }
  return { items: list.length, below, spotted: Math.round(spotted * 100) / 100 };
}

export function parseEntries(raw: string | null): SaleEntry[] {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v)
      ? v.filter((e) => e && typeof e.name === 'string' && e.tag > 0 && e.typical > 0 && typeof e.t === 'number').slice(0, MAX_ENTRIES)
      : [];
  } catch {
    return [];
  }
}
