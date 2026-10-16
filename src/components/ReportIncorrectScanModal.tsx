import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Send,
  Camera,
  Search,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Flag,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReportIncorrectScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProductName: string;
  currentBrand?: string;
  capturedImageUrl?: string;
  onSubmitCorrection: (correctName: string, reason: string) => void;
  onRetakePhoto: () => void;
  onManualSearch: () => void;
}

export const ReportIncorrectScanModal: React.FC<ReportIncorrectScanModalProps> = ({
  isOpen,
  onClose,
  currentProductName,
  currentBrand,
  capturedImageUrl,
  onSubmitCorrection,
  onRetakePhoto,
  onManualSearch,
}) => {
  const [reason, setReason] = useState<string>('wrong_item');
  const [correctNameInput, setCorrectNameInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctNameInput.trim()) return;

    setIsSubmitted(true);
    setTimeout(() => {
      onSubmitCorrection(correctNameInput.trim(), reason);
      setIsSubmitted(false);
      setCorrectNameInput('');
      setNotesInput('');
      onClose();
    }, 1000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-800/80 text-amber-400 flex items-center justify-center">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Report Incorrect Scan</h3>
                <p className="text-[11px] font-medium text-slate-400">Help us fix or re-analyze this product</p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-none">
            {/* Current Item Preview */}
            <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800/80 flex items-center gap-3.5">
              {capturedImageUrl ? (
                <img
                  src={capturedImageUrl}
                  alt={currentProductName}
                  className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-800"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                  <Flag size={20} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Scanned As
                </span>
                <h4 className="text-xs font-bold text-white truncate">
                  {currentProductName}
                </h4>
                {currentBrand && (
                  <p className="text-[11px] text-slate-400 truncate">Brand: {currentBrand}</p>
                )}
              </div>
            </div>

            {/* Quick Actions if user wants to retry camera or search */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRetakePhoto();
                }}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 text-slate-200 rounded-2xl border border-slate-700/60 flex items-center justify-center gap-2 text-xs font-bold transition-colors"
              >
                <Camera size={15} className="text-pink-400" />
                <span>Retake Photo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManualSearch();
                }}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 text-slate-200 rounded-2xl border border-slate-700/60 flex items-center justify-center gap-2 text-xs font-bold transition-colors"
              >
                <Search size={15} className="text-pink-400" />
                <span>Manual Search</span>
              </button>
            </div>

            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest absolute">
                OR Provide Correct Name
              </span>
            </div>

            {/* Correction Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Edit3 size={14} className="text-pink-400" />
                  <span>Correct Product Name / Model</span>
                </label>
                <input
                  type="text"
                  value={correctNameInput}
                  onChange={(e) => setCorrectNameInput(e.target.value)}
                  placeholder="e.g. Sony WH-1000XM4 Wireless Headphones"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-2xl text-xs text-white placeholder-slate-500 outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  What was incorrect?
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'wrong_item', label: 'Wrong Item Entirely' },
                    { id: 'wrong_variant', label: 'Wrong Color / Variant' },
                    { id: 'wrong_price', label: 'MSRP / Price Off' },
                    { id: 'other', label: 'Other Issue' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setReason(item.id)}
                      className={`px-3 py-2 rounded-xl text-left border transition-all ${
                        reason === item.id
                          ? 'bg-pink-950/80 border-pink-700 text-pink-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Provide any extra details e.g., '128GB version', 'Blue color variant'..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-2xl text-xs text-white placeholder-slate-500 outline-none transition-colors resize-none"
                />
              </div>

              {isSubmitted ? (
                <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Submitting correction & re-analyzing...</span>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!correctNameInput.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-pink-700 to-pink-800 hover:from-pink-600 hover:to-pink-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-lg shadow-pink-700/25 flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <Sparkles size={16} />
                  <span>Submit Correction & Re-Analyze Item</span>
                </button>
              )}
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
