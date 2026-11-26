import React from 'react';
import { Clock } from 'lucide-react';
import { ProductScanResult } from '../types';
import { buyTiming, BuyVerdict } from '../utils/buyTiming';

const TONE: Record<BuyVerdict, string> = {
  BUY: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200',
  MID: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200',
  WAIT: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200',
  STABLE: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200',
  EARLY: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200',
};

/** "Buy now or wait?" from the price history SwiftScan has recorded for this product. */
export function BuyTimingCard({ result }: { result: ProductScanResult }) {
  const out = buyTiming({ good: result.goodPrice, checks: result.priceHistory?.checks || 0, low: result.priceHistory?.low, high: result.priceHistory?.high });
  if (!out) return null;
  return (
    <div className={`rounded-3xl border p-5 text-xs leading-snug ${TONE[out.verdict]}`} role="status" aria-label="Buy now or wait">
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <Clock size={15} />
        <span>Buy now or wait? {out.headline}</span>
      </div>
      <p className="mt-1">{out.detail}</p>
      <p className="mt-1 opacity-70">Based on SwiftScan's price estimates, which can be off. Not a prediction or a claim about the store.</p>
    </div>
  );
}
