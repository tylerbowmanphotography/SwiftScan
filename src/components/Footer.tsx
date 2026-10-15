import React from 'react';
import { AffiliateConfig, hasAffiliateIds } from '../utils/affiliate';

export function Footer({ affiliate }: { affiliate: AffiliateConfig }) {
  const hasAmazon = !!affiliate.amazonTag;
  return (
    <footer className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 pt-2 text-center space-y-1">
      {hasAmazon && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
          As an Amazon Associate I earn from qualifying purchases.
        </p>
      )}
      {hasAffiliateIds(affiliate) && (
        <p className="text-[10px] text-slate-400/80">
          Some links on SwiftScan are affiliate links. We may earn a commission if you buy through them, at no extra cost to you.
        </p>
      )}
      <p className="text-[10px] text-slate-400/80">
        Prices shown are AI estimates, not live store prices. Always confirm the final price at the retailer.
      </p>
    </footer>
  );
}
