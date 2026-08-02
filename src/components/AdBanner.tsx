import React, { useEffect } from 'react';

export function AdBanner() {
  useEffect(() => {
    try {
      const win = window as any;
      if (win && win.adsbygoogle) {
        win.adsbygoogle.push({});
      }
    } catch (e) {
      console.error('AdSense initialization error', e);
    }
  }, []);

  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl my-6 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden relative min-h-[100px]">
      <div className="absolute top-2 right-3 text-[9px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 z-10">
        Advertisement
      </div>
      
      {/* Replace data-ad-slot with your real AdSense slot ID when you create an ad unit */}
      <ins 
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight: '100px' }}
        data-ad-client="ca-pub-4192645455774507" 
        data-ad-slot="XXXXXXXXXX"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
}
