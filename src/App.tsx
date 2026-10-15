import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Search,
  Sparkles,
  Zap,
  Tag,
  Bookmark,
  ShieldCheck,
  TrendingDown,
  ArrowRight,
  ScanBarcode,
  History,
  AlertCircle,
  Wifi,
  Battery,
  Smartphone,
  CheckCircle2,
  Layers,
  Store,
  DollarSign
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
import { Hero, HowItWorks, Features, ProSection, SectionHeading } from './components/Landing';

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

  const [isDarkMode, setIsDarkMode] = useState(true);
  // The floating mobile scan button only appears after the hero's own scan button has scrolled away.
  const [showScanFab, setShowScanFab] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScanFab(window.scrollY > 520);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Monetization state: public config (affiliate IDs, paid tier flag) and free-scan usage
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [limitModal, setLimitModal] = useState<{ message?: string } | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [accountModal, setAccountModal] = useState<{ reason?: string } | null>(null);
  const syncedEmail = useRef<string | null>(null);
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
    <div className="min-h-screen text-slate-900 dark:text-slate-100 font-sans selection:bg-pink-600 selection:text-white">
      {/* Header */}
      <Header
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        savedCount={savedItems.length}
        isIphoneFrameMode={isIphoneFrameMode}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onToggleIphoneFrame={() => setIsIphoneFrameMode(!isIphoneFrameMode)}
        onOpenAccount={appConfig?.accounts?.enabled ? () => setAccountModal({}) : undefined}
        signedIn={!!user}
      />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        {checkoutNotice && (
          <div role="status" className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 rounded-2xl text-sm font-semibold flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5"><CheckCircle2 size={18} className="shrink-0" aria-hidden />{checkoutNotice}</span>
            <button type="button" onClick={() => setCheckoutNotice(null)} className="underline shrink-0 font-bold">Dismiss</button>
          </div>
        )}

        {/* Free scan counter */}
        {usage && !usage.isPro && usage.limit !== null && (
          <div className="ss-card flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${usage.exhausted ? 'bg-rose-500' : 'bg-emerald-500'}`} aria-hidden />
              {usage.exhausted
                ? 'No free scans left today'
                : `${usage.remaining} of ${usage.limit} free scans left today`}
            </span>
            <button
              type="button"
              onClick={() => setLimitModal({})}
              className="text-pink-700 dark:text-pink-300 font-extrabold underline underline-offset-4"
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
            className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 rounded-2xl flex items-center justify-between gap-3 text-sm font-semibold shadow-soft"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle size={20} className="shrink-0 text-rose-500" aria-hidden />
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
            className="p-5 sm:p-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-3xl space-y-4 shadow-soft"
          >
            <div className="flex items-start gap-3">
              <AlertCircle size={24} className="shrink-0 text-amber-500 mt-0.5" aria-hidden />
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">We couldn't identify this barcode</h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  Barcode <span className="font-mono font-bold">{unidentified.barcode}</span> isn't in the product databases we check, so we won't guess. {unidentified.lookupIncomplete ? 'Some databases were unavailable, so trying again in a minute may help. ' : ''}Take a photo of the front of the product, or search by name.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => { setUnidentified(null); setIsScannerOpen(true); }}
                className="ss-btn-primary px-4 min-h-11 text-sm"
              >
                <Camera size={16} aria-hidden />
                <span>Take a photo of the product front</span>
              </button>
              <button
                type="button"
                onClick={() => { setUnidentified(null); setIsSearchOpen(true); }}
                className="ss-btn-secondary px-4 min-h-11 text-sm"
              >
                <Search size={16} aria-hidden />
                <span>Search by name</span>
              </button>
              <button
                type="button"
                onClick={() => setUnidentified(null)}
                className="px-4 min-h-11 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-bold underline"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}

        {/* Global Loading Overlay */}
        {isLoading && (
          <div role="status" aria-live="polite" className="ss-card rounded-3xl p-10 sm:p-14 text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-pink-100 dark:border-pink-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
              <Sparkles className="absolute inset-0 m-auto text-pink-600 dark:text-pink-300 animate-pulse" size={30} aria-hidden />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Analyzing product and market pricing&hellip;</h3>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                Looking up the product and estimating prices. Estimates are not live store prices.
              </p>
            </div>
          </div>
        )}

        {/* If product scan exists, show result view */}
        {!isLoading && currentScanResult ? (
          <ProductResultView
            result={currentScanResult}
            capturedImageUrl={lastCapturedImage}
            onSaveToHistory={handleSaveCurrentScan}
            isSaved={isCurrentSaved}
            onNewScan={() => setIsScannerOpen(true)}
            onCorrectScan={handleCorrectScan}
            onOpenSearch={() => setIsSearchOpen(true)}
          />
        ) : !isLoading ? (
          /* Landing: hero, how it works, samples, features, Pro */
          <div className="space-y-14 sm:space-y-20">
            <Hero onOpenScanner={() => setIsScannerOpen(true)} onOpenSearch={() => setIsSearchOpen(true)} />

            <HowItWorks />

            {/* RECENT PAST SCANS SECTION */}
            {savedItems.length > 0 && (
              <section aria-labelledby="recent-title" className="space-y-5">
                <SectionHeading
                  eyebrow="Your history"
                  title="Recent scans"
                  action={
                    <button
                      type="button"
                      onClick={() => setIsHistoryOpen(true)}
                      className="text-sm text-pink-700 dark:text-pink-300 font-extrabold hover:underline flex items-center gap-1 shrink-0 min-h-11"
                    >
                      <span>View all ({savedItems.length})</span>
                      <ArrowRight size={15} aria-hidden />
                    </button>
                  }
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedItems.slice(0, 3).map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setCurrentScanResult(item.scanResult);
                        setLastCapturedImage(item.thumbnailUrl);
                      }}
                      className="group ss-card ss-card-hover relative p-4 rounded-3xl text-left flex gap-4 items-center overflow-hidden"
                    >
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-slate-200 dark:border-white/10"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-pink-50 dark:bg-pink-500/15 text-pink-600 dark:text-pink-300 flex items-center justify-center shrink-0">
                          <Tag size={26} aria-hidden />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider block truncate">
                            {item.scanResult.brand}
                          </span>
                          {item.isBookmarked && (
                            <Bookmark size={14} className="fill-pink-500 text-pink-500 shrink-0" aria-label="Bookmarked" />
                          )}
                        </div>

                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                          {item.scanResult.productName}
                        </h3>

                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-base font-black text-pink-700 dark:text-pink-300">
                            ${item.scanResult.goodPrice}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 line-through">
                            ${item.scanResult.msrp}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* PRESET SAMPLE PRODUCTS GRID */}
            <section aria-labelledby="samples-title" className="space-y-5">
              <SectionHeading
                eyebrow="See it in action"
                title="Try a sample product"
                hint="Tap any item to see how a SwiftScan price check looks."
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
                {SAMPLE_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => handlePresetScan(preset)}
                    className="group ss-card ss-card-hover relative rounded-3xl p-2.5 sm:p-3 text-left flex flex-col overflow-hidden"
                  >
                    <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-ink-800">
                      <img
                        src={preset.imageUrl}
                        alt={preset.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-2 left-2 bg-white/90 dark:bg-ink-950/80 text-slate-800 dark:text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full backdrop-blur-md">
                        {preset.category}
                      </span>
                    </div>

                    <div className="space-y-0.5 pt-3 px-1">
                      <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                        {preset.brand}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                        {preset.name}
                      </h3>
                    </div>

                    <div className="mt-3 mx-1 mb-1 pt-3 border-t border-slate-100 dark:border-white/[0.07] flex items-center justify-between text-xs font-extrabold text-pink-700 dark:text-pink-300">
                      <span>Check the price</span>
                      <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" aria-hidden />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <Features alertsAvailable={!!appConfig?.accounts?.enabled} />

            <ProSection
              paidEnabled={!!appConfig?.paid.enabled}
              isPro={!!(usage?.isPro || user?.isPro)}
              onSignInRequired={() => setAccountModal({ reason: 'Sign in with your email first so Pro follows you to any device.' })}
            />
          </div>
        ) : null}
      </main>

      {/* Mobile scan button: always within thumb reach */}
      {showScanFab && !currentScanResult && !isScannerOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent dark:from-ink-950 dark:via-ink-950/80 sm:hidden pointer-events-none">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="ss-btn-primary pointer-events-auto min-h-[3.5rem] w-full max-w-sm text-base"
          >
            <Camera size={21} aria-hidden />
            <span>Scan an item</span>
          </button>
        </div>
      )}

      <Footer affiliate={appConfig?.affiliate || {}} />

      <UpgradeModal
        open={!!limitModal}
        message={limitModal?.message}
        paidEnabled={!!appConfig?.paid.enabled}
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

