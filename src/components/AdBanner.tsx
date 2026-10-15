import React, { useEffect } from 'react';
import { ADSENSE_CLIENT, ADSENSE_SLOT, adBannerEnabled } from '../utils/adsense';

/**
 * One AdSense banner. Renders nothing unless VITE_ADSENSE_CLIENT and VITE_ADSENSE_SLOT are set.
 * Only used at the bottom of a product result, never on the camera/scan screen.
 */
export function AdBanner() {
  const enabled = adBannerEnabled();

  useEffect(() => {
    if (!enabled) return;
    try {
      const win = window as any;
      (win.adsbygoogle = win.adsbygoogle || []).push({});
    } catch (e) {
      console.error('AdSense initialization error', e);
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside
      aria-label="Advertisement"
      className="relative my-6 flex min-h-[100px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900"
    >
      <span className="absolute right-3 top-2 z-10 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Advertisement
      </span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight: '100px' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
