import React, { useState } from 'react';
import { CalendarPlus, ShoppingBag, X } from 'lucide-react';
import { ProductScanResult } from '../types';
import { addPurchase, daysLeft, icsReminder, parsePurchases, Purchase, recheckBy, removePurchase, WINDOWS } from '../utils/purchases';

const STORE_KEY = 'ss_purchases';
const fmt = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);
const toNumber = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const read = (): Purchase[] => {
  try {
    return parsePurchases(localStorage.getItem(STORE_KEY));
  } catch {
    return [];
  }
};

/** "I bought this": log the price paid and a re-check window, with a calendar reminder. */
export function PurchaseCard({ result }: { result: ProductScanResult }) {
  const [list, setList] = useState<Purchase[]>(read);
  const [price, setPrice] = useState('');
  const [windowDays, setWindowDays] = useState<number>(30);
  const save = (next: Purchase[]) => {
    setList(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* private mode: the log lasts for this visit only */
    }
  };
  const paid = toNumber(price);
  const download = (p: Purchase) => {
    const url = URL.createObjectURL(new Blob([icsReminder(p)], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recheck-price.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const input = 'mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm font-bold text-slate-900 dark:text-white';
  return (
    <div className="ss-card rounded-3xl p-5 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><ShoppingBag size={15} /> Bought it? Re-check later</h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Some stores adjust the price if it drops soon after you buy. Policies vary, so check the store's before you count on it.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Price you paid
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$0.00" className={input} />
        </label>
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Re-check window
          <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className={input}>
            {WINDOWS.map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>
      </div>
      <button
        disabled={!(paid > 0)}
        onClick={() => {
          save(addPurchase(list, { name: result.productName, price: paid, boughtAt: Date.now(), windowDays }));
          setPrice('');
        }}
        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs font-bold text-white dark:text-slate-900 disabled:opacity-50"
      >
        <ShoppingBag size={14} /> Log this purchase
      </button>
      {list.length > 0 ? (
        <ul className="divide-y divide-slate-100 dark:divide-white/10 text-xs text-slate-700 dark:text-slate-200">
          {list.map((p) => {
            const left = daysLeft(p);
            return (
              <li key={p.name} className="py-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{p.name} ({fmt(p.price)})</span>
                  <button onClick={() => save(removePurchase(list, p.name))} aria-label={`Remove ${p.name}`} className="text-slate-400 hover:text-rose-600 shrink-0"><X size={14} /></button>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className={left < 0 ? 'text-slate-500' : left <= 3 ? 'font-bold text-rose-600' : ''}>
                    {left < 0 ? 'Window closed' : `Re-check by ${new Date(recheckBy(p)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} (${left} day${left === 1 ? '' : 's'} left)`}
                  </span>
                  {left >= 0 ? (
                    <button onClick={() => download(p)} className="inline-flex items-center gap-1 font-bold text-pink-700 dark:text-pink-300"><CalendarPlus size={12} /> Add reminder</button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
