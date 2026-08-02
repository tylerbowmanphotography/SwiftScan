import React from 'react';
import { Camera, Search, Smartphone, Monitor, History, Sparkles, ScanBarcode } from 'lucide-react';

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
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 shadow-2xl">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={onOpenScanner}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-purple-600 p-0.5 shadow-lg shadow-pink-600/25 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-pink-400">
                <ScanBarcode size={22} className="group-hover:rotate-6 transition-transform" />
              </div>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" title="AI Studio Engine Active" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg tracking-tight text-white leading-none">
                Swift<span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-rose-400 to-purple-400">Scan</span>
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-950/70 text-pink-300 border border-pink-800/60">
                <Sparkles size={10} className="text-pink-400 animate-pulse" />
                <span>AI Price Advisor</span>
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
              Instant Deal & Retail Intelligence
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Frame mode toggle (iPhone mockup view vs web view) */}
          <button
            type="button"
            onClick={onToggleIphoneFrame}
            className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition-all border ${
              isIphoneFrameMode
                ? 'bg-pink-950/80 text-pink-300 border-pink-700/80 shadow-md shadow-pink-950/50'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title="Toggle iPhone Frame Preview Mode"
          >
            {isIphoneFrameMode ? <Smartphone size={15} className="text-pink-400" /> : <Monitor size={15} className="text-slate-400" />}
            <span>{isIphoneFrameMode ? 'iPhone Frame' : 'Web View'}</span>
          </button>

          {/* Quick Search Button */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center"
            title="Search Products by Name/Model"
          >
            <Search size={18} />
          </button>

          {/* Past Scan History Drawer Button */}
          <button
            type="button"
            onClick={onOpenHistory}
            className="relative px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-2 text-xs font-extrabold"
            title="Open Past Scan History"
          >
            <History size={17} className="text-pink-400" />
            <span className="hidden sm:inline">History</span>
            {savedCount > 0 && (
              <span className="px-1.5 py-0.2 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-extrabold text-[10px] rounded-full shadow-sm">
                {savedCount}
              </span>
            )}
          </button>

          {/* Primary Scan Camera Trigger */}
          <button
            type="button"
            onClick={onOpenScanner}
            className="px-4 py-2 bg-gradient-to-r from-pink-600 via-rose-500 to-pink-500 hover:from-pink-500 hover:to-rose-600 text-white font-black text-xs rounded-xl shadow-lg shadow-pink-600/25 hover:shadow-pink-600/40 flex items-center gap-2 transition-all active:scale-95 border border-pink-400/20"
          >
            <Camera size={16} />
            <span className="hidden xs:inline">Scan Photo</span>
          </button>
        </div>
      </div>
    </header>
  );
};

