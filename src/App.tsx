import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Search,
  Sparkles,
  AlertCircle,
  Wifi,
  Battery,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Header } from './components/Header';
import { CameraScannerModal } from './components/CameraScannerModal';
import { ProductResultView } from './components/ProductResultView';
import { ScanHistoryDrawer } from './components/ScanHistoryDrawer';
import { ManualSearchModal } from './components/ManualSearchModal';
import { UpgradeModal } from './components/UpgradeModal';
import { Footer } from './components/Footer';
import { AccountModal } from './components/AccountModal';
import { Landing } from './components/Landing';

import { ProductScanResult, SavedScanItem, SampleProductPreset, UnidentifiedBarcode } from './types';
import { SAMPLE_PRESETS } from './data/samplePresets';
import {
  validateAndOptimizeImage,
  validateSearchQuery,
  validateBarcode,
} from './utils/imageValidation';
import {
  scanFetch, loadConfig, verifyCheckout, fetchServerItems, pushServerItems, saveServerAlert, removeServerAlert,
  USAGE_EVENT, LIMIT_EVENT, AppConfig, Usage, AccountUser,
} from './utils/api';

export default function App() {
  const [isIphoneFrameMode, setIsIphoneFrameMode] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentScanResult, setCurrentScanResult] = useState<ProductScanResult | null>(null);
  const [unidentified, setUnidentified] = useState<UnidentifiedBarcode | null>(null);
  const [lastCapturedImage, setLastCapturedImage] = useState<string | undefined>(undefined);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ss_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  // Monetization state: public config (affiliate IDs, paid tier flag) and free-scan usage
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [limitModal, setLimitModal] = useState<{ message?: string; voluntary?: boolean } | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [accountModal, setAccountModal] = useState<{ reason?: string } | null>(null);
  const syncedEmail = useRef<string | null>(null);
  // The floating mobile scan button appears once the hero's own scan button has scrolled away.
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolledPastHero(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // A target price set while signed out; saved as an email alert once the user signs in.
  const pendingAlert = useRef<{ name: string; brand?: string; price: number } | null>(null);

  const refreshConfig = async () => {
    const cfg = await loadConfig();
    if (cfg) {
      setAppConfig(cfg);
      setUsage(cfg.usage);
      setUser(cfg.user || null);
    }
    return cfg;
  };

  // After signing in, finish a Stripe checkout that came back before the user was signed in.
  const finishPendingCheckout = async () => {
    const pending = sessionStorage.getItem('ss_pending_checkout');
    if (!pending) return;
    sessionStorage.removeItem('ss_pending_checkout');
    const r = await verifyCheckout(pending);
    setCheckoutNotice(r.ok ? 'SwiftScan Pro is active on your account. It follows you on any device you sign in on.' : (r.error || 'Could not confirm your payment.'));
    if (r.ok) await refreshConfig();
  };

  const handleAuthChanged = async () => {
    const cfg = await refreshConfig();
    if (cfg?.user) {
      setAccountModal(null);
      const alert = pendingAlert.current;
      pendingAlert.current = null;
      if (alert) {
        const r = await saveServerAlert(alert.name, alert.brand, alert.price);
        if (!r.ok) setErrorMessage(r.error || 'Could not save the email alert.');
      }
      await finishPendingCheckout();
    }
  };

  useEffect(() => {
    refreshConfig();
    const onUsage = (e: Event) => setUsage((e as CustomEvent).detail as Usage);
    const onLimit = (e: Event) => {
      setLimitModal({ message: (e as CustomEvent).detail?.message });
      setErrorMessage(null);
    };
    window.addEventListener(USAGE_EVENT, onUsage);
    window.addEventListener(LIMIT_EVENT, onLimit);

    // Returning from Stripe Checkout
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout) {
      const sessionId = params.get('session_id');
      window.history.replaceState({}, '', window.location.pathname);
      if (checkout === 'success' && sessionId) {
        verifyCheckout(sessionId).then((r) => {
          if (r.signInRequired) {
            sessionStorage.setItem('ss_pending_checkout', sessionId);
            setAccountModal({ reason: 'Payment received. Sign in with your email to activate Pro on your account.' });
            return;
          }
          setCheckoutNotice(r.ok ? 'Welcome to SwiftScan Pro! Scans are now unlimited.' : (r.error || 'Could not confirm your payment.'));
          if (r.ok) refreshConfig();
        });
      } else if (checkout === 'cancel') {
        setCheckoutNotice('Checkout canceled. You have not been charged.');
      }
    }
    return () => {
      window.removeEventListener(USAGE_EVENT, onUsage);
      window.removeEventListener(LIMIT_EVENT, onLimit);
    };
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    try {
      localStorage.setItem('ss_theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  };

  const [savedItems, setSavedItems] = useState<SavedScanItem[]>(() => {
    try {
      const stored = localStorage.getItem('ps_saved_scans');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ps_saved_scans', JSON.stringify(savedItems));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [savedItems]);

  // Account sync: when signed in, saved items follow the account across devices.
  useEffect(() => {
    if (!user) {
      syncedEmail.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const server = await fetchServerItems();
      if (cancelled || server === null) return;
      const previous = localStorage.getItem('ps_synced_for');
      setSavedItems((local) => {
        const localThumbs = new Map(local.map((i) => [i.scanResult.productName, i.thumbnailUrl]));
        const withThumbs = (list: SavedScanItem[]) => list.map((i) => ({ ...i, thumbnailUrl: i.thumbnailUrl || localThumbs.get(i.scanResult.productName) }));
        if (previous === user.email) return server.length === 0 && local.length > 0 ? local : withThumbs(server);
        if (previous && previous !== user.email) return withThumbs(server); // different account on this device
        // first sync for this device: union by product, newest wins
        const byName = new Map<string, SavedScanItem>();
        for (const item of [...local, ...server]) {
          const cur = byName.get(item.scanResult.productName);
          if (!cur || (item.timestamp || 0) > (cur.timestamp || 0)) byName.set(item.scanResult.productName, item);
        }
        return withThumbs([...byName.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      });
      localStorage.setItem('ps_synced_for', user.email);
      syncedEmail.current = user.email;
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  useEffect(() => {
    if (!user || syncedEmail.current !== user.email) return;
    const t = setTimeout(() => {
      // Camera thumbnails are large data: URLs; only the item data syncs.
      pushServerItems(savedItems.map(({ thumbnailUrl, ...rest }) => (thumbnailUrl && thumbnailUrl.startsWith('https://') && thumbnailUrl.length < 500 ? { ...rest, thumbnailUrl } : rest)));
    }, 1500);
    return () => clearTimeout(t);
  }, [savedItems, user?.email]);

  const addToHistory = (
    result: ProductScanResult,
    scanType: 'barcode' | 'camera' | 'search' | 'preset',
    thumbnailUrl?: string
  ) => {
    setSavedItems((prev) => {
      const existing = prev.find((item) => item.scanResult.productName === result.productName);
      const isBookmarked = existing ? existing.isBookmarked : false;
      const userNotes = existing ? existing.userNotes : undefined;
      
      const filtered = prev.filter((item) => item.scanResult.productName !== result.productName);
      
      const newItem: SavedScanItem = {
        id: 'scan_' + Date.now(),
        timestamp: Date.now(),
        thumbnailUrl: thumbnailUrl || existing?.thumbnailUrl,
        scanResult: result,
        userNotes,
        scanType,
        isBookmarked,
      };

      return [newItem, ...filtered];
    });
  };

  /**
   * Robust Image Scanner with client-side pre-validation and explicit API error propagation
   */
  const handleScanImage = async (rawBase64Data: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Client-Side Input Payload Validation & Optimization
      const optimized = await validateAndOptimizeImage(rawBase64Data);
      setLastCapturedImage(optimized.base64Data);

      // 2. Send API Request
      const res = await scanFetch({
          imageBase64: optimized.base64Data,
          mimeType: optimized.mimeType,
        });

      // 3. Response Handling with Explicit Error Details
      if (!res.ok) {
        let serverErrorMsg = '';
        try {
          const errorJson = await res.json();
          serverErrorMsg = errorJson.error || errorJson.message || '';
        } catch {
          const rawText = await res.text().catch(() => '');
          serverErrorMsg = rawText.length < 200 ? rawText : '';
        }

        if (serverErrorMsg) {
          throw new Error(`API Error (${res.status}): ${serverErrorMsg}`);
        } else if (res.status === 404) {
          throw new Error('API Error (404): The /api/scan endpoint was not found. Please verify the backend server is running.');
        } else if (res.status === 413) {
          throw new Error('API Error (413): The image payload is too large. Please select a smaller photo or lower resolution.');
        } else {
          throw new Error(`API Error (status ${res.status} ${res.statusText || 'Unknown'}): Failed to process product scan.`);
        }
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || data.message || 'API returned an invalid scan payload without product data.');
      }

      // 4. Success State
      setCurrentScanResult(data.data);
      setUnidentified(null);
      addToHistory(data.data, 'camera', optimized.base64Data);
      setIsScannerOpen(false);
    } catch (err: any) {
      console.error('Scan error:', err);
      const detailedMessage = err?.message || 'An unexpected error occurred while analyzing the product photo.';
      setErrorMessage(detailedMessage);
      setIsScannerOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Search Text with pre-validation and explicit error propagation
   */
  const handleSearchText = async (textQuery: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastCapturedImage(undefined);

    try {
      // 1. Input Payload Validation
      const cleanedQuery = validateSearchQuery(textQuery);

      // 2. Send API Request
      const res = await scanFetch({ textQuery: cleanedQuery });

      // 3. Response Handling
      if (!res.ok) {
        let serverErrorMsg = '';
        try {
          const errorJson = await res.json();
          serverErrorMsg = errorJson.error || errorJson.message || '';
        } catch {
          const rawText = await res.text().catch(() => '');
          serverErrorMsg = rawText.length < 200 ? rawText : '';
        }

        if (serverErrorMsg) {
          throw new Error(`Search API Error (${res.status}): ${serverErrorMsg}`);
        } else if (res.status === 404) {
          throw new Error('Search API Error (404): The /api/scan endpoint was not found.');
        } else {
          throw new Error(`Search API Error (status ${res.status}): Failed to search product.`);
        }
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to find product data for query.');
      }

      setCurrentScanResult(data.data);
      setUnidentified(null);
      addToHistory(data.data, 'search');
      setIsSearchOpen(false);
      setIsScannerOpen(false);
    } catch (err: any) {
      console.error('Search error:', err);
      setErrorMessage(err?.message || 'Search query could not be completed.');
      setIsSearchOpen(false);
      setIsScannerOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Barcode Scan with pre-validation and explicit error propagation
   */
  const handleScanBarcode = async (barcode: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setUnidentified(null);
    setLastCapturedImage(undefined);

    try {
      // 1. Input Validation
      const cleanCode = validateBarcode(barcode);

      // 2. Send API Request
      const res = await scanFetch({ barcode: cleanCode });

      // 3. Response Handling
      if (!res.ok) {
        let serverErrorMsg = '';
        let errorCode = '';
        try {
          const errorJson = await res.json();
          serverErrorMsg = errorJson.error || errorJson.message || '';
          errorCode = errorJson.code || '';
        } catch {
          const rawText = await res.text().catch(() => '');
          serverErrorMsg = rawText.length < 200 ? rawText : '';
        }

        if (serverErrorMsg && errorCode === 'BARCODE_MISREAD') {
          throw new Error(serverErrorMsg);
        } else if (serverErrorMsg) {
          throw new Error(`Barcode Lookup Error (${res.status}): ${serverErrorMsg}`);
        } else if (res.status === 404) {
          throw new Error('Barcode Lookup Error (404): The /api/scan endpoint was not found.');
        } else {
          throw new Error(`Barcode Lookup Error (status ${res.status}): Could not lookup code ${cleanCode}`);
        }
      }

      const data = await res.json();
      if (data.success && data.found === false) {
        // Real lookup found nothing: do NOT show a guessed product.
        setCurrentScanResult(null);
        setUnidentified({
          barcode: data.barcode || cleanCode,
          message: data.message || "We couldn't identify this barcode.",
          lookupIncomplete: !!data.lookupIncomplete,
        });
        setIsScannerOpen(false);
        return;
      }
      if (!data.success || !data.data) {
        throw new Error(data.error || `Barcode ${cleanCode} could not be resolved.`);
      }

      setCurrentScanResult(data.data);
      setUnidentified(null);
      addToHistory(data.data, 'barcode');
      setIsScannerOpen(false);
    } catch (err: any) {
      console.error('Barcode scan error:', err);
      setErrorMessage(err?.message || `Barcode ${barcode} lookup failed.`);
      setIsScannerOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetScan = async (preset: SampleProductPreset) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastCapturedImage(preset.imageUrl);

    try {
      const res = await scanFetch({ textQuery: `${preset.brand} ${preset.name}` });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Preset scan failed (status ${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to analyze product preset.');
      }

      setCurrentScanResult(data.data);
      setUnidentified(null);
      addToHistory(data.data, 'preset', preset.imageUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Preset scan failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCorrectScan = async (correctName: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const cleaned = validateSearchQuery(correctName);

      const res = await scanFetch({
          imageBase64: lastCapturedImage,
          correctionHint: cleaned,
          textQuery: cleaned,
        });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Correction update failed (status ${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to update product scan with correction.');
      }

      setCurrentScanResult(data.data);
      setUnidentified(null);
      addToHistory(data.data, 'search', lastCapturedImage);
    } catch (err: any) {
      console.error('Correction error:', err);
      setErrorMessage(err?.message || 'Failed to update item information.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCurrentScan = (notes?: string) => {
    if (!currentScanResult) return;

    setSavedItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.scanResult.productName === currentScanResult.productName
      );

      if (existingIndex >= 0) {
        return prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, isBookmarked: !item.isBookmarked, userNotes: notes || item.userNotes }
            : item
        );
      } else {
        const newItem: SavedScanItem = {
          id: 'scan_' + Date.now(),
          timestamp: Date.now(),
          thumbnailUrl: lastCapturedImage,
          scanResult: currentScanResult,
          userNotes: notes,
          scanType: 'search',
          isBookmarked: true,
        };
        return [newItem, ...prev];
      }
    });
  };

  const handleToggleBookmark = (id: string) => {
    setSavedItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isBookmarked: !item.isBookmarked } : item
      )
    );
  };

  const handleUpdateTags = (id: string, tags: string[]) => {
    setSavedItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, tags } : item
      )
    );
  };

  const handleSetTargetPrice = (id: string, targetPrice: number | undefined) => {
    const target = savedItems.find((item) => item.id === id);
    if (target) {
      if (targetPrice === undefined) {
        if (user) removeServerAlert(target.scanResult.productName);
      } else if (user) {
        saveServerAlert(target.scanResult.productName, target.scanResult.brand, targetPrice).then((r) => {
          if (!r.ok) setErrorMessage(r.error || 'Could not save the email alert.');
        });
      } else if (appConfig?.accounts?.enabled) {
        pendingAlert.current = { name: target.scanResult.productName, brand: target.scanResult.brand, price: targetPrice };
        setAccountModal({ reason: 'Sign in with your email and we will email you when this item looks like it has dropped to your target price.' });
      }
    }
    setSavedItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, targetPrice } : item
      )
    );
  };

  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  
  const activeAlerts = savedItems.filter(item => 
    item.targetPrice && item.scanResult.goodPrice <= item.targetPrice && !dismissedAlerts.has(item.id)
  );

  const isCurrentSaved = currentScanResult
    ? savedItems.some((item) => item.scanResult.productName === currentScanResult.productName && item.isBookmarked)
    : false;

  const handleDeleteSavedItem = (id: string) => {
    setSavedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllHistory = () => {
    if (window.confirm('Clear all saved product scan history?')) {
      setSavedItems([]);
    }
  };

  // Render the core app body with sleek obsidian aesthetic
  const renderAppContent = () => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-pink-600 selection:text-white">
      {/* Header */}
      <Header
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        savedCount={savedItems.length}
        isIphoneFrameMode={isIphoneFrameMode}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        onToggleIphoneFrame={() => setIsIphoneFrameMode(!isIphoneFrameMode)}
        onOpenAccount={appConfig?.accounts?.enabled ? () => setAccountModal({}) : undefined}
        signedIn={!!user}
      />

      {/* Main Container */}
      <main>
        {(checkoutNotice || (usage && !usage.isPro && usage.limit !== null) || errorMessage || unidentified || isLoading || currentScanResult) && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
            {checkoutNotice && (
              <div role="status" className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-2xl text-sm font-semibold flex items-center justify-between gap-3 shadow-soft">
                <span>{checkoutNotice}</span>
                <button type="button" onClick={() => setCheckoutNotice(null)} className="underline shrink-0">Dismiss</button>
              </div>
            )}

            {/* Free scan counter (result view only; the landing hero shows it inline) */}
            {currentScanResult && usage && !usage.isPro && usage.limit !== null && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-soft">
                <span>
                  {usage.exhausted
                    ? 'No free scans left today'
                    : `${usage.remaining} of ${usage.limit} free scans left today`}
                </span>
                <button
                  type="button"
                  onClick={() => setLimitModal({ voluntary: true })}
                  className="text-pink-700 dark:text-pink-300 font-extrabold underline"
                >
                  {appConfig?.paid.enabled ? 'Go Pro' : 'Pro coming soon'}
                </button>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && !limitModal && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl flex items-center justify-between gap-3 text-sm font-semibold shadow-soft"
              >
                <div className="flex items-center gap-2.5">
                  <AlertCircle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="font-extrabold underline shrink-0"
                >
                  Dismiss
                </button>
              </motion.div>
            )}

            {/* Barcode not found in any real database: never show a guessed product */}
            {unidentified && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-3xl space-y-3 shadow-soft"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle size={22} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">We couldn't identify this barcode</h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Barcode <span className="font-mono font-bold">{unidentified.barcode}</span> isn't in the product databases we check, so we won't guess. {unidentified.lookupIncomplete ? 'Some databases were unavailable, so trying again in a minute may help. ' : ''}Take a photo of the front of the product, or search by name.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setUnidentified(null); setIsScannerOpen(true); }}
                    className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold flex items-center gap-1.5"
                  >
                    <Camera size={15} />
                    <span>Take a photo of the product front</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUnidentified(null); setIsSearchOpen(true); }}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-pink-400 text-slate-800 dark:text-slate-100 text-sm font-bold flex items-center gap-1.5"
                  >
                    <Search size={15} />
                    <span>Search by name</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnidentified(null)}
                    className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 text-sm font-bold underline"
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}

            {/* Global Loading Overlay */}
            {isLoading && (
              <div role="status" aria-live="polite" className="ss-card p-10 sm:p-14 text-center space-y-5">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-pink-100 dark:border-pink-950" />
                  <div className="absolute inset-0 rounded-full border-4 border-pink-600 border-t-transparent animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto text-pink-600 dark:text-pink-400 animate-pulse" size={28} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Analyzing product & market pricing...</h3>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    Looking up the product and estimating prices. Estimates are not live store prices.
                  </p>
                </div>
              </div>
            )}

            {/* If product scan exists, show result view */}
            {!isLoading && currentScanResult && (
              <ProductResultView
                result={currentScanResult}
                capturedImageUrl={lastCapturedImage}
                onSaveToHistory={handleSaveCurrentScan}
                isSaved={isCurrentSaved}
                onNewScan={() => setIsScannerOpen(true)}
                onCorrectScan={handleCorrectScan}
                onOpenSearch={() => setIsSearchOpen(true)}
              />
            )}
          </div>
        )}

        {/* Landing page */}
        {!isLoading && !currentScanResult && (
          <Landing
            presets={SAMPLE_PRESETS}
            savedItems={savedItems}
            appConfig={appConfig}
            usage={usage}
            onScan={() => setIsScannerOpen(true)}
            onSearch={() => setIsSearchOpen(true)}
            onPreset={handlePresetScan}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onSelectSaved={(item) => {
              setCurrentScanResult(item.scanResult);
              setLastCapturedImage(item.thumbnailUrl);
            }}
            onOpenPro={() => setLimitModal({ voluntary: true })}
          />
        )}
      </main>

      {/* Mobile-first floating scan button */}
      {!isScannerOpen && !isSearchOpen && !isHistoryOpen && !limitModal && !accountModal && !isLoading && (currentScanResult || scrolledPastHero) && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent dark:from-slate-950 dark:via-slate-950/90 pointer-events-none">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="ss-btn-primary w-full pointer-events-auto"
          >
            <Camera size={22} />
            <span>{currentScanResult ? 'Scan another item' : 'Scan an item'}</span>
          </button>
        </div>
      )}

      <Footer affiliate={appConfig?.affiliate || {}} />

      <UpgradeModal
        open={!!limitModal}
        message={limitModal?.message}
        paidEnabled={!!appConfig?.paid.enabled}
        voluntary={!!limitModal?.voluntary}
        onClose={() => { setLimitModal(null); setErrorMessage(null); }}
        onSignInRequired={() => setAccountModal({ reason: 'Sign in with your email first so Pro follows you to any device.' })}
      />

      <AccountModal
        open={!!accountModal}
        user={user}
        paidEnabled={!!appConfig?.paid.enabled}
        reason={accountModal?.reason}
        onClose={() => setAccountModal(null)}
        onAuthChanged={handleAuthChanged}
      />

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCaptureImage={handleScanImage}
        onScanBarcode={handleScanBarcode}
        isLoading={isLoading}
      />

      {/* Manual Search Modal */}
      <ManualSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSearch={handleSearchText}
        isLoading={isLoading}
      />

      {/* Past Scan History Drawer */}
      <ScanHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        savedItems={savedItems}
        onSelectItem={(item) => {
          setCurrentScanResult(item.scanResult);
          setLastCapturedImage(item.thumbnailUrl);
        }}
        onToggleBookmark={handleToggleBookmark}
        onUpdateTags={handleUpdateTags}
        onSetTargetPrice={handleSetTargetPrice}
        onDeleteItem={handleDeleteSavedItem}
        onClearAll={handleClearAllHistory}
        alertsHint={
          user
            ? 'We check once a day and email you when the estimated price is at or below your target. Estimates, not live store prices.'
            : appConfig?.accounts?.enabled
              ? 'Sign in to get an email when the price drops. Without signing in, this only shows a banner while the app is open.'
              : undefined
        }
      />
    </div>
  );

  // If iPhone Frame mode is enabled, wrap inside a sleek iPhone device mockup
  if (isIphoneFrameMode) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-black flex flex-col items-center justify-center p-2 sm:p-6 select-none">
        <div className="relative w-full max-w-[410px] h-[850px] max-h-[92vh] bg-slate-50 dark:bg-slate-950 rounded-[55px] p-3 shadow-[0_0_100px_rgba(99,102,241,0.25)] border-4 border-slate-200 dark:border-slate-800 ring-1 ring-slate-700 overflow-hidden flex flex-col">
          {/* iPhone Dynamic Island Header */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 w-28 h-7 bg-slate-100 dark:bg-black rounded-full flex items-center justify-between px-2.5 shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-pink-950 border border-pink-700/50" />
          </div>

          {/* iPhone Top Status Bar */}
          <div className="relative z-40 px-7 pt-2 pb-1 flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <Wifi size={12} />
              <Battery size={14} className="fill-slate-300" />
            </div>
          </div>

          {/* iPhone Inner Screen Frame */}
          <div className="relative flex-1 bg-slate-50 dark:bg-slate-950 rounded-[44px] overflow-y-auto scrollbar-none">
            {renderAppContent()}
          </div>

          {/* iPhone Bottom Home Bar Indicator */}
          <div className="py-2 flex justify-center">
            <div className="w-32 h-1 bg-slate-700 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return renderAppContent();
}

