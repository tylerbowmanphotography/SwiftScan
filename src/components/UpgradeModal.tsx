import React, { useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { startCheckout } from '../utils/api';

interface Props {
  open: boolean;
  message?: string;
  paidEnabled: boolean;
  onClose: () => void;
  /** Called when checkout needs the user to sign in first. */
  onSignInRequired?: () => void;
}

export function UpgradeModal({ open, message, paidEnabled, onClose, onSignInRequired }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!open) return null;

  const upgrade = async () => {
    setBusy(true);
    setNote(null);
    const r = await startCheckout();
    setBusy(false);
    if (r.url) {
      window.location.href = r.url;
    } else if (r.signInRequired && onSignInRequired) {
      onSignInRequired();
    } else {
      setNote(r.error || 'Checkout is unavailable right now.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-black rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 text-pink-500 text-xs font-extrabold uppercase tracking-widest">
          <Sparkles size={14} /> SwiftScan Pro
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white">You've hit today's free scan limit</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {message || 'Free accounts get a few scans a day. Your count resets tomorrow.'}
        </p>
        <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-5">
          <li>Unlimited scans and product searches, no daily limit</li>
          <li>Works on every device you sign in on, plus more email price alerts</li>
        </ul>
        {paidEnabled ? (
          <button
            type="button"
            onClick={upgrade}
            disabled={busy}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            <span>Upgrade to Pro</span>
          </button>
        ) : (
          <div className="space-y-2">
            <button type="button" disabled className="w-full py-3 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-500 font-black text-sm cursor-not-allowed">
              Pro is coming soon
            </button>
            <p className="text-[11px] text-slate-500 text-center">Paid plans aren't open yet. Come back tomorrow for more free scans.</p>
          </div>
        )}
        {note && <p className="text-xs text-rose-500 font-semibold text-center">{note}</p>}
        <button type="button" onClick={onClose} className="w-full text-xs font-bold text-slate-500 underline">
          Maybe later
        </button>
      </div>
    </div>
  );
}
