import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ManualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export const ManualSearchModal: React.FC<ManualSearchModalProps> = ({
  isOpen,
  onClose,
  onSearch,
  isLoading,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (query.trim().length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      
      setIsTyping(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/autocomplete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query.trim() }),
          });
          const data = await res.json();
          if (data.suggestions) {
            setSuggestions(data.suggestions);
          }
        } catch(e) {
          console.error('Autocomplete error', e);
        } finally {
          setIsTyping(false);
        }
      }, 400); // 400ms debounce
    } else {
      setSuggestions([]);
      setIsTyping(false);
    }
  }, [query]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSearch(query.trim());
  };

  const quickSuggestions = [
    'Sony WH-1000XM5',
    'Apple AirPods Pro 2',
    'Nintendo Switch OLED',
    'KitchenAid Artisan Stand Mixer',
    'Dyson V15 Detect Vacuum',
    'Logitech MX Master 3S',
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-md p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-lg bg-white dark:bg-ink-900 rounded-[1.75rem] p-6 sm:p-7 shadow-2xl ring-1 ring-slate-200 dark:ring-white/10 space-y-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 rounded-xl border border-pink-100 dark:border-pink-900/40">
                <Search size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900 dark:text-white">Product Search</h2>
                <p className="text-xs text-slate-400 font-medium">Search by brand, name, or model</p>
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

          <form onSubmit={handleSubmit} className="space-y-3 relative">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type product name, model, or barcode number..."
                className="w-full py-3.5 pl-4 pr-12 bg-slate-50 dark:bg-slate-800/80 rounded-2xl text-sm border border-slate-200 dark:border-slate-700 focus:border-pink-600 focus:ring-1 focus:ring-pink-600 outline-none transition-all text-slate-900 dark:text-white font-medium"
                autoFocus
              />
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl disabled:opacity-40 transition-all shadow-md shadow-pink-600/20"
              >
                {isLoading ? <Sparkles size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              </button>
            </div>

            {/* AUTOCOMPLETE DROPDOWN */}
            {suggestions.length > 0 && query.trim().length >= 2 && (
               <motion.div 
                 initial={{ opacity: 0, y: -5 }} 
                 animate={{ opacity: 1, y: 0 }}
                 className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden z-20"
               >
                 {suggestions.map((sug, idx) => (
                   <button
                     key={idx}
                     type="button"
                     onClick={() => {
                       setQuery(sug);
                       onSearch(sug);
                       setSuggestions([]);
                     }}
                     className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-pink-50 dark:hover:bg-pink-900/30 hover:text-pink-600 dark:hover:text-pink-400 font-medium transition-colors flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                   >
                     <Search size={14} className="opacity-50" />
                     {sug}
                   </button>
                 ))}
               </motion.div>
            )}
            
            {/* LOADING INDICATOR FOR AUTOCOMPLETE */}
            {isTyping && query.trim().length >= 2 && suggestions.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 px-4 py-3 text-xs text-slate-400 flex items-center gap-2 font-medium">
                  <Loader2 size={12} className="animate-spin" />
                  Generating suggestions...
                </div>
            )}
          </form>

          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {query.trim() ? 'Related Popular' : 'Popular Searches'}
            </span>
            <div className="flex flex-wrap gap-2">
              {quickSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    onSearch(item);
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-pink-50 dark:hover:bg-pink-950/50 hover:text-pink-600 dark:hover:text-pink-400 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200/60 dark:border-slate-700/60 transition-all"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
