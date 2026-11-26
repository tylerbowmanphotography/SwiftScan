import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Bell, Share2, TriangleAlert } from 'lucide-react';
import { ProductScanResult } from '../types';
import { checkSale, SaleVerdict } from '../utils/saleCheck';
import { parseEntries, recordEntry, summarize, SaleEntry } from '../utils/savings';

const STORE_KEY = 'ss_sale_checks';
const readEntries = (): SaleEntry[] => {
  try {
    return parseEntries(localStorage.getItem(STORE_KEY));
  } catch {
    return [];
  }
};
const fmt = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

const toNumber = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const TONE: Record<SaleVerdict, string> = {
  GREAT: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200',
  GOOD: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200',
  FAIR: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200',
  HIGH: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200',
  INFLATED: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200',
};

/** "Is this sale real?": type the price on the tag (and the crossed-out price) to compare with SwiftScan's estimate. */
export function SaleCheckCard({ result, onWatchPrice }: { result: ProductScanResult; onWatchPrice?: () => void }) {
  const [shared, setShared] = useState(false);
  const [tag, setTag] = useState('');
  const [was, setWas] = useState('');
  const outcome = useMemo(
    () =>
      checkSale({
        tagPrice: toNumber(tag),
        wasPrice: toNumber(was),
        msrp: result.msrp,
        goodPrice: result.goodPrice,
        greatDealPrice: result.greatDealPrice,
        averagePrice: result.historicalPriceRange?.averagePrice || 0,
        highestPrice: result.historicalPriceRange?.highestPrice || 0,
      }),
    [tag, was, result],
  );
  const good = outcome && (outcome.verdict === 'GREAT' || outcome.verdict === 'GOOD');

  const [entries, setEntries] = useState<SaleEntry[]>(readEntries);
  const typical = result.historicalPriceRange?.averagePrice || result.msrp || result.goodPrice || 0;
  const tagValue = toNumber(tag);
  // Remember the tag price once the shopper stops typing.
  useEffect(() => {
    if (!outcome || !(tagValue > 0)) return;
    const id = setTimeout(() => {
      setEntries((prev) => {
        const next = recordEntry(prev, { name: result.productName, tag: tagValue, typical, t: Date.now() });
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(next));
        } catch {
          /* private mode: keep the tally for this visit only */
        }
        return next;
      });
    }, 1500);
    return () => clearTimeout(id);
  }, [tagValue, typical, result.productName, outcome]);
  const tally = useMemo(() => summarize(entries), [entries]);

  const share = async () => {
    if (!outcome) return;
    const text = `I checked ${result.productName} with SwiftScan: "${outcome.headline}" at ${fmt(tagValue)}. ${outcome.detail}`;
    const url = 'https://www.swiftscan.store';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'SwiftScan sale check', text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      /* the share sheet was closed */
    }
  };

  return (
    <div className="ss-card rounded-3xl p-5 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Is this sale real?</h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Type the price on the tag to compare it with SwiftScan's estimate.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Price on the tag
          <input
            inputMode="decimal"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="$0.00"
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm font-bold text-slate-900 dark:text-white"
          />
        </label>
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          "Was" price (optional)
          <input
            inputMode="decimal"
            value={was}
            onChange={(e) => setWas(e.target.value)}
            placeholder="$0.00"
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm font-bold text-slate-900 dark:text-white"
          />
        </label>
      </div>
      {outcome ? (
        <div className={`rounded-2xl border p-3 text-xs leading-snug ${TONE[outcome.verdict]}`} role="status">
          <div className="flex items-center gap-2 font-extrabold text-sm">
            {good ? <BadgeCheck size={16} /> : <TriangleAlert size={16} />}
            <span>{outcome.headline}</span>
          </div>
          <p className="mt-1">{outcome.detail}</p>
          <p className="mt-1 opacity-70">Based on SwiftScan's price estimates, which can be off. Not a claim about the store.</p>
          <button onClick={share} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-current/30 px-3 py-1.5 text-[11px] font-bold">
            <Share2 size={13} />
            <span>{shared ? 'Copied' : 'Share this check'}</span>
          </button>
        </div>
      ) : null}
      {onWatchPrice ? (
        <button
          onClick={onWatchPrice}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs font-bold text-white dark:text-slate-900"
        >
          <Bell size={14} />
          <span>Watch this price (email me if it drops)</span>
        </button>
      ) : null}
      {tally.items > 0 ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400" data-testid="sale-tally">
          Your tally: {tally.items} price{tally.items === 1 ? '' : 's'} checked
          {tally.below > 0 ? `, ${tally.below} below SwiftScan's typical price (${fmt(tally.spotted)} in total)` : ''}. Prices spotted, not money saved.
        </p>
      ) : null}
    </div>
  );
}
