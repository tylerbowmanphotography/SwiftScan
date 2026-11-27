import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Info, Loader2, Tag } from 'lucide-react';
import { DEAL_STORES, fetchDeals } from '../utils/api';
import { getAffiliateUrl, hasAffiliateIds } from '../utils/affiliate';
import { CouponSearch } from '../types';

/** /deals: browse current coupons and promo codes by store. Same web-search source and checks as the product coupon finder. */
export function DealsPage() {
  const [store, setStore] = useState<string>(DEAL_STORES[0]);
  const [data, setData] = useState<CouponSearch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Coupons and promo codes by store | SwiftScan';
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setData(null);
    fetchDeals(store)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e?.message || 'Could not load deals.'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [store]);

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  };

  return (
    <section className="space-y-5" aria-labelledby="deals-title">
      <div className="space-y-2 text-center">
        <h1 id="deals-title" className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-2">
          <Tag className="text-pink-600" /> Coupons &amp; deals
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Current promo codes and sales by store, found on the web. Not guaranteed, so check the terms before you buy.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Store">
        {DEAL_STORES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={s === store}
            onClick={() => setStore(s)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${s === store ? 'bg-pink-600 text-white' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:text-pink-700'}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="ss-card rounded-3xl p-6 space-y-3">
        {loading && (
          <p className="flex items-center justify-center gap-2 text-sm text-pink-700 dark:text-pink-300 font-medium">
            <Loader2 size={16} className="animate-spin" /> Searching the web for {store} deals…
          </p>
        )}
        {error && <p className="text-sm text-rose-700 dark:text-rose-300 font-semibold">{error}</p>}
        {data && !loading && data.coupons.length === 0 && (
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            {data.searched ? `No current ${store} coupons found. Try the searches below.` : 'Deal search is unavailable right now. Try the searches below.'}
          </p>
        )}
        {data && !loading && data.coupons.map((c, i) => (
          <div key={i} className="p-4 flex flex-col sm:flex-row justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            <div className="space-y-1 min-w-0">
              <span className="font-bold text-sm text-slate-900 dark:text-white block">{c.title}</span>
              <span className="text-xs text-slate-500 block">{c.expires ? `Ends ${c.expires} · ` : ''}Found on {c.sourceDomain}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              {c.code && (
                <button type="button" onClick={() => copy(c.code!)} aria-label={`Copy code ${c.code}`} className="px-3 py-2 border-2 border-dashed border-pink-400 text-pink-700 dark:text-pink-300 font-mono font-bold text-xs rounded-xl flex items-center gap-1.5">
                  {copied === c.code ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied === c.code ? 'Copied' : c.code}</span>
                </button>
              )}
              <a href={getAffiliateUrl(c.sourceUrl)} target="_blank" rel="noopener noreferrer sponsored" className="px-4 py-2 bg-pink-50 hover:bg-pink-100 dark:bg-pink-950 dark:hover:bg-pink-900 text-pink-700 dark:text-pink-400 font-bold text-xs rounded-xl flex items-center gap-1.5">
                <span>View deal</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        ))}
        {data && !loading && data.links.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {data.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:text-pink-700 flex items-center gap-1">
                <span>{l.label}</span>
                <ExternalLink size={11} />
              </a>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">
          Store pages:{' '}
          {DEAL_STORES.map((n, i) => (
            <span key={n}>
              {i > 0 ? ' · ' : ''}
              <a className="underline" href={`/deals/${n.toLowerCase().replace(/[^a-z]+/g, n === "Best Buy" || n === "Home Depot" ? '-' : '')}`}>{n}</a>
            </span>
          ))}
        </p>
        <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>SwiftScan does not pay cash back on these. {hasAffiliateIds() ? 'Some links may earn us a commission.' : ''}</span>
        </p>
      </div>
    </section>
  );
}
