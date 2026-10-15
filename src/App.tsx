import React, { useState, useEffect } from 'react';
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

import { ProductScanResult, SavedScanItem, SampleProductPreset, UnidentifiedBarcode } from './types';
import { SAMPLE_PRESETS } from './data/samplePresets';
import {
  validateAndOptimizeImage,
  validateSearchQuery,
  validateBarcode,
} from './utils/imageValidation';
import { scanFetch, loadConfig, verifyCheckout, USAGE_EVENT, LIMIT_EVENT, AppConfig, Usage } from './utils/api';

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

  // Monetization state: public config (affiliate IDs, paid tier flag) and free-scan usage
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [limitModal, setLimitModal] = useState<{ message?: string } | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  useEffect(() => {
    loadConfig().then((cfg) => {
      if (cfg) {
        setAppConfig(cfg);
        setUsage(cfg.usage);
      }
    });
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
        verifyCheckout(sessionId).then((r) =>
          setCheckoutNotice(r.ok ? 'Welcome to SwiftScan Pro! Scans are now unlimited on this device.' : (r.error || 'Could not confirm your payment.'))
        );
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
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onToggleIphoneFrame={() => setIsIphoneFrameMode(!isIphoneFrameMode)}
      />

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {checkoutNotice && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-between gap-3">
            <span>{checkoutNotice}</span>
            <button type="button" onClick={() => setCheckoutNotice(null)} className="underline shrink-0">Dismiss</button>
          </div>
        )}

        {/* Free scan counter */}
        {usage && !usage.isPro && usage.limit !== null && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <span>
              {usage.exhausted
                ? 'No free scans left today'
                : `${usage.remaining} of ${usage.limit} free scans left today`}
            </span>
            <button
              type="button"
              onClick={() => setLimitModal({})}
              className="text-pink-500 font-extrabold underline"
            >
              {appConfig?.paid.enabled ? 'Go Pro' : 'Pro coming soon'}
            </button>
          </div>
        )}
        {/* Error Banner */}
        {errorMessage && !limitModal && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-rose-950/80 border border-rose-800/80 text-rose-300 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold shadow-xl"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="font-extrabold underline shrink-0 hover:text-slate-900 dark:hover:text-white transition-colors"
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
            className="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-3xl space-y-3 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="shrink-0 text-amber-500 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">We couldn't identify this barcode</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Barcode <span className="font-mono font-bold">{unidentified.barcode}</span> isn't in the product databases we check, so we won't guess. {unidentified.lookupIncomplete ? 'Some databases were unavailable, so trying again in a minute may help. ' : ''}Take a photo of the front of the product, or search by name.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setUnidentified(null); setIsScannerOpen(true); }}
                className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Camera size={14} />
                <span>Take a photo of the product front</span>
              </button>
              <button
                type="button"
                onClick={() => { setUnidentified(null); setIsSearchOpen(true); }}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5"
              >
                <Search size={14} />
                <span>Search by name</span>
              </button>
              <button
                type="button"
                onClick={() => setUnidentified(null)}
                className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 text-xs font-bold underline"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}

        {/* Global Loading Overlay */}
        {isLoading && (
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center shadow-2xl space-y-5 backdrop-blur-xl">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-pink-950/60" />
              <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
              <Sparkles className="absolute inset-0 m-auto text-pink-400 animate-pulse" size={28} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Analyzing Product & Market Pricing...</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto">
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
          /* Landing Hero Studio / Scanner Hub */
          <div className="space-y-10">
            {/* HERO BANNER CARD */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-black rounded-3xl p-6 sm:p-10 border border-slate-200 dark:border-slate-800/90 shadow-2xl">
              <div className="relative z-10 space-y-6 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-pink-950/80 border border-pink-800/60 rounded-full text-pink-300 text-xs font-extrabold uppercase tracking-wider">
                  <Sparkles size={14} className="text-pink-400" />
                  <span>Real-Time Deal Intelligence Engine</span>
                </div>

                <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-slate-900 dark:text-white">
                  Know if it's a good price <br className="hidden sm:inline" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-rose-400 to-purple-400">
                    before you buy.
                  </span>
                </h2>

                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                  Snap any barcode, product label, or store box. SwiftScan instantly verifies MSRP list prices, checks 6-month historical lows, aggregates buyer reviews, and compares live deals across major retailers.
                </p>

                {/* Primary Scan Mode Buttons */}
                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="px-6 py-3.5 bg-gradient-to-r from-pink-600 via-rose-500 to-pink-500 hover:from-pink-500 hover:to-rose-600 text-slate-900 dark:text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-xl shadow-pink-600/30 flex items-center gap-2.5 transition-all active:scale-95 border border-pink-400/20"
                  >
                    <Camera size={18} />
                    <span>Open Camera Vision Scanner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(true)}
                    className="px-5 py-3.5 bg-white dark:bg-slate-900/90 hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs sm:text-sm rounded-2xl backdrop-blur-md border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 transition-all"
                  >
                    <Search size={18} className="text-pink-400" />
                    <span>Search Product by Name</span>
                  </button>
                </div>
              </div>

              {/* Decorative Glow Elements */}
              <div className="absolute -right-16 -bottom-16 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute right-20 top-0 w-48 h-48 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* TRUST HIGHLIGHTS BENTO GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-pink-950/60 text-pink-400 flex items-center justify-center font-bold text-xs mb-1 border border-pink-800/50">
                  <TrendingDown size={18} />
                </div>
                <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">Fair Price Gauge</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  Classifies every product deal as Steal 🔥, Good Deal 👍, Fair ⚖️, or Overpriced ⏳ based on 6-month historical range data.
                </p>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-amber-950/60 text-amber-400 flex items-center justify-center font-bold text-xs mb-1 border border-amber-800/50">
                  <ShieldCheck size={18} />
                </div>
                <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">Verified Reviews</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  Aggregates verified buyer pros, cons, sentiment scores, and technical specs into concise actionable insights.
                </p>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-emerald-950/60 text-emerald-400 flex items-center justify-center font-bold text-xs mb-1 border border-emerald-800/50">
                  <Store size={18} />
                </div>
                <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">Retail Cross-Check</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  Compares live in-stock pricing across Amazon, Best Buy, Walmart, Target, Micro Center, B&H, and eBay.
                </p>
              </div>
            </div>

            {/* RECENT PAST SCANS SECTION */}
            {savedItems.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <History size={18} className="text-pink-400" />
                      <h3 className="font-black text-lg text-slate-900 dark:text-white">Recent Past Scans</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Instant 1-click restore for your saved product scan history</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="text-xs text-pink-400 font-extrabold hover:underline flex items-center gap-1 transition-colors"
                  >
                    <span>View All ({savedItems.length})</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {savedItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setCurrentScanResult(item.scanResult);
                        setLastCapturedImage(item.thumbnailUrl);
                      }}
                      className="group relative p-3.5 bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-pink-600/50 shadow-sm transition-all cursor-pointer flex gap-3.5 items-center overflow-hidden"
                    >
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.scanResult.productName}
                          className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-800 group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-pink-950/60 text-pink-400 flex items-center justify-center shrink-0 border border-pink-900/50">
                          <Tag size={22} />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
                            {item.scanResult.brand}
                          </span>
                          {item.isBookmarked && (
                            <Bookmark size={12} className="fill-pink-500 text-pink-500 shrink-0" />
                          )}
                        </div>

                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate group-hover:text-pink-400 transition-colors">
                          {item.scanResult.productName}
                        </h4>

                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-xs font-black text-pink-400">
                            ${item.scanResult.goodPrice}
                          </span>
                          <span className="text-[10px] text-slate-500 line-through">
                            ${item.scanResult.msrp}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRESET SAMPLE PRODUCTS GRID */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">Featured Sample Product Presets</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tap any test product below to evaluate SwiftScan price analysis instantly</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {SAMPLE_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handlePresetScan(preset)}
                    className="group relative bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 hover:border-pink-600/50 shadow-sm transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 mb-3 border border-slate-200 dark:border-slate-800/80">
                      <img
                        src={preset.imageUrl}
                        alt={preset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2 left-2 bg-slate-50 dark:bg-slate-950/80 text-slate-900 dark:text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md backdrop-blur-md border border-slate-200 dark:border-slate-800">
                        {preset.category}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        {preset.brand}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight group-hover:text-pink-400 transition-colors">
                        {preset.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-extrabold text-pink-400">
                      <span>Analyze Deals</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <Footer affiliate={appConfig?.affiliate || {}} />

      <UpgradeModal
        open={!!limitModal}
        message={limitModal?.message}
        paidEnabled={!!appConfig?.paid.enabled}
        onClose={() => { setLimitModal(null); setErrorMessage(null); }}
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
      />
    </div>
  );

  // If iPhone Frame mode is enabled, wrap inside a sleek iPhone device mockup
  if (isIphoneFrameMode) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-black flex flex-col items-center justify-center p-2 sm:p-6 select-none">
        <div className="relative w-full max-w-[410px] h-[850px] max-h-[92vh] bg-slate-50 dark:bg-slate-950 rounded-[55px] p-3 shadow-[0_0_100px_rgba(236,72,153,0.25)] border-4 border-slate-200 dark:border-slate-800 ring-1 ring-slate-700 overflow-hidden flex flex-col">
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

