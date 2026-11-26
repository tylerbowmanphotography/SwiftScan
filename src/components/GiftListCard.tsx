import React, { useState } from 'react';
import { Gift, X } from 'lucide-react';
import { ProductScanResult } from '../types';
import { addGift, emptyList, parseGiftList, removeGift, setBudget, totals, GiftList } from '../utils/giftList';

const STORE_KEY = 'ss_gift_list';
const fmt = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);
const toNumber = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const read = (): GiftList => {
  try {
    return parseGiftList(localStorage.getItem(STORE_KEY));
  } catch {
    return emptyList();
  }
};

/** Holiday gift list: add this product at the price you plan to pay and keep a running total against a budget. */
export function GiftListCard({ result }: { result: ProductScanResult }) {
  const [list, setList] = useState<GiftList>(read);
  const [price, setPrice] = useState('');
  const [budget, setBudgetText] = useState(() => (read().budget ? String(read().budget) : ''));
  const save = (next: GiftList) => {
    setList(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* private mode: the list lasts for this visit only */
    }
  };
  const planned = toNumber(price) || result.goodPrice || result.msrp || 0;
  const t = totals(list);
  const input = 'mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm font-bold text-slate-900 dark:text-white';
  return (
    <div className="ss-card rounded-3xl p-5 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><Gift size={15} /> Holiday gift list</h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Add this item at the price you plan to pay and keep a running total.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Price you'll pay
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={planned ? fmt(planned) : '$0.00'} className={input} />
        </label>
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Gift budget (optional)
          <input
            inputMode="decimal"
            value={budget}
            onChange={(e) => {
              setBudgetText(e.target.value);
              save(setBudget(list, toNumber(e.target.value)));
            }}
            placeholder="$0.00"
            className={input}
          />
        </label>
      </div>
      <button
        onClick={() => save(addGift(list, { name: result.productName, price: planned, t: Date.now() }))}
        disabled={!(planned > 0)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs font-bold text-white dark:text-slate-900 disabled:opacity-50"
      >
        <Gift size={14} /> Add to gift list
      </button>
      {t.count > 0 ? (
        <div className="space-y-2">
          <ul className="divide-y divide-slate-100 dark:divide-white/10 text-xs text-slate-700 dark:text-slate-200">
            {list.items.map((g) => (
              <li key={g.name} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate">{g.name}</span>
                <span className="flex items-center gap-2 font-bold shrink-0">
                  {fmt(g.price)}
                  <button onClick={() => save(removeGift(list, g.name))} aria-label={`Remove ${g.name}`} className="text-slate-400 hover:text-rose-600"><X size={14} /></button>
                </span>
              </li>
            ))}
          </ul>
          <p className={`text-xs font-bold ${t.over ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`} data-testid="gift-total">
            Total {fmt(t.total)} for {t.count} gift{t.count === 1 ? '' : 's'}
            {t.left !== null ? (t.over ? `, ${fmt(Math.abs(t.left))} over budget` : `, ${fmt(t.left)} left`) : ''}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Prices are your own or SwiftScan's estimates, not store prices.</p>
        </div>
      ) : null}
    </div>
  );
}
