import React from 'react';
import { Guitar, Camera, Bookmark, Search, Smartphone, Monitor } from 'lucide-react';

interface HeaderProps {
  onOpenScanner: () => void;
  onOpenHistory: () => void;
  onOpenSearch: () => void;
  savedCount: number;
  isIphoneFrameMode: boolean;
  onToggleIphoneFrame: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenScanner,
  onOpenHistory,
  onOpenSearch,
  savedCount,
  isIphoneFrameMode,
  onToggleIphoneFrame,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & App Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-pink-600 rounded-xl flex items-center justify-center shadow-md shadow-pink-600/20 overflow-hidden">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => {
              // Fallback if logo.png is not yet uploaded
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.classList.add('text-white', 'justify-center', 'items-center', 'flex');
              e.currentTarget.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-guitar"><path d="m11.5 8.5-1.5-1.5"/><path d="m13.5 10.5-1.5-1.5"/><path d="m14.5 14.5-2.5-2.5"/><path d="M15.5 13.5 14 12"/><path d="m16 9.5-2-2"/><path d="m17.5 11.5-2.5-2.5"/><path d="M21 7.5 16.5 3c-1.1-.9-3-.9-4 0l-1 1c-1.1.9-1.1 2.9 0 4l4.5 4.5c1.1.9 2.9.9 4 0l1-1c1.1-.9 1.1-2.9 0-4"/><path d="M3.5 20.5 8 16"/><path d="m6 16-1.5-1.5"/><path d="m7.5 17.5-1.5-1.5"/><path d="M9 19l-1.5-1.5"/><path d="m9.5 15.5-2-2"/><path d="M12 18l-2-2"/><path d="m13.5 16.5-2.5-2.5"/><path d="M16 11.5 11.5 7c-1.1-.9-3-.9-4 0l-3 3c-1.1.9-1.1 2.9 0 4l4.5 4.5c1.1.9 2.9.9 4 0l3-3c1.1-.9 1.1-2.9 0-4"/></svg>';
            }} />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
              Swift<span className="text-pink-600 dark:text-pink-400">Scan</span>
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Product Scan & Price Advisor
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Frame mode toggle (iPhone mockup view vs full web) */}
          <button
            type="button"
            onClick={onToggleIphoneFrame}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              isIphoneFrameMode
                ? 'bg-pink-50 text-pink-600 dark:bg-pink-950/60 dark:text-pink-400 border-pink-200 dark:border-pink-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
            title="Toggle iPhone Mockup Frame"
          >
            {isIphoneFrameMode ? <Smartphone size={15} /> : <Monitor size={15} />}
            <span>{isIphoneFrameMode ? 'iPhone Frame' : 'Web View'}</span>
          </button>

          {/* Search Button */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/60 dark:border-slate-700/60 transition-colors"
            title="Search by text/barcode"
          >
            <Search size={18} />
          </button>

          {/* Saved History Button */}
          <button
            type="button"
            onClick={onOpenHistory}
            className="relative p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/60 dark:border-slate-700/60 transition-colors"
            title="Saved Scans History"
          >
            <Bookmark size={18} />
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-600 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-md">
                {savedCount}
              </span>
            )}
          </button>

          {/* Main Scan Trigger Button */}
          <button
            type="button"
            onClick={onOpenScanner}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-pink-600/25 flex items-center gap-2 transition-all active:scale-95"
          >
            <Camera size={16} />
            <span className="hidden xs:inline">Scan Photo</span>
          </button>
        </div>
      </div>
    </header>
  );
};
