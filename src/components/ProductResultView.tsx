import { getAffiliateUrl, getAffiliateConfig, hasAffiliateIds, isAmazonLink } from '../utils/affiliate';
import React, { useState } from 'react';
import {
  Star,
  CheckCircle2,
  XCircle,
  Download,
  TrendingDown,
  ExternalLink,
  Bookmark,
  Share2,
  Tag,
  ShieldCheck,
  Zap,
  ArrowRight,
  Info,
  Layers,
  Copy,
  Check,
  DollarSign,
  Sparkles,
  MessageSquare,
  Send,
  Loader2,
  HelpCircle,
  Bot,
  User,
  BrainCircuit,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { ProductScanResult, ProductQAMessage } from '../types';
import { ReportIncorrectScanModal } from './ReportIncorrectScanModal';
import { AdBanner } from './AdBanner';

interface ProductResultViewProps {
  result: ProductScanResult;
  capturedImageUrl?: string;
  onSaveToHistory: (notes?: string) => void;
  isSaved?: boolean;
  onNewScan: () => void;
  onCorrectScan?: (correctQuery: string) => void;
  onOpenSearch?: () => void;
}

export const ProductResultView: React.FC<ProductResultViewProps> = ({
  result,
  capturedImageUrl,
  onSaveToHistory,
  isSaved = false,
  onNewScan,
  onCorrectScan,
  onOpenSearch,
}) => {
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ask' | 'proscons' | 'prices' | 'localStores' | 'reviews' | 'specs'>('overview');

  // Product Q&A state
  const [qaMessages, setQaMessages] = useState<ProductQAMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  // Local Stores State
  const [localStores, setLocalStores] = useState<any[]>([]);
  const [isFetchingStores, setIsFetchingStores] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);

  const fetchLocalStores = async () => {
    setIsFetchingStores(true);
    setStoresError(null);
    try {
      const res = await fetch('/api/local-stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: result.productName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch local stores.');
      }
      setLocalStores(data.stores || []);
    } catch (err: any) {
      console.error('Local stores error:', err);
      setStoresError(err?.message || 'Could not find local stores.');
    } finally {
      setIsFetchingStores(false);
    }
  };

  const SUGGESTED_QUESTIONS = [
    'Is this compatible with iOS & Android?',
    'What is included in the box?',
    'Is it durable enough for daily workouts?',
    'Does it come with a manufacturer warranty?',
    'How does it compare to main competitors?',
  ];

  const handleAskQuestion = async (customQuestion?: string) => {
    const qText = (customQuestion || questionInput).trim();
    if (!qText || isAsking) return;

    const userMsg: ProductQAMessage = {
      id: 'q_' + Date.now(),
      sender: 'user',
      text: qText,
      timestamp: Date.now(),
    };

    setQaMessages((prev) => [...prev, userMsg]);
    setQuestionInput('');
    setIsAsking(true);
    setQaError(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: result.productName,
          brand: result.brand,
          category: result.category,
          summary: result.summary,
          question: qText,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to get answer from Gemini AI.');
      }

      const geminiMsg: ProductQAMessage = {
        id: 'a_' + Date.now(),
        sender: 'gemini',
        text: data.answer,
        timestamp: Date.now(),
      };

      setQaMessages((prev) => [...prev, geminiMsg]);
    } catch (err: any) {
      console.error('Q&A error:', err);
      setQaError(err?.message || 'Failed to reach Gemini AI. Please try again.');
    } finally {
      setIsAsking(false);
    }
  };

  const getPriceBadgeStyle = (rating: string) => {
    switch (rating) {
      case 'STEAL':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
          label: 'Incredible Steal 🔥',
          gradient: 'from-emerald-500 to-teal-600',
        };
      case 'GOOD_DEAL':
        return {
          bg: 'bg-pink-500/10 border-pink-500/30 text-pink-600 dark:text-pink-400',
          label: 'Good Deal 👍',
          gradient: 'from-pink-500 to-violet-600',
        };
      case 'FAIR':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
          label: 'Fair Retail Price ⚖️',
          gradient: 'from-amber-500 to-orange-600',
        };
      case 'OVERPRICED':
      default:
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
          label: 'Overpriced / Wait ⏳',
          gradient: 'from-rose-500 to-red-600',
        };
    }
  };

  const badgeStyle = getPriceBadgeStyle(result.priceRating);

  const ident = result.identification;
  const isDbVerified = !!(ident && ident.verified && ident.method === 'database');
  const isPhotoId = ident?.method === 'photo';
  // Only AI photo identification has a confidence number, and it is shown as an unverified estimate.
  const confidenceVal = isPhotoId && typeof result.confidence === 'number'
    ? Math.min(70, Math.round(result.confidence > 1 ? result.confidence : result.confidence * 100))
    : 0;
  const hasRating = typeof result.rating === 'number' && !isNaN(result.rating);
  const hasReviewCount = typeof result.totalReviewsCount === 'number' && result.totalReviewsCount > 0;
  const idBadgeLabel = isDbVerified
    ? `BARCODE MATCH · ${ident?.source || 'DATABASE'}`
    : isPhotoId
    ? `AI PHOTO GUESS · ${confidenceVal}% (UNVERIFIED)`
    : ident?.method === 'search' || ident?.method === 'correction'
    ? 'MATCHED FROM YOUR SEARCH'
    : 'UNVERIFIED';
  const idBadgeClass = isDbVerified
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/50'
    : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/50';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleCopySummary = () => {
    const text = `${result.productName} by ${result.brand}
${hasRating ? `Rating: ${result.rating}/5${hasReviewCount ? ` (${result.totalReviewsCount!.toLocaleString()} reviews)` : ''}\n` : ''}MSRP: ${formatCurrency(result.msrp)} | Target Fair Price: ${formatCurrency(result.goodPrice)}
Verdict: ${result.verdict}
Summary: ${result.summary}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find lowest price among comparison retailers
  const lowestPriceItem = result.priceComparison && result.priceComparison.length > 0
    ? [...result.priceComparison].sort((a, b) => a.price - b.price)[0]
    : null;

  const mockPriceHistory = React.useMemo(() => {
    const currentBestPrice = lowestPriceItem ? lowestPriceItem.price : result.goodPrice;
    const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    const data = [];
    let basePrice = currentBestPrice * 1.15; // Start roughly 15% higher 6 months ago
    for (let i = 0; i < 6; i++) {
      data.push({
        month: months[i],
        price: i === 5 ? currentBestPrice : Number((basePrice + (Math.random() * (currentBestPrice * 0.05) - (currentBestPrice * 0.025))).toFixed(2)),
      });
      basePrice = basePrice - (currentBestPrice * 0.03); // Trending down slowly
    }
    return data;
  }, [lowestPriceItem, result.goodPrice]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-24">
      <AdBanner />
      {/* Top Banner Card with Image & Title */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          {(capturedImageUrl || ident?.imageUrl) ? (
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 shadow-inner group">
              <img
                src={capturedImageUrl || ident?.imageUrl}
                alt={result.productName}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-[10px] font-bold text-white px-2 py-0.5 rounded-md backdrop-blur-sm">
                {capturedImageUrl ? 'PHOTO' : 'DATABASE'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = (capturedImageUrl || ident?.imageUrl) as string;
                  link.download = `scan-${result.productName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="absolute top-1.5 left-1.5 bg-black/50 backdrop-blur-md text-white p-1.5 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/80 border border-white/10"
                title="Save Photo to Device"
              >
                <Download size={14} />
              </button>
            </div>
          ) : (
            <div className="w-28 h-28 rounded-2xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0 border border-pink-100 dark:border-pink-900/50">
              <Tag size={40} />
            </div>
          )}

          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {result.brand}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  • {result.category}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`flex items-center gap-1.5 font-extrabold px-3 py-1 rounded-full text-xs border ${idBadgeClass}`}>
                  {isDbVerified ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
                  <span>{idBadgeLabel}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/70 dark:hover:bg-amber-900 dark:text-amber-300 dark:border-amber-800/80 transition-all shadow-sm active:scale-95 cursor-pointer"
                  title="Alert or correct misidentified scan item"
                >
                  <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                  <span>Incorrect Item?</span>
                </button>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              {result.productName}
            </h1>

            {/* Rating row: only shown when backed by a real source (none yet), never invented */}
            {(hasRating || result.reviewSentiment) && (
              <div className="flex items-center gap-3 pt-1">
                {hasRating && (
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star size={16} className="fill-current" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white ml-1">
                      {result.rating!.toFixed(1)} / 5.0
                    </span>
                  </div>
                )}
                {hasRating && hasReviewCount && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({result.totalReviewsCount!.toLocaleString()} reviews)
                  </span>
                )}
                {result.reviewSentiment && (
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    {result.reviewSentiment.replace(/_/g, ' ')} (est.)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Header Controls */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSaveToHistory()}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                isSaved
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Bookmark size={15} className={isSaved ? 'fill-white' : ''} />
              <span>{isSaved ? 'Saved in Collections' : 'Save Scan'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2"
              title="Share Analysis"
            >
              <Share2 size={15} />
              <span>Share</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onNewScan}
            className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-md shadow-pink-600/20 flex items-center gap-1.5 transition-all"
          >
            <span>Scan Another</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* HOW THIS PRODUCT WAS IDENTIFIED (honest provenance, no fake certainty) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border shrink-0 ${
              isDbVerified
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60'
            }`}>
              {isDbVerified ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isDbVerified ? 'Identified from barcode database' : isPhotoId ? 'Identified by AI from your photo (unverified)' : ident?.method === 'search' || ident?.method === 'correction' ? 'Product from your search' : 'Identification not verified'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isDbVerified
                  ? `UPC ${ident?.upc || ''} matched in ${ident?.source}. Name and brand come from that database. Prices below are AI estimates.`
                  : isPhotoId
                  ? 'The AI read this from the photo and may be wrong. Check the name against your product. Prices below are AI estimates.'
                  : ident?.method === 'search' || ident?.method === 'correction'
                  ? 'This is the product you typed. Prices below are AI estimates.'
                  : 'This scan was saved before barcode verification was added and may be inaccurate.'}
              </p>
            </div>
          </div>
        </div>

        {isPhotoId && confidenceVal > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${confidenceVal}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span>AI estimate: {confidenceVal}% (capped, not verified)</span>
            </div>
          </div>
        )}
      </div>

      {/* PRICE ADVISOR & DEAL ASSESSMENT CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 rounded-xl border border-pink-100 dark:border-pink-900/40">
              <DollarSign size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Price & Value Assessment</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI price estimates. Confirm at the retailer before buying.</p>
            </div>
          </div>

          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${badgeStyle.bg}`}>
            {badgeStyle.label}
          </span>
        </div>

        {/* PRICE TARGET CARDS GRID */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 text-center">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              List MSRP
            </span>
            <span className="text-base sm:text-lg font-bold text-slate-500 dark:text-slate-400 line-through decoration-slate-400/70">
              {formatCurrency(result.msrp)}
            </span>
          </div>

          <div className="p-3.5 sm:p-4 bg-gradient-to-br from-pink-600 to-violet-600 rounded-2xl text-center shadow-lg shadow-pink-600/25 ring-1 ring-white/10">
            <span className="text-[10px] sm:text-[11px] font-bold text-pink-100 uppercase tracking-wider block mb-1">
              Target (Lowest)
            </span>
            <span className="text-lg sm:text-2xl font-extrabold text-white">
              {formatCurrency(result.goodPrice)}
            </span>
          </div>

          <div className="p-3.5 sm:p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/70 dark:border-emerald-900/50 text-center">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
              Steal Deal
            </span>
            <span className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(result.greatDealPrice)}
            </span>
          </div>
        </div>

        {/* PRICE POSITION SCALE (built only from the estimates above) */}
        {(() => {
          const points = [result.greatDealPrice, result.goodPrice, result.msrp].filter((n) => typeof n === 'number' && isFinite(n));
          if (points.length < 2) return null;
          const lo = Math.min(...points);
          const hi = Math.max(...points);
          if (hi <= lo) return null;
          const pos = (n: number) => Math.min(100, Math.max(0, ((n - lo) / (hi - lo)) * 100));
          return (
            <div className="space-y-2" aria-label="Estimated price scale from steal price to list price">
              <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-emerald-500 via-pink-500 to-amber-400">
                <span className="absolute inset-y-0 w-0.5 bg-white/90" style={{ left: `${pos(result.goodPrice)}%` }} />
              </div>
              <div className="relative h-5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span className="absolute left-0">Steal {formatCurrency(result.greatDealPrice)}</span>
                <span className="absolute right-0">List {formatCurrency(result.msrp)}</span>
              </div>
            </div>
          );
        })()}

        {/* VERDICT & ADVICE BANNER */}
        <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-md border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-widest">
            <ShieldCheck size={16} />
            <span>AI Expert Verdict</span>
          </div>
          <p className="text-sm sm:text-base font-semibold leading-relaxed text-slate-100">
            "{result.verdict}"
          </p>
          <p className="text-xs text-slate-300 leading-relaxed pt-1 border-t border-slate-800">
            {result.priceAdvice}
          </p>
        </div>

        {/* HISTORICAL RANGE METER */}
        {result.historicalPriceRange && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>All-time Low: <strong className="text-slate-900 dark:text-white font-bold">{formatCurrency(result.historicalPriceRange.lowestEver)}</strong></span>
              <span>Average: <strong className="text-slate-900 dark:text-white font-bold">{formatCurrency(result.historicalPriceRange.averagePrice)}</strong></span>
              <span>High: <strong className="text-slate-900 dark:text-white font-bold">{formatCurrency(result.historicalPriceRange.highestPrice)}</strong></span>
            </div>
            {(() => {
              const h = result.historicalPriceRange!;
              const span = h.highestPrice - h.lowestEver;
              const at = (n: number) => (span > 0 ? Math.min(100, Math.max(0, ((n - h.lowestEver) / span) * 100)) : 50);
              return (
                <div className="relative w-full h-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-pink-500 to-amber-400" aria-label="Estimated historical price range">
                  <span
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-[3px] border-slate-900 dark:border-white shadow"
                    style={{ left: `calc(${at(h.averagePrice)}% - 8px)` }}
                    title={`Average ${formatCurrency(h.averagePrice)}`}
                  />
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* NAVIGATION TABS FOR DETAILED SECTIONS */}
      <div className="flex items-center p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl gap-1 overflow-x-auto">
        {(
          [
            { id: 'overview', label: 'Summary' },
            { id: 'ask', label: 'Ask Gemini 💬' },
            { id: 'proscons', label: 'Pros & Cons' },
            { id: 'prices', label: 'Store Prices' },
            { id: 'localStores', label: 'Local Stores 📍' },
            { id: 'reviews', label: 'Reviews' },
            { id: 'specs', label: 'Specs' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'localStores' && localStores.length === 0 && !isFetchingStores) {
                fetchLocalStores();
              }
            }}
            className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: OVERVIEW & SUMMARY */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Info size={16} className="text-pink-600" />
              <span>Product Summary</span>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {result.summary}
            </p>
          </div>

          {/* DEDICATED GOOGLE GEMINI AI PRODUCT DESCRIPTION CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-pink-100 dark:border-pink-900/40 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 rounded-xl">
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Google Gemini Product Description</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Deep AI analysis of architecture, build, and user fit</p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-pink-800 text-xs font-bold shrink-0">
                <Sparkles size={13} className="text-pink-600 dark:text-pink-400 animate-pulse" />
                <span>Powered by Gemini 3.6 Flash</span>
              </span>
            </div>

            <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed space-y-3">
              <p>
                {result.geminiDescription || result.summary || `${result.productName} by ${result.brand} (${result.category}).`}
              </p>
            </div>

            {/* Quick Ask CTA Banner inside Description Card */}
            <div className="mt-4 p-4 bg-pink-50/70 dark:bg-pink-950/40 rounded-2xl border border-pink-100 dark:border-pink-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <MessageSquare size={18} className="text-pink-600 dark:text-pink-400 shrink-0" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Have specific questions about this product?
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('ask')}
                className="w-full sm:w-auto px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                <span>Ask Google Gemini</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* PROS AND CONS QUICK HIGHLIGHT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* PROS */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-3xl p-5 border border-emerald-100 dark:border-emerald-900/40 space-y-3">
              <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} />
                  <span>The Good (Pros)</span>
                </span>
                <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px]">
                  {result.pros.length} key points
                </span>
              </h4>
              <ul className="space-y-2.5">
                {result.pros.map((pro, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CONS */}
            <div className="bg-rose-50/70 dark:bg-rose-950/30 rounded-3xl p-5 border border-rose-100 dark:border-rose-900/40 space-y-3">
              <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <XCircle size={16} />
                  <span>The Caveats (Cons)</span>
                </span>
                <span className="bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-full text-[10px]">
                  {result.cons.length} items
                </span>
              </h4>
              <ul className="space-y-2.5">
                {result.cons.map((con, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ASK GOOGLE GEMINI Q&A */}
      {activeTab === 'ask' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 rounded-xl border border-pink-100 dark:border-pink-900/40">
                  <HelpCircle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Ask Google Gemini About This Product</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ask questions regarding compatibility, warranty, performance, or alternatives</p>
                </div>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-pink-800 text-xs font-bold">
                <Sparkles size={13} className="text-pink-600 dark:text-pink-400" />
                <span>Gemini 3.6 Flash</span>
              </span>
            </div>

            {/* SUGGESTED QUICK QUESTIONS */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Suggested Questions
              </span>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((sq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAskQuestion(sq)}
                    disabled={isAsking}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-pink-50 dark:hover:bg-pink-950/50 hover:text-pink-600 dark:hover:text-pink-400 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-slate-700/80 transition-all text-left flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <MessageSquare size={13} className="text-pink-600 dark:text-pink-400 shrink-0" />
                    <span>{sq}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Q&A MESSAGES THREAD */}
            <div className="space-y-4 pt-2">
              {qaMessages.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/80 space-y-2">
                  <Bot size={32} className="mx-auto text-pink-600 dark:text-pink-400 opacity-80" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No questions asked yet</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Type a question below or tap any suggested question above to get instant AI answers about {result.productName}.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {qaMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.sender === 'gemini' && (
                        <div className="w-8 h-8 rounded-xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                          <Bot size={16} />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-pink-600 text-white font-medium rounded-tr-xs'
                            : 'bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-tl-xs space-y-1'
                        }`}
                      >
                        {msg.sender === 'gemini' && (
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 pb-1 mb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                            <Sparkles size={12} />
                            <span>Google Gemini AI</span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>

                      {msg.sender === 'user' && (
                        <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                          <User size={16} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* LOADING INDICATOR */}
              {isAsking && (
                <div className="flex items-center gap-3 p-4 bg-pink-50/60 dark:bg-pink-950/30 rounded-2xl border border-pink-100 dark:border-pink-900/40 text-xs font-semibold text-pink-600 dark:text-pink-400">
                  <Loader2 size={18} className="animate-spin text-pink-600" />
                  <span>Google Gemini is analyzing specifications and reviews to answer...</span>
                </div>
              )}

              {/* ERROR STATE */}
              {qaError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300 rounded-xl text-xs font-semibold">
                  {qaError}
                </div>
              )}
            </div>

            {/* INPUT FORM */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion();
              }}
              className="relative pt-2"
            >
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={`Ask Gemini anything about ${result.productName}...`}
                  disabled={isAsking}
                  className="w-full py-3.5 pl-4 pr-14 bg-slate-50 dark:bg-slate-800/80 rounded-2xl text-xs sm:text-sm border border-slate-200 dark:border-slate-700 focus:border-pink-600 outline-none transition-all text-slate-900 dark:text-white font-medium"
                />
                <button
                  type="submit"
                  disabled={!questionInput.trim() || isAsking}
                  className="absolute right-2.5 p-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl disabled:opacity-40 transition-all shadow-md shadow-pink-600/20"
                  title="Send Question to Gemini"
                >
                  {isAsking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB CONTENT: DEDICATED PROS & CONS ANALYSIS */}
      {activeTab === 'proscons' && (
        <div className="space-y-6">
          {/* Header Banner for Pros & Cons */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck size={18} className="text-pink-600" />
                  <span>Aggregated Review Sentiment & Insights</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  AI-generated summary. Not based on counted customer reviews.
                </p>
              </div>

              {result.reviewSentiment && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-900/50">
                    Sentiment (est.): {result.reviewSentiment.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
            </div>

            {/* Visual Grid of Pros & Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Detailed Pros Card */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-5 border border-emerald-200/80 dark:border-emerald-900/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={20} className="shrink-0" />
                    <h4 className="font-bold text-sm uppercase tracking-wider">Top Advantages (Pros)</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                    {result.pros.length} High Notes
                  </span>
                </div>

                <div className="space-y-3">
                  {result.pros.map((pro, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-slate-900/90 rounded-xl border border-emerald-100 dark:border-emerald-900/40 shadow-xs flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        ✓
                      </span>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                        {pro}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed Cons Card */}
              <div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl p-5 border border-rose-200/80 dark:border-rose-900/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                    <XCircle size={20} className="shrink-0" />
                    <h4 className="font-bold text-sm uppercase tracking-wider">Known Drawbacks (Cons)</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300">
                    {result.cons.length} Points
                  </span>
                </div>

                <div className="space-y-3">
                  {result.cons.map((con, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-slate-900/90 rounded-xl border border-rose-100 dark:border-rose-900/40 shadow-xs flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        ✕
                      </span>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                        {con}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: STORE PRICES */}
      {activeTab === 'prices' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingDown size={18} className="text-pink-600" />
              <span>Current Retailer Prices</span>
            </h3>
            {lowestPriceItem && (
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/40">
                Lowest: {formatCurrency(lowestPriceItem.price)} at {lowestPriceItem.retailer}
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {result.priceComparison.map((item, idx) => (
              <div key={idx} className="py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {item.retailer}
                    </span>
                    {item.dealTag && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-900/50">
                        {item.dealTag}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {item.inStock ? 'In Stock' : 'Out of Stock / Backorder'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    {formatCurrency(item.price)}
                  </span>
                  <a
                    href={getAffiliateUrl(item.url, item.retailer, result.productName)}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="px-3 py-1.5 rounded-xl bg-pink-600 text-white font-bold text-xs shadow-sm hover:bg-pink-700 transition-colors flex items-center gap-1"
                    title={hasAffiliateIds() ? 'Affiliate link: we may earn a commission at no extra cost to you' : undefined}
                  >
                    <span>View Deal</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {hasAffiliateIds() && (
            <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
              {getAffiliateConfig().amazonTag && result.priceComparison.some((i) => isAmazonLink(i.url))
                ? 'As an Amazon Associate I earn from qualifying purchases. '
                : ''}
              Links above may be affiliate links; we may earn a commission at no extra cost to you.
            </p>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <TrendingDown size={18} className="text-pink-600" />
              <span>Illustrative Price Trend</span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">(sample shape, not real price history)</span>
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockPriceHistory} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                    formatter={(value: number) => [formatCurrency(value), 'Price']}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ fill: '#6366f1', strokeWidth: 2, r: 4, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: LOCAL STORES */}
      {activeTab === 'localStores' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin size={18} className="text-pink-600" />
              <span>Local Retailers Nearby</span>
            </h3>
            {isFetchingStores && (
              <span className="flex items-center gap-1.5 text-xs text-pink-600 font-medium">
                <Loader2 size={14} className="animate-spin" /> Fetching map data...
              </span>
            )}
          </div>

          {storesError && (
             <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300 rounded-xl text-xs font-semibold">
               {storesError}
             </div>
          )}

          {!isFetchingStores && !storesError && localStores.length === 0 && (
             <div className="p-6 text-center text-sm text-slate-500">
               No local stores found.
             </div>
          )}

          {!isFetchingStores && localStores.length > 0 && (
            <div className="space-y-3">
              {localStores.map((store, idx) => (
                <div key={idx} className="p-4 flex flex-col sm:flex-row justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                  <div className="space-y-1">
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">{store.name}</span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin size={12} /> {store.address}
                    </span>
                    {store.reason && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 italic flex items-start gap-1">
                        <Sparkles size={12} className="text-pink-500 shrink-0 mt-0.5" />
                        <span>{store.reason}</span>
                      </p>
                    )}
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.name + ' ' + store.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 shrink-0 self-start sm:self-center bg-pink-50 hover:bg-pink-100 dark:bg-pink-950 dark:hover:bg-pink-900 text-pink-700 dark:text-pink-400 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <span>Directions</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: REVIEWS */}
      {activeTab === 'reviews' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Reviews Highlight</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Real customer reviews live on the retailer sites.</p>
            </div>
            {hasRating && (
              <div className="text-right">
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">{result.rating!.toFixed(1)} / 5.0</span>
              </div>
            )}
          </div>

          {(!result.topReviews || result.topReviews.length === 0) && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 text-xs text-slate-500 dark:text-slate-300 space-y-2">
              <p>We don't have verified customer reviews or a star rating for this product, so none are shown rather than making them up.</p>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(result.productName + ' reviews')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-bold text-pink-600 dark:text-pink-400 underline"
              >
                Search reviews for this product
              </a>
            </div>
          )}
          <div className="space-y-3">
            {(result.topReviews || []).map((rev, idx) => (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{rev.author}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">• {rev.source}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < Math.floor(rev.rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 italic">"{rev.comment}"</p>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block text-right">{rev.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: KEY SPECS */}
      {activeTab === 'specs' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers size={18} className="text-pink-600" />
            <span>Key Specifications</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.keySpecs.map((spec, idx) => (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{spec.label}</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white mt-1 block">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AFFILIATE DISCLOSURE */}
      <div className="text-center px-4 pt-2">
        <p className="text-[10px] text-slate-400/80">
          Disclosure: This site may earn a commission from purchases made through links on this page.
        </p>
      </div>

      {/* SHARE MODAL */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowShareModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Share2 size={18} className="text-pink-600" />
                  <span>Share Analysis</span>
                </h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded-full transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Visual Summary Card */}
                <div className="bg-gradient-to-br from-slate-900 to-black rounded-2xl p-5 shadow-inner border border-slate-800 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap size={100} className="text-pink-500" />
                  </div>
                  
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-start gap-4">
                      {capturedImageUrl ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-700">
                          <img src={capturedImageUrl} alt="Product" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-500 flex items-center justify-center shrink-0 border border-pink-200 dark:border-pink-800/30">
                          <Tag size={24} />
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-pink-700 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-900/50">
                          {result.brand}
                        </span>
                        <h4 className="font-bold text-white leading-tight line-clamp-2">
                          {result.productName}
                        </h4>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider block">Target Price</span>
                        <span className="font-bold text-emerald-400 text-lg">{formatCurrency(result.goodPrice)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider block">MSRP</span>
                        <span className="font-bold text-slate-300 text-lg line-through">{formatCurrency(result.msrp)}</span>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                        <p className="text-xs text-slate-300 font-medium italic">
                          "{result.verdict}"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleCopySummary}
                    className="w-full py-3.5 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-pink-600/20 flex items-center justify-center gap-2"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Text Snippet'}</span>
                  </button>
                  
                  {navigator.share && (
                    <button
                      onClick={() => {
                        const text = `${result.productName} by ${result.brand}\nTarget Fair Price: ${formatCurrency(result.goodPrice)}\nVerdict: ${result.verdict}\nShared from SwiftScan`;
                        navigator.share({
                          title: 'Price Analysis',
                          text: text,
                        }).catch(console.error);
                      }}
                      className="w-full py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold text-sm transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
                    >
                      <Share2 size={18} />
                      <span>Share via...</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Report Incorrect Scan Modal */}
      <ReportIncorrectScanModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        currentProductName={result.productName}
        currentBrand={result.brand}
        capturedImageUrl={capturedImageUrl}
        onSubmitCorrection={(correctName) => {
          if (onCorrectScan) {
            onCorrectScan(correctName);
          }
        }}
        onRetakePhoto={onNewScan}
        onManualSearch={() => {
          if (onOpenSearch) onOpenSearch();
        }}
      />
    </div>
  );
};
