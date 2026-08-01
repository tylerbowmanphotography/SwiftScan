import React, { useState } from 'react';
import { X, Trash2, Search, ExternalLink, Calendar, Bookmark, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SavedScanItem } from '../types';

interface ScanHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedItems: SavedScanItem[];
  onSelectItem: (item: SavedScanItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export const ScanHistoryDrawer: React.FC<ScanHistoryDrawerProps> = ({
  isOpen,
  onClose,
  savedItems,
  onSelectItem,
  onDeleteItem,
  onClearAll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredItems = savedItems.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.scanResult.productName.toLowerCase().includes(query) ||
      item.scanResult.brand.toLowerCase().includes(query) ||
      item.scanResult.category.toLowerCase().includes(query)
    );
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-900/40">
                <Bookmark size={20} />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-900 dark:text-white">Saved Scans</h2>
                <p className="text-xs text-slate-400 font-medium">
                  {savedItems.length} {savedItems.length === 1 ? 'item' : 'items'} in collection
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search saved scans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-xs border border-slate-200 dark:border-slate-700 focus:border-pink-600 outline-none transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Saved Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Bookmark size={24} />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No saved scans found</p>
                <p className="text-xs text-slate-400">
                  {searchQuery ? 'Try matching another name or category' : 'Scan a product and tap "Save Scan"'}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectItem(item);
                    onClose();
                  }}
                  className="group relative p-3.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-pink-50/60 dark:hover:bg-pink-950/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 hover:border-pink-600/40 transition-all cursor-pointer flex gap-3.5 items-center"
                >
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.scanResult.productName}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-pink-50 dark:bg-pink-950/50 text-pink-600 flex items-center justify-center shrink-0 border border-pink-100 dark:border-pink-900/40">
                      <Tag size={20} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                      {item.scanResult.brand} • {item.scanResult.category}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {item.scanResult.productName}
                    </h3>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-bold text-pink-600 dark:text-pink-400">
                        Target: {formatCurrency(item.scanResult.goodPrice)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatDate(item.timestamp)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                    title="Delete saved scan"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer */}
          {savedItems.length > 0 && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-black/80">
              <span className="text-xs font-medium text-slate-400">Stored locally in browser</span>
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold transition-colors"
              >
                Clear All History
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
