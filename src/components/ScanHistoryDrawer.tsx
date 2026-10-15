import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  Plus,
  Trash2,
  Search,
  Bookmark,
  Tag,
  History,
  Camera,
  Sparkles,
  Download,
  ShieldCheck,
  Star,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SavedScanItem } from '../types';

interface ScanHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedItems: SavedScanItem[];
  onSelectItem: (item: SavedScanItem) => void;
  onToggleBookmark: (id: string) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
  onSetTargetPrice?: (id: string, price: number | undefined) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  /** Explains where target-price alerts go (email when signed in, otherwise on this device only). */
  alertsHint?: string;
}

export const ScanHistoryDrawer: React.FC<ScanHistoryDrawerProps> = ({
  isOpen,
  onClose,
  savedItems,
  onSelectItem,
  onToggleBookmark,
  onUpdateTags,
  onSetTargetPrice,
  onDeleteItem,
  onClearAll,
  alertsHint,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'bookmarks'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScanType, setSelectedScanType] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [taggingItemId, setTaggingItemId] = useState<string | null>(null);
  const [newTagValue, setNewTagValue] = useState('');
  const [targetPriceItemId, setTargetPriceItemId] = useState<string | null>(null);
  const [newTargetPrice, setNewTargetPrice] = useState<string>('');

  // Extract all unique tags
  const allTags = Array.from(new Set(savedItems.flatMap(item => item.tags || []))).sort();

  if (!isOpen) return null;

  const bookmarkedItems = savedItems.filter((i) => i.isBookmarked);
  const itemsToDisplay = activeTab === 'bookmarks' ? bookmarkedItems : savedItems;

  const filteredItems = itemsToDisplay.filter((item) => {
    const matchesQuery =
      item.scanResult.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.scanResult.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.scanResult.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      selectedScanType === 'all' || item.scanType === selectedScanType;

    return matchesQuery && matchesType;
  });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getScanTypeLabel = (type?: string) => {
    switch (type) {
      case 'barcode':
        return { label: 'Barcode', icon: Tag, color: 'text-purple-400 bg-purple-950/60 border-purple-800/60' };
      case 'camera':
        return { label: 'Photo Scan', icon: Camera, color: 'text-pink-400 bg-pink-950/60 border-pink-800/60' };
      case 'search':
        return { label: 'Search', icon: Search, color: 'text-blue-400 bg-blue-950/60 border-blue-800/60' };
      case 'preset':
        return { label: 'Preset', icon: Sparkles, color: 'text-amber-400 bg-amber-950/60 border-amber-800/60' };
      default:
        return { label: 'Scan', icon: History, color: 'text-slate-400 bg-slate-800 border-slate-700' };
    }
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(savedItems, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `swiftscan_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-md h-full bg-white dark:bg-black text-slate-900 dark:text-slate-100 flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800"
        >
          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-900/40">
                <History size={20} />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-slate-900 dark:text-white">Past Scan History</h2>
                <p className="text-xs text-slate-400 font-medium">
                  {savedItems.length} total product {savedItems.length === 1 ? 'scan' : 'scans'} recorded
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs (All Scans vs Bookmarked) */}
          <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'text-pink-600 border-pink-600 dark:text-pink-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <History size={14} />
              <span>All History ({savedItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bookmarks')}
              className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === 'bookmarks'
                  ? 'text-pink-600 border-pink-600 dark:text-pink-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Bookmark size={14} className={bookmarkedItems.length > 0 ? 'fill-pink-500 text-pink-500' : ''} />
              <span>Saved Bookmarks ({bookmarkedItems.length})</span>
            </button>
          </div>

          {/* Search & Filter Section */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 space-y-2.5">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search history by name, brand, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-xs border border-slate-200 dark:border-slate-700 focus:border-pink-600 outline-none transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>

                        {/* Type filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold text-slate-400 scrollbar-none pt-1">
              {[
                { id: 'all', label: 'All Types' },
                { id: 'barcode', label: '🏷️ Barcode' },
                { id: 'camera', label: '📷 Photo' },
                { id: 'search', label: '🔍 Search' },
                { id: 'preset', label: '⚡ Preset' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedScanType(pill.id)}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold shrink-0 transition-all ${
                    selectedScanType === pill.id
                      ? 'bg-pink-600 text-white border-pink-600 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-white'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
            
            {/* Tag filter pills */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold text-slate-400 scrollbar-none pt-1 pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedTag('all')}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold shrink-0 transition-all ${
                    selectedTag === 'all'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-white'
                  }`}
                >
                  All Folders
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold shrink-0 transition-all ${
                      selectedTag === tag
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-white'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History Item List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <History size={26} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {searchQuery ? 'No matching scans found' : activeTab === 'bookmarks' ? 'No saved bookmarks yet' : 'No past scans recorded'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    {searchQuery
                      ? 'Try another search term or scan type filter'
                      : activeTab === 'bookmarks'
                      ? 'Tap the bookmark star on any scanned product to save it here'
                      : 'Every time you scan a barcode or photo, it will automatically appear in your past history list'}
                  </p>
                </div>
              </div>
            ) : (
              filteredItems.map((item) => {
                const typeInfo = getScanTypeLabel(item.scanType);
                const TypeIcon = typeInfo.icon;
                const ident = item.scanResult.identification;
                const matchLabel = ident?.verified
                  ? 'Barcode verified'
                  : ident?.method === 'photo'
                  ? 'AI guess'
                  : ident?.method === 'search' || ident?.method === 'correction'
                  ? 'From search'
                  : 'Unverified';

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectItem(item);
                      onClose();
                    }}
                    className="group relative p-3.5 bg-slate-50 dark:bg-slate-900/80 hover:bg-pink-50/60 dark:hover:bg-pink-950/30 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-pink-600/40 transition-all cursor-pointer flex gap-3.5 items-start shadow-sm"
                  >
                    {/* Thumbnail or Badge */}
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.scanResult.productName}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-800 mt-0.5"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-pink-600 flex items-center justify-center shrink-0 border border-pink-100 dark:border-pink-900/40 mt-0.5">
                        <Tag size={22} />
                      </div>
                    )}

                    {/* Content Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">
                          {item.scanResult.brand} • {item.scanResult.category}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">
                          {formatDate(item.timestamp)}
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                        {item.scanResult.productName}
                      </h3>

                      {/* Pricing & Badges row */}
                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-pink-600 dark:text-pink-400">
                            {formatCurrency(item.scanResult.goodPrice)}
                          </span>
                          <span className="text-[10px] text-slate-400 line-through">
                            {formatCurrency(item.scanResult.msrp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border ${typeInfo.color}`}>
                            <TypeIcon size={10} />
                            <span>{typeInfo.label}</span>
                          </span>

                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                            ident?.verified
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-300/50 dark:border-emerald-800/50'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300/50 dark:border-amber-800/50'
                          }`}>
                            {matchLabel}
                          </span>
                        </div>
                      </div>
                      {/* Target price input */}
                      {targetPriceItemId === item.id && (
                        <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                            <AlertCircle size={14} className="text-emerald-600 dark:text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400">Target Price: $</span>
                            <input
                              type="number"
                              autoFocus
                              value={newTargetPrice}
                              onChange={(e) => setNewTargetPrice(e.target.value)}
                              placeholder="0.00"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseFloat(newTargetPrice);
                                  onSetTargetPrice?.(item.id, isNaN(val) ? undefined : val);
                                  setTargetPriceItemId(null);
                                } else if (e.key === 'Escape') {
                                  setTargetPriceItemId(null);
                                }
                              }}
                              className="w-16 px-1.5 py-0.5 text-[10px] rounded border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = parseFloat(newTargetPrice);
                                onSetTargetPrice?.(item.id, isNaN(val) ? undefined : val);
                                setTargetPriceItemId(null);
                              }}
                              className="p-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:hover:bg-emerald-800 rounded transition-colors"
                            >
                              Save
                            </button>
                            {item.targetPrice && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSetTargetPrice?.(item.id, undefined);
                                  setTargetPriceItemId(null);
                                }}
                                className="p-1 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 rounded transition-colors ml-auto"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          {alertsHint && (
                            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{alertsHint}</p>
                          )}
                        </div>
                      )}

                      {/* Tags display and input */}
                      {((item.tags && item.tags.length > 0) || taggingItemId === item.id) && (
                        <div className="pt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {item.tags?.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-[9px] font-bold">
                              {tag}
                              <button
                                type="button"
                                onClick={() => onUpdateTags(item.id, item.tags!.filter(t => t !== tag))}
                                className="hover:text-purple-900 dark:hover:text-purple-100"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                          {taggingItemId === item.id && (
                            <div className="flex items-center gap-1 ml-1">
                              <input
                                type="text"
                                autoFocus
                                value={newTagValue}
                                onChange={(e) => setNewTagValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newTagValue.trim()) {
                                    e.preventDefault();
                                    const currentTags = item.tags || [];
                                    if (!currentTags.includes(newTagValue.trim())) {
                                      onUpdateTags(item.id, [...currentTags, newTagValue.trim()]);
                                    }
                                    setNewTagValue('');
                                  } else if (e.key === 'Escape') {
                                    setTaggingItemId(null);
                                  }
                                }}
                                placeholder="New tag..."
                                className="px-1.5 py-0.5 text-[10px] w-20 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (newTagValue.trim()) {
                                    const currentTags = item.tags || [];
                                    if (!currentTags.includes(newTagValue.trim())) {
                                      onUpdateTags(item.id, [...currentTags, newTagValue.trim()]);
                                    }
                                    setNewTagValue('');
                                  }
                                  setTaggingItemId(null);
                                }}
                                className="p-0.5 text-purple-600 bg-purple-100 dark:bg-purple-900/60 hover:bg-purple-200 dark:hover:bg-purple-800 rounded transition-colors"
                              >
                                <Check size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons (Bookmark, Tag & Delete) */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(item.id);
                        }}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          item.isBookmarked
                            ? 'bg-pink-600 text-white border-pink-600'
                            : 'text-slate-400 hover:text-pink-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                        title={item.isBookmarked ? 'Remove from bookmarks' : 'Bookmark this scan'}
                      >
                        <Bookmark size={14} className={item.isBookmarked ? 'fill-white' : ''} />
                      </button>
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (taggingItemId === item.id) {
                            setTaggingItemId(null);
                          } else {
                            setTaggingItemId(item.id);
                            setNewTagValue('');
                          }
                        }}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          taggingItemId === item.id || (item.tags && item.tags.length > 0)
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'text-slate-400 hover:text-purple-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                        title="Manage Folders / Tags"
                      >
                        <Tag size={14} className={taggingItemId === item.id || (item.tags && item.tags.length > 0) ? 'fill-white' : ''} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (targetPriceItemId === item.id) {
                            setTargetPriceItemId(null);
                          } else {
                            setTargetPriceItemId(item.id);
                            setNewTargetPrice(item.targetPrice ? item.targetPrice.toString() : '');
                          }
                        }}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          targetPriceItemId === item.id || item.targetPrice
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'text-slate-400 hover:text-emerald-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                        title="Set Target Price Alert"
                      >
                        <AlertCircle size={14} className={targetPriceItemId === item.id || item.targetPrice ? 'text-white' : ''} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteItem(item.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent transition-colors"
                        title="Delete from scan history"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer Actions */}
          {savedItems.length > 0 && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={handleExportJSON}
                className="text-xs text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1.5 transition-colors"
                title="Download history backup"
              >
                <Download size={14} />
                <span>Export JSON</span>
              </button>

              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold transition-colors"
              >
                Clear History
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
