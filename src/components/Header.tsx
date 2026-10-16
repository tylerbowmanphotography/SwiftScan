import React from 'react';
import { Camera, Search, Smartphone, Monitor, History, ScanBarcode, Moon, Sun, UserRound } from 'lucide-react';

interface HeaderProps {
  onOpenScanner: () => void;
  onOpenHistory: () => void;
  onOpenSearch: () => void;
  savedCount: number;
  isIphoneFrameMode: boolean;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onToggleIphoneFrame: () => void;
  /** Shown only when accounts are available on the server. */
  onOpenAccount?: () => void;
  signedIn?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenScanner,
  onOpenHistory,
  onOpenSearch,
  savedCount,
  isIphoneFrameMode,
  onToggleIphoneFrame,
  isDarkMode,
  onToggleTheme,
  onOpenAccount,
  signedIn,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 dark:border-white/[0.07] dark:bg-ink-950/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Brand */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="group flex items-center gap-2.5"
          aria-label="SwiftScan home"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-600 to-pink-800 text-white shadow-lg shadow-pink-600/30 transition-transform group-hover:scale-105">
            <ScanBarcode size={22} aria-hidden />
          </span>
          <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Swift<span className="text-pink-600 dark:text-pink-400">Scan</span>
          </span>
        </a>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onToggleIphoneFrame}
            className={`hidden h-11 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all lg:flex ${
              isIphoneFrameMode
                ? 'border-pink-500/50 bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-200'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10'
            }`}
            title="Toggle iPhone frame preview"
          >
            {isIphoneFrameMode ? <Smartphone size={15} aria-hidden /> : <Monitor size={15} aria-hidden />}
            <span>{isIphoneFrameMode ? 'iPhone frame' : 'Web view'}</span>
          </button>

          {onOpenAccount && (
            <button
              type="button"
              onClick={onOpenAccount}
              className="ss-icon-btn"
              title={signedIn ? 'Your account' : 'Sign in'}
              aria-label={signedIn ? 'Your account' : 'Sign in'}
            >
              <UserRound size={19} className={signedIn ? 'text-pink-600 dark:text-pink-300' : ''} aria-hidden />
              {signedIn && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-ink-950" />}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            className="ss-icon-btn"
            title="Toggle light or dark theme"
            aria-label="Toggle light or dark theme"
          >
            {isDarkMode ? <Sun size={19} aria-hidden /> : <Moon size={19} aria-hidden />}
          </button>

          <button
            type="button"
            onClick={onOpenSearch}
            className="ss-icon-btn"
            title="Search products by name or model"
            aria-label="Search products by name or model"
          >
            <Search size={19} aria-hidden />
          </button>

          <button
            type="button"
            onClick={onOpenHistory}
            className="ss-icon-btn sm:w-auto sm:gap-2 sm:px-3.5"
            title="Open past scan history"
            aria-label="Open past scan history"
          >
            <History size={19} className="text-pink-600 dark:text-pink-300" aria-hidden />
            <span className="hidden text-xs font-bold sm:inline">History</span>
            {savedCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-600 px-1 text-[10px] font-extrabold text-white shadow sm:static sm:h-auto sm:min-w-0 sm:px-1.5 sm:py-0.5">
                {savedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenScanner}
            className="ss-btn-primary ml-1 hidden h-11 px-5 text-sm sm:inline-flex"
          >
            <Camera size={17} aria-hidden />
            <span>Scan</span>
          </button>
        </div>
      </div>
    </header>
  );
};
