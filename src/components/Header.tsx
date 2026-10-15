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

const iconBtn =
  'relative h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-pink-300 hover:text-pink-700 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-pink-700 dark:hover:text-pink-300';

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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2.5 rounded-xl"
          aria-label="SwiftScan home"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-lg shadow-pink-600/30">
            <ScanBarcode size={22} />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Swift<span className="text-pink-600 dark:text-pink-400">Scan</span>
          </span>
        </a>

        {/* Actions */}
        <nav className="flex items-center gap-2" aria-label="Main">
          <div className="hidden lg:block">
            <button
              type="button"
              onClick={onToggleIphoneFrame}
              className={`${iconBtn} w-auto gap-2 px-3 text-xs font-bold`}
              title="Toggle iPhone frame preview"
            >
              {isIphoneFrameMode ? <Smartphone size={15} /> : <Monitor size={15} />}
              <span>{isIphoneFrameMode ? 'iPhone frame' : 'Web view'}</span>
            </button>
          </div>

          <button type="button" onClick={onOpenSearch} className={iconBtn} title="Search by name or model" aria-label="Search by name or model">
            <Search size={18} />
          </button>

          <button
            type="button"
            onClick={onOpenHistory}
            className={`${iconBtn} sm:w-auto sm:gap-2 sm:px-3.5 sm:text-sm sm:font-bold`}
            title="Saved scans"
            aria-label="Saved scans"
          >
            <History size={18} />
            <span className="hidden sm:inline">History</span>
            {savedCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-600 px-1 text-[10px] font-extrabold text-white shadow sm:static sm:h-auto sm:min-w-0 sm:px-1.5 sm:py-0.5">
                {savedCount}
              </span>
            )}
          </button>

          {onOpenAccount && (
            <button
              type="button"
              onClick={onOpenAccount}
              className={iconBtn}
              title={signedIn ? 'Your account' : 'Sign in'}
              aria-label={signedIn ? 'Your account' : 'Sign in'}
            >
              <UserRound size={18} className={signedIn ? 'text-pink-600 dark:text-pink-400' : ''} />
              {signedIn && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950" />}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            className={iconBtn}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            onClick={onOpenScanner}
            className="hidden h-10 items-center gap-2 rounded-xl bg-pink-600 px-4 text-sm font-bold text-white shadow-lg shadow-pink-600/25 transition hover:bg-pink-700 active:scale-95 sm:inline-flex"
          >
            <Camera size={16} />
            <span>Scan</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
