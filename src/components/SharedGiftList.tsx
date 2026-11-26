import React from 'react';
import { Gift } from 'lucide-react';
import { GiftList, totals } from '../utils/giftList';

const fmt = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

/** Read-only view of a gift list someone shared by link (/gifts#l=...). Nothing here is stored on the server. */
export function SharedGiftList({ list }: { list: GiftList }) {
  const t = totals(list);
  return (
    <section className="ss-card rounded-3xl p-6 sm:p-8 space-y-4" aria-labelledby="shared-gifts">
      <h1 id="shared-gifts" className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2"><Gift size={22} /> A gift list shared with you</h1>
      <ul className="divide-y divide-slate-100 dark:divide-white/10 text-sm text-slate-800 dark:text-slate-100">
        {list.items.map((g, i) => (
          <li key={`${g.name}-${i}`} className="flex items-center justify-between gap-3 py-2">
            <span>{g.name}</span>
            <span className="font-bold shrink-0">{fmt(g.price)}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm font-bold text-slate-900 dark:text-white">
        Total {fmt(t.total)} for {t.count} gift{t.count === 1 ? '' : 's'}
        {t.left !== null ? (t.over ? `, ${fmt(Math.abs(t.left))} over budget` : `, ${fmt(t.left)} left`) : ''}
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Prices are the sender's own or SwiftScan's estimates, not store prices.</p>
      <a href="/" className="inline-block rounded-xl bg-pink-600 px-4 py-2 text-xs font-bold text-white hover:bg-pink-700">Check prices with SwiftScan</a>
    </section>
  );
}
