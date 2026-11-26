import React, { useState } from 'react';
import { Tag, X } from 'lucide-react';
import { BF_PROMO, cyberMondayLabel, isBlackFridayWeek, isPromoActive } from '../utils/blackFriday';

const DISMISS_KEY = 'ss_bf_banner_dismissed';
const year = () => new Date().getFullYear();

/** Black Friday week only. Points shoppers at the sale check and the price alerts. */
export function BlackFridayBanner({ onSearch, onScan }: { onSearch: () => void; onScan: () => void }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === String(year());
    } catch {
      return false;
    }
  });
  if (hidden || !isBlackFridayWeek()) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(year()));
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="relative rounded-3xl border border-pink-200 dark:border-pink-900/40 bg-pink-50 dark:bg-pink-950/30 p-5 pr-12 text-slate-900 dark:text-white" role="region" aria-label="Black Friday">
      <button onClick={dismiss} className="absolute right-3 top-3 rounded-full p-1.5 text-slate-500 hover:bg-white/60 dark:hover:bg-white/10" aria-label="Dismiss">
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <Tag size={20} className="mt-0.5 shrink-0 text-pink-600" />
        <div className="space-y-2">
          <h2 className="text-base font-extrabold">Black Friday? Check the deal before you buy.</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
            Scan an item or search its name, then type the tag price under "Is this sale real?". SwiftScan compares the sale, and the crossed-out "was" price, with its own estimate. Tap "Watch" to get an email if the price drops by Cyber Monday ({cyberMondayLabel(year())}).
          </p>
          {isPromoActive() ? (
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
              On iPhone, SwiftScan Pro is {BF_PROMO.price} for the first month with code <b>{BF_PROMO.code}</b> until Dec 1.{' '}
              <a href={BF_PROMO.url} className="font-bold text-pink-700 dark:text-pink-300 underline">Redeem on the App Store</a>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <a href="/black-friday" className="rounded-xl border border-pink-300 dark:border-pink-800 px-4 py-2 text-xs font-bold text-pink-700 dark:text-pink-300">Is this deal real?</a>
            <button onClick={onScan} className="rounded-xl bg-pink-600 px-4 py-2 text-xs font-bold text-white hover:bg-pink-700">Scan an item</button>
            <button onClick={onSearch} className="rounded-xl border border-pink-300 dark:border-pink-800 px-4 py-2 text-xs font-bold text-pink-700 dark:text-pink-300">Search by name</button>
          </div>
        </div>
      </div>
    </div>
  );
}
