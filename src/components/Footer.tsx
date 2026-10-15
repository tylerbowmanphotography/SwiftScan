import React from 'react';
import { ScanBarcode } from 'lucide-react';
import { AffiliateConfig, hasAffiliateIds } from '../utils/affiliate';

export function Footer({ affiliate }: { affiliate: AffiliateConfig }) {
  const hasAmazon = !!affiliate.amazonTag;
  return (
    <footer className="border-t border-slate-200 bg-white pb-28 pt-10 dark:border-slate-800 dark:bg-slate-950 sm:pb-12">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 text-white">
              <ScanBarcode size={18} />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Swift<span className="text-pink-600 dark:text-pink-400">Scan</span>
            </span>
          </div>
          <nav className="flex gap-5 text-sm font-semibold text-slate-600 dark:text-slate-300" aria-label="Legal">
            <a href="/privacy" className="hover:text-pink-700 dark:hover:text-pink-300">Privacy Policy</a>
            <a href="/terms" className="hover:text-pink-700 dark:hover:text-pink-300">Terms of Service</a>
          </nav>
        </div>

        <div className="space-y-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {hasAmazon && <p className="font-semibold">As an Amazon Associate I earn from qualifying purchases.</p>}
          {hasAffiliateIds(affiliate) && (
            <p>Some links on SwiftScan are affiliate links. We may earn a commission if you buy through them, at no extra cost to you.</p>
          )}
          <p>Prices shown are AI estimates, not live store prices. Always confirm the final price at the retailer.</p>
        </div>
      </div>
    </footer>
  );
}
