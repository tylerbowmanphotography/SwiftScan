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
  Upload,
  Layers,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Battery,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Header } from './components/Header';
import { CameraScannerModal } from './components/CameraScannerModal';
import { ProductResultView } from './components/ProductResultView';
import { ScanHistoryDrawer } from './components/ScanHistoryDrawer';
import { ManualSearchModal } from './components/ManualSearchModal';

import { ProductScanResult, SavedScanItem, SampleProductPreset } from './types';
import { SAMPLE_PRESETS } from './data/samplePresets';

export default function App() {
  const [isIphoneFrameMode, setIsIphoneFrameMode] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentScanResult, setCurrentScanResult] = useState<ProductScanResult | null>(null);
  const [lastCapturedImage, setLastCapturedImage] = useState<string | undefined>(undefined);

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

  const handleScanImage = async (base64Data: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastCapturedImage(base64Data);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Data }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze product. Please try again.');
      }

      setCurrentScanResult(data.data);
      setIsScannerOpen(false);
    } catch (err: any) {
      console.error('Scan error:', err);
      setErrorMessage(err?.message || 'Failed to scan image. Please verify connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchText = async (textQuery: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastCapturedImage(undefined);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textQuery }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to search product. Please try again.');
      }

      setCurrentScanResult(data.data);
      setIsSearchOpen(false);
    } catch (err: any) {
      console.error('Search error:', err);
      setErrorMessage(err?.message || 'Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetScan = async (preset: SampleProductPreset) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastCapturedImage(preset.imageUrl);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textQuery: `${preset.brand} ${preset.name}` }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze product.');
      }

      setCurrentScanResult(data.data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Preset scan failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCurrentScan = (notes?: string) => {
    if (!currentScanResult) return;

    const existingIndex = savedItems.findIndex(
      (item) => item.scanResult.productName === currentScanResult.productName
    );

    if (existingIndex >= 0) {
      // Remove if already saved
      setSavedItems((prev) => prev.filter((_, idx) => idx !== existingIndex));
    } else {
      const newItem: SavedScanItem = {
        id: 'scan_' + Date.now(),
        timestamp: Date.now(),
        thumbnailUrl: lastCapturedImage,
        scanResult: currentScanResult,
        userNotes: notes,
      };
      setSavedItems((prev) => [newItem, ...prev]);
    }
  };

  const isCurrentSaved = currentScanResult
    ? savedItems.some((item) => item.scanResult.productName === currentScanResult.productName)
    : false;

  const handleDeleteSavedItem = (id: string) => {
    setSavedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllHistory = () => {
    if (window.confirm('Clear all saved product scan history?')) {
      setSavedItems([]);
    }
  };

  // Render the core app body
  const renderAppContent = () => (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-pink-600 selection:text-white">
      {/* Header */}
      <Header
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        savedCount={savedItems.length}
        isIphoneFrameMode={isIphoneFrameMode}
        onToggleIphoneFrame={() => setIsIphoneFrameMode(!isIphoneFrameMode)}
      />

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Error Banner */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="font-bold underline shrink-0 hover:opacity-80"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="bg-white dark:bg-black rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center shadow-sm space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-pink-100 dark:border-pink-950" />
              <div className="absolute inset-0 rounded-full border-4 border-pink-600 border-t-transparent animate-spin" />
              <Sparkles className="absolute inset-0 m-auto text-pink-600 animate-pulse" size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Analyzing Product Photo...</h3>
              <p className="text-xs font-medium text-slate-400 mt-1">
                Gathering MSRP benchmark, reviews consensus, and current store deals
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
          />
        ) : !isLoading ? (
          /* Landing Hero / Quick Scan Controls */
          <div className="space-y-8">
            {/* Main Action Banner */}
            <div className="relative overflow-hidden bg-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-md border border-slate-800">
              <div className="relative z-10 space-y-4 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles size={14} />
                  <span>AI Powered Price & Review Scanner</span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
                  Know if it's a good price before you buy.
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Snap a photo of any product, price label, or box. Get aggregated consumer reviews, MSRP verification, fair target price, and live store comparisons instantly.
                </p>

                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="px-5 py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-pink-600/30 flex items-center gap-2 transition-all active:scale-95"
                  >
                    <Camera size={18} />
                    <span>Open Camera Scanner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(true)}
                    className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-2xl backdrop-blur-md border border-white/10 flex items-center gap-2 transition-all"
                  >
                    <Search size={18} />
                    <span>Search by Name</span>
                  </button>
                </div>
              </div>

              {/* Decorative Background Accents */}
              <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-pink-50 dark:bg-pink-950/50 text-pink-600 flex items-center justify-center font-bold text-xs mb-1">
                  <TrendingDown size={18} />
                </div>
                <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">Fair Price Gauge</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  Instantly verify if current price is a steal, fair retail, or overpriced.
                </p>
              </div>

              <div className="p-5 bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center font-bold text-xs mb-1">
                  <ShieldCheck size={18} />
                </div>
                <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">Review Consensus</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  Aggregated star scores, verified buyer pros & cons, and key specs.
                </p>
              </div>

              <div className="p-5 bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold text-xs mb-1">
                  <Zap size={18} />
                </div>
                <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">Store Comparison</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  Price check across major retailers (Amazon, Best Buy, Walmart, Target).
                </p>
              </div>
            </div>

            {/* PRESET SAMPLE PRODUCTS DEMO CAROUSEL */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Sample Product Presets</h3>
                  <p className="text-xs text-slate-400">Select any product to test price valuation and review breakdown</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {SAMPLE_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handlePresetScan(preset)}
                    className="group relative bg-white dark:bg-black rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 hover:border-pink-600/50 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3">
                      <img
                        src={preset.imageUrl}
                        alt={preset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm">
                        {preset.category}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {preset.brand}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight">
                        {preset.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-pink-600 dark:text-pink-400">
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

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCaptureImage={handleScanImage}
        isLoading={isLoading}
      />

      {/* Manual Search Modal */}
      <ManualSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSearch={handleSearchText}
        isLoading={isLoading}
      />

      {/* Saved History Drawer */}
      <ScanHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        savedItems={savedItems}
        onSelectItem={(item) => {
          setCurrentScanResult(item.scanResult);
          setLastCapturedImage(item.thumbnailUrl);
        }}
        onDeleteItem={handleDeleteSavedItem}
        onClearAll={handleClearAllHistory}
      />
    </div>
  );

  // If iPhone Frame mode is enabled, wrap inside a sleek iPhone device mock frame
  if (isIphoneFrameMode) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-2 sm:p-6 select-none">
        <div className="relative w-full max-w-[410px] h-[850px] max-h-[92vh] bg-zinc-900 rounded-[55px] p-3 shadow-[0_0_80px_rgba(79,70,229,0.25)] border-4 border-zinc-800 ring-1 ring-zinc-700 overflow-hidden flex flex-col">
          {/* iPhone Dynamic Island / Notch Header */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 w-28 h-7 bg-black rounded-full flex items-center justify-between px-2.5 shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-pink-950 border border-pink-700/50" />
          </div>

          {/* iPhone Top Status Bar */}
          <div className="relative z-40 px-7 pt-2 pb-1 flex items-center justify-between text-[11px] font-semibold text-zinc-300">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <Wifi size={12} />
              <Battery size={14} className="fill-zinc-300" />
            </div>
          </div>

          {/* iPhone Inner Screen Frame */}
          <div className="relative flex-1 bg-zinc-50 dark:bg-zinc-950 rounded-[44px] overflow-y-auto scrollbar-none">
            {renderAppContent()}
          </div>

          {/* iPhone Bottom Home Bar Indicator */}
          <div className="py-2 flex justify-center">
            <div className="w-32 h-1 bg-zinc-700 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return renderAppContent();
}
