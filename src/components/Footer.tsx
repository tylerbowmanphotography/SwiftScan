import React from 'react';
import { ScanBarcode } from 'lucide-react';
import { AffiliateConfig, hasAffiliateIds } from '../utils/affiliate';

export function Footer({ affiliate }: { affiliate: AffiliateConfig }) {
  const hasAmazon = !!affiliate.amazonTag;
  return (
    <footer className="mt-16 border-t border-slate-200/80 bg-white/60 pb-32 pt-10 dark:border-white/[0.07] dark:bg-ink-900/40 sm:pb-12">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-pink-700 text-white">
              <ScanBarcode size={19} aria-hidden />
            </span>
            <div>
              <p className="text-lg font-black leading-none tracking-tight text-slate-900 dark:text-white">
                Swift<span className="text-pink-600 dark:text-pink-400">Scan</span>
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Snap it. Know what it&rsquo;s worth.</p>
            </div>
          </div>
          <nav aria-label="Legal" className="flex gap-6 text-sm font-bold text-slate-700 dark:text-slate-200">
            <a href="/privacy" className="underline-offset-4 hover:text-pink-700 hover:underline dark:hover:text-pink-300">Privacy Policy</a>
            <a href="/terms" className="underline-offset-4 hover:text-pink-700 hover:underline dark:hover:text-pink-300">Terms of Service</a>
          </nav>
        </div>

        <div className="space-y-1.5 border-t border-slate-200/80 pt-5 text-xs leading-relaxed text-slate-600 dark:border-white/[0.07] dark:text-slate-400">
          {hasAmazon && (
            <p className="font-semibold">As an Amazon Associate I earn from qualifying purchases.</p>
          )}
          {hasAffiliateIds(affiliate) && (
            <p>
              Some links on SwiftScan are affiliate links. We may earn a commission if you buy through them, at no extra cost to you.
            </p>
          )}
          <p>
            Prices shown are AI estimates, not live store prices. Always confirm the final price at the retailer.
          </p>
          <p>Product and hero photos from Unsplash.</p>
        </div>
      </div>
    </footer>
  );
}
