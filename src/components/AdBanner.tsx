import React, { useEffect } from 'react';
import { adsenseClientId, adsenseSlotId } from '../utils/adsense';

const clientId = adsenseClientId(import.meta.env.VITE_ADSENSE_CLIENT_ID);
const slotId = adsenseSlotId(import.meta.env.VITE_ADSENSE_SLOT_ID);

export function AdBanner() {
  useEffect(() => {
    if (!clientId || !slotId) return;
    try {
      const win = window as Window & { adsbygoogle?: unknown[] };
      win.adsbygoogle = win.adsbygoogle || [];
      win.adsbygoogle.push({});
    } catch (e) {
      console.error('AdSense initialization error', e);
    }
  }, []);

  if (!clientId || !slotId) return null;

  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl my-6 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden relative min-h-[100px]">
      <div className="absolute top-2 right-3 text-[9px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 z-10">
        Advertisement
      </div>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight: '100px' }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
}
