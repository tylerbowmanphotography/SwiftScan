import React, { useState } from 'react';
import { Search, Tag } from 'lucide-react';
import { BF_PROMO, cyberMondayLabel, isPromoActive } from '../utils/blackFriday';

export interface SalePrefill {
  tag: string;
  was: string;
}

/** /black-friday: "Is this deal real?" Type the product and the tag price; SwiftScan looks it up and compares. */
export function BlackFridayLanding({ onCheck, isLoading }: { onCheck: (name: string, prefill: SalePrefill) => void; isLoading: boolean }) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [was, setWas] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isLoading) return;
    onCheck(name.trim(), { tag, was });
  };
  const input = 'mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white';
  return (
    <section aria-labelledby="bf-title" className="rounded-[2rem] bg-ink-950 text-white p-6 sm:p-10 ring-1 ring-white/10 space-y-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-pink-200">
          <Tag size={13} /> Black Friday to Cyber Monday ({cyberMondayLabel()})
        </div>
        <h1 id="bf-title" className="text-3xl sm:text-4xl font-black tracking-tight">Is this Black Friday deal real?</h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-xl">
          Type the product and the price on the tag. SwiftScan compares it, and the crossed-out "was" price, with its own price estimate, then tells you if it looks like a bargain or a fake markdown.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3 text-slate-900">
        <label className="block text-[11px] font-semibold text-slate-300">
          Product
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sony WH-1000XM5 headphones" className={input} aria-label="Product name" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[11px] font-semibold text-slate-300">
            Price on the tag
            <input inputMode="decimal" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="$0.00" className={input} />
          </label>
          <label className="block text-[11px] font-semibold text-slate-300">
            "Was" price (optional)
            <input inputMode="decimal" value={was} onChange={(e) => setWas(e.target.value)} placeholder="$0.00" className={input} />
          </label>
        </div>
        <button type="submit" disabled={isLoading || !name.trim()} className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white hover:bg-pink-700 disabled:opacity-50">
          <Search size={16} /> {isLoading ? 'Checking...' : 'Check this deal'}
        </button>
        <p className="text-[11px] text-slate-400">Based on SwiftScan's price estimates, which can be off. Not a claim about any store.</p>
      </form>
      {isPromoActive() ? (
        <p className="text-xs text-slate-300">
          On iPhone: SwiftScan Pro is {BF_PROMO.price} for the first month with code <b>{BF_PROMO.code}</b> until Dec 1.{' '}
          <a href={BF_PROMO.url} className="font-bold text-pink-300 underline">Redeem on the App Store</a>
        </p>
      ) : null}
    </section>
  );
}
